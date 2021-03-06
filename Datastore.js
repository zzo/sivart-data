'use strict';

var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');
var Counter = require('./Counter');

function Datastore(repoName) {
  this.name = repoName;
  this.namespace = Util.makeBucketName(repoName);
  this.dataset = gcloud.datastore.dataset(Auth);
  this.counter = new Counter(this.namespace, this.dataset);
}

// Write out what happened
Datastore.prototype.saveInitialData = function(buildId, runs, rawBuildRequest, buildData, cb) {
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'build', String(buildId) ]});
  var dataToStore = Util.cleanDatastoreContents({ buildData: buildData, runs: runs, rawBuildRequest: rawBuildRequest });
  var entity = { key: key, data: dataToStore };
  this.dataset.save(entity, cb);
};

Datastore.prototype.getNextBuildNumber = function(cb) {
  this.counter.increment(cb);
};

Datastore.prototype.getCurrentBuildId = function(cb) {
  this.counter.getCount(cb);
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
      me.getABuild(id, function(err, build) {
        if (err) {
          me.getABuild(id-1, cb);
        } else {
          cb(null, build);
        }
      });
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
  var originalArguments = arguments;
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
    var handler = Util.retryHandler.bind(me);
    handler(me.updateRunState, 'tries', originalArguments, err);
  });
};

// Update overall build state
Datastore.prototype.updateOverallState = function(buildId, newState, cb) {
  var originalArguments = arguments;
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
    var handler = Util.retryHandler.bind(me);
    handler(me.updateOverallState, 'utries', originalArguments, err);
  });
};

/*
 * loop through all runs and see were we're at
 * TODO(trostler): better state management for runs and overall
 */
Datastore.prototype.determineOverallBuildState = function(build) {
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
          canceled = true;
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
module.exports = Datastore;
