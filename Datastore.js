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

Datastore.prototype.getBuildType = function(type, cb) {
  var query = this.dataset.createQuery(this.namespace, ['build']).limit(50);

  this.dataset.runQuery(query, function(err, entities) {
    if (err) {
      cb(err);
    } else {
      var builds = entities.filter(function(entity) {
        return entity.data.buildData.kind === type;
      });
      cb(null, builds.map(function(build) {
        return build.data;
      }));
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
  this.dataset.get({ namespace: this.namespace, path: ['build', String(buildId) ] }, function(err, build) {
    if (err) {
      cb(err);
    } else if (build) {
      cb(null, build.data);
    } else {
      cb('Build ' + buildId + ' does not exist');
    }
  });
};

Datastore.prototype.updateRunState = function(buildId, buildNumber, newState, cb) {
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'build', buildId ]});
  var me = this;
  this.dataset.runInTransaction(function(transaction, done) {
    transaction.get(key, function(err, entity) {
      if (err) {
        cb(err);
      } else {
        entity.data.runs.forEach(function(run) {
          if (run.buildNumber === parseInt(buildNumber, 10)) {
            run.state = newState;
            run.updated = new Date().getTime();
          }
        });
        transaction.update(entity);
        done();
      }
    });
  }, function(err) {
    me.retryHandler(me.updateRunState, 'tries', [ buildId, buildNumber, newState, cb ], err);
  });
};

// Update overall build state
Datastore.prototype.updateOverallState = function(buildId, newState, totalRunTime, cb) {
  var me = this;
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'build', buildId ]});
  this.dataset.runInTransaction(function(transaction, done) {
    transaction.get(key, function(err, entity) {
      if (err) {
        cb(err);
      } else {
        entity.data.buildData.state = newState;
        entity.data.buildData.totalRunTime = totalRunTime;
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
    if (err.code === 409 && me.utries < 10) {
      // message: 'too much contention on these datastore entities. please try again.',
      // sleep for a second & try again
      me[retryCountProperty]++;
      var sleep = Math.floor(Math.random() * 5) + 1;
      console.log('409 - going around again after %s seconds', sleep);
      setTimeout(function() {
        funcToCall.apply(me, args);
      }, 1000 * sleep);
    } else {
      if (me[retryCountProperty] > 0) {
        console.log('Too many tries - failing');
        me[retryCountProperty] = 0;
      }
      cb(err);
    }
  } else {
    cb();
  }
};


module.exports = Datastore;
