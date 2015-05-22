'use strict';

var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');

function Datastore(repoName) {
  this.name = repoName;
  this.namespace = Util.makeBucketName(repoName);
  this.dataset = gcloud.datastore.dataset(Auth);
}

// Write out what happened
Datastore.prototype.saveInitialData = function(runs, rawBuildRequest, buildData, cb) {
  if (!this.buildId) {
    cb('Must set Build ID!');
  } else {
    var key = this.dataset.key({ namespace: this.namespace, path: [ 'build', String(this.buildId) ]});
    var dataToStore = Util.cleanDatastoreContents({ buildData: buildData, runs: runs, rawBuildRequest: rawBuildRequest });
    var entity = { key: key, data: dataToStore };
    this.dataset.save(entity, cb);
  }
};

Datastore.prototype.getNextBuildNumber = function(cb) {
  var me = this;
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'buildId' ] });
  this.dataset.runInTransaction(function(transaction, done) {
    var query = me.dataset.createQuery(me.namespace, key.path);
    transaction.runQuery(query, function(err, entities) {
      if (err) {
        cb(err);
      } else {
        var entity;
        if (entities.length) {
          entity = entities[0];
          entity.data.value++;
        } else {
          entity = { key: key, data: { value: 1 }};
        }
        transaction.save(entity);
        me.buildId = entity.data.value;
        done();
      }
    });
  }, function(err) {
    cb(err, me.buildId);
  });
};

Datastore.prototype.getCurrentBuildId = function(cb) {
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'buildId' ] });
  var query = this.dataset.createQuery(this.namespace, key.path);
  var me = this;
  this.dataset.runQuery(query, function(err, entities) {
    if (entities.length) {
      cb(null, entities[0].data.value);
    } else {
      cb(err || me.namespace + ' does not exist?');
    }
  });
};

/*
 * used by UI
 */
Datastore.prototype.getCurrentBuild = function(cb) {
  var me = this;
  this.getCurrentBuildId(function(err, id) {
    if (err) {
      cb(err);
    } else {
      me.getABuild(id, cb);
    }
  });
};

Datastore.prototype.getBuildType = function(type, cb) {
  var query = this.dataset.createQuery(this.namespace, ['build']).limit(50);

  this.dataset.runQuery(query, function(err, entities) {
    if (err) {
      cb(err);
    } if (entities) {
      // Filter out only the builds we're interested in
      cb(null, entities.filter(function(entity) {
        return entity.data.buildData.kind === type;
        }).map(function(typeEntity) {
          return typeEntity.data;
      }));
    } else {
      cb('No builds of type ' + type);
    }
  });
};

Datastore.prototype.getSomePushBuilds = function(cb) {
  this.getBuildType('push', cb);
};

Datastore.prototype.getSomePRBuilds = function(cb) {
  this.getBuildType('pull_request', cb);
};

Datastore.prototype.getABuild = function(buildId, cb) {
  this.dataset.get({ namespace: this.namespace, path: ['build', String(buildId) ] }, function(err, builds) {
    if (err) {
      cb(err);
    } else if (builds) {
      cb(null, builds.data);
    } else {
      cb('Build ' + buildId + ' does not exist');
    }
  });
};

Datastore.prototype.getTotalRunTime = function(build) {
  var total = 0;
  build.runs.forEach(function(run) {
    if (run.updated) {
      total += run.updated - run.created;
    } else {
      total += new Date().getTime() - run.created;
    }
  });
  return total;
};

/*
 * called by a script running on the slave instance OR a rerun
 */
