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
WriteBuildData.prototype.store = function(buildInfo, rawBuildRequest, cb) {
  if (!this.buildId) {
    var me = this;
    this.getNextBuildNumber(function(err) {
      if (err) {
       cb(err);
      } else {
        me.store(buildInfo, rawBuildRequest, cb);
      }
    });
  } else {
    var key = this.dataset.key({ namespace: this.namespace, path: [ this.kind, this.buildId ]});
    var dataToStore = Util.cleanDatastoreContents({ runs: buildInfo, rawBuildRequest: rawBuildRequest });
    var entity = { key: key, data: dataToStore };
    this.dataset.save(entity, cb);
  }
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
