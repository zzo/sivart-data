'use strict';

var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');
var Q = require('q');
var path = require('path');

function WriteBuildData(repoName, githubEvent) {
  this.name = repoName;
  this.kind = githubEvent;
  this.namespace = Util.makeBucketName(repoName);
  this.dataset = gcloud.datastore.dataset(Auth);
  this.storage = gcloud.storage(Auth);
}

WriteBuildData.prototype.getBucketName = function() {
  return this.namespace;
};

// Write out what happened
WriteBuildData.prototype.store = function(runs, rawBuildRequest, buildData, cb) {
  if (!this.buildId) {
    var me = this;
    this.getNextBuildNumber(function(err) {
      if (err) {
       cb(err);
      } else {
        me.store(runs, rawBuildRequest, buildData, cb);
      }
    });
  } else {
    var key = this.dataset.key({ namespace: this.namespace, path: [ this.kind, this.buildId ]});
    var dataToStore = Util.cleanDatastoreContents({ buildData: buildData, runs: runs, rawBuildRequest: rawBuildRequest });
    var entity = { key: key, data: dataToStore };
    this.dataset.save(entity, cb);
  }
};

WriteBuildData.prototype.retryHandler = function(funcToCall, retryCountProperty, args, err) {
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

// Update overall build state
WriteBuildData.prototype.updateOverallState = function(buildId, newState, totalRunTime, cb) {
  var me = this;
  var key = this.dataset.key({ namespace: this.namespace, path: [ this.kind, buildId ]});
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
    /*
  }, function(err) {
    if (err) {
      if (!me.utries) {
        me.utries = 0;
      }
      if (err.code === 409 && me.utries < 10) {
        // message: 'too much contention on these datastore entities. please try again.',
        // sleep for a second & try again
        me.utries++;
        var sleep = Math.floor(Math.random() * 5) + 1;
        console.log('409 - going around again after %s seconds', sleep);
        setTimeout(function() {
          me.updateOverallState(buildId, newState, cb);
        }, 1000 * sleep);
      } else {
        if (me.utries > 0) {
          console.log('Too many tries - failing');
          me.utries = 0;
        }
        cb(err);
      }
    } else {
      cb();
    }
  });
  */
};

// Update an individual build run's state
WriteBuildData.prototype.updateState = function(buildId, buildNumber, newState, cb) {
  var key = this.dataset.key({ namespace: this.namespace, path: [ this.kind, buildId ]});
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
    me.retryHandler(me.updateState, 'tries', [ buildId, buildNumber, newState, cb ], err);
  });
  /*
  }, function(err) {
    if (err) {
      if (!me.tries) {
        me.tries = 0;
      }
      if (err.code === 409 && me.tries < 10) {
        // message: 'too much contention on these datastore entities. please try again.',
        // sleep for a second & try again
        me.tries++;
        var sleep = Math.floor(Math.random() * 5) + 1;
        console.log('409 - going around again after %s seconds', sleep);
        setTimeout(function() {
          me.updateState(buildId, buildNumber, newState, cb);
        }, 1000 * sleep);
      } else {
        if (me.tries > 0) {
          console.log('Too many tries - failing');
          me.tries = 0;
        }
        cb(err);
      }
    } else {
      cb();
    }
  });
  */
};

WriteBuildData.prototype.getNextBuildNumber = function(cb) {
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

/*
 * All files in fileList are stored in the 'prefix' directory in the bucket
 */
WriteBuildData.prototype.writeFilesToBucket = function(prefix, fileList, cb) {
  var me = this;
  // Array of function calls that return promises to save each file
  var promises = fileList.map(function(file) {
    return Q.ninvoke(me, 'writeFileToBucket', file, path.join(prefix, path.basename(file)));
  });

  // Execute and wait for all of them
  Q.allSettled(promises).then(function(results) {

    var successResponses =
      results
        .filter(function(result) {
          return result.state === 'fulfilled';
        })
        .map(function(success) {
          return success.value;
        });

    var failedResponses =
      results
        .filter(function(result) {
          return result.state === 'rejected';
        })
        .map(function(failed) {
          return failed.reason;
        });

    if (failedResponses.length) {
      cb(failedResponses, successResponses);
    } else {
      cb();
    }
  });
};

WriteBuildData.prototype.writeFileToBucket = function(from, to, cb) {
  var me = this;
  var options = {
    destination: to
  };
  this.storage.createBucket(this.getBucketName(), function(err, bucket) {
    if (err) {
      // Asume bucket already exists
      // TODO(trostler): verify that's true!
      bucket = me.storage.bucket(me.getBucketName());
    }

    bucket.upload(from, options, cb);
  });
};

module.exports = WriteBuildData;