Datastore.prototype.updateRunState = function(buildId, buildNumber, newState, cb) {
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'build', buildId ]});
  var me = this;
  this.dataset.runInTransaction(function(transaction, done) {
    transaction.get(key, function(err, entity) {
      if (err) {
        cb(err);
      } else {
        var build = entity.data;
        build.runs.forEach(function(run) {
          if (run.buildNumber === parseInt(buildNumber, 10)) {
            if (typeof newState === 'object') {
              for (var k in newState) {
                if (newState.hasOwnProperty(k)) {
                  run[k] = newState[k];
                }
              }
            } else if (typeof newState === 'string') {
              run.state = newState;
            }
            run.updated = new Date().getTime();
          }
        });
        build.buildData.totalRunTime = me.getTotalRunTime(build);
        var newOverallState = me.determineOverallBuildState(build);
        if (newOverallState) {
          // something has changed
          build.buildData.state = newOverallState;
        }
        transaction.update(entity);
        done();
      }
    });
  }, function(err) {
    me.retryHandler(me.updateRunState, 'tries', [ buildId, buildNumber, newState, cb ], err);
  });
};

// Update overall build state
Datastore.prototype.updateOverallState = function(buildId, newState, cb) {
  var me = this;
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'build', buildId ]});
  this.dataset.runInTransaction(function(transaction, done) {
    transaction.get(key, function(err, entity) {
      if (err) {
        cb(err);
      } else {
        entity.data.buildData.state = newState;
        transaction.update(entity);
        done();
      }
    });
  }, function(err) {
    me.retryHandler(me.updateOverallState, 'utries', [ buildId, newState, cb ], err);
  });
};

Datastore.prototype.retryHandler = function(funcToCall, retryCountProperty, args, err) {
  var me = this;
  var cb = args[args.length - 1];
  if (err) {
    if (!me[retryCountProperty]) {
      me[retryCountProperty] = 0;
    }
    if (me[retryCountProperty] < 10) {
      // message: 'too much contention on these datastore entities. please try again.',
      // sleep for a second & try again
      me[retryCountProperty]++;
      var sleep = Math.floor(Math.random() * 10) + 1;
      setTimeout(function() {
        funcToCall.apply(me, args);
      }, 1000 * sleep);
    } else {
      if (me[retryCountProperty] > 0) {
        me[retryCountProperty] = 0;
      }
      cb(err);
    }
  } else {
    cb();
  }
};

/*
 * loop through all runs and see were we're at
 * TODO(trostler): better state management for runs and overall
 */
Datastore.prototype.determineOverallBuildState = function(build) {
  if (build.buildData.state === 'running') {
    // Now figure it out!
    var failed = false;
    var errored = false;
    var running = false;
    var canceled = false;

    // individual buildNumber states:
    build.runs.forEach(function(run) {
      if (!run.ignoreFailure) {
        if (run.state === 'failed') {
          failed = true;
        } else if (run.state === 'errored' || run.state === 'system') {
          errored = true;
        } else if (run.state === 'timedout' || run.state === 'exited') {
          failed = true;
        } else if (run.state === 'building' || run.state === 'running') {
          running = true;
        } else if (run.state === 'canceled') {
          errored = true;
        }
      }
    });

    var newState = 'running';
    if (!running) {
      if (!failed && !errored && !running && !canceled) {
        newState = 'passed';
      } else if (canceled) {
        newState = 'canceled';
      } else if (failed && errored) {
        // fail wins!  Need to have a single value for the overall build state
        newState = 'failed';
      } else if (errored) {
        newState = 'errored';
      } else if (failed) {
        newState = 'failed';
      }
    }

    return newState;
  }
};

// Get the startup script for a given buildId/buildNumber
Datastore.prototype.getRun = function(buildId, buildNumber, cb) {
  this.getABuild(buildId, function(err, build) {
    if (err) {
      cb(err);
    } else {
      var filteredRun = build.runs.filter(function(run) {
        return run.buildNumber === parseInt(buildNumber, 10);
      });
      if (filteredRun[0]) {
        cb(null, filteredRun[0]);
      } else {
        cb('Cannot find run #' + buildNumber);
      }
    }
  });
};

// Get the startup script for a given buildId/buildNumber
Datastore.prototype.getStartupScript = function(buildId, buildNumber, cb) {
  this.getRun(buildId, buildNumber, function(err, run) {
    if (err) {
      cb(err);
    } else {
      var script = '';
      run.script.slice(0).forEach(function(ch) {
        script += String.fromCharCode(ch);
      });
      cb(null, script);
    }
  });
};

module.exports = Datastore;
