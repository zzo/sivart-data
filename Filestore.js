'use strict';

var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');
var Q = require('q');
var path = require('path');

function Filestore(repoName) {
  this.name = repoName;
  this.bucketName = Util.makeBucketName(repoName);
  this.storage = gcloud.storage(Auth);
  this.bucket = this.storage.bucket(this.bucketName);
}

/*
 * All files in fileList are stored in the 'prefix' directory in the bucket
 */
Filestore.prototype.persistFiles = function(prefix, fileList, cb) {
  var me = this;
  // Array of function calls that return promises to save each file
  var promises = fileList.map(function(file) {
    return Q.ninvoke(me, 'persistFile', file, path.join(prefix, path.basename(file)));
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

Filestore.prototype.persistFile = function(from, to, cb) {
  var me = this;
  var options = {
    destination: to
  };
  this.storage.createBucket(this.bucketName, function(err, bucket) {
    if (err) {
      // Asume bucket already exists
      // TODO(trostler): verify that's true!
      bucket = me.storage.bucket(me.bucketName);
    }

    // Make bucket world-readable
    bucket.acl.default.add({
      entity: 'allUsers',
      role: me.storage.acl.READER_ROLE
    }, function(aerr /*, apiResponse*/) {
      if (aerr) {
        cb(aerr);
      } else {
        bucket.upload(from, options, cb);
      }
    });
  });
};

Filestore.prototype.makeBranchName = function(branch) {
  return ['branch', branch].join('-');
};

Filestore.prototype.getFile = function(branch, filename, cb) {
  branch = this.makeBranchName(branch);
  var fullFilename = path.join(branch, filename);
  var file = this.bucket.file(fullFilename);
  file.download(cb);
};

Filestore.prototype.getLogFile = function(branch, buildId, buildNumber, filename, cb) {
  var logFile = path.join(String(buildId), String(buildNumber), filename);
  this.getFile(branch, logFile, cb);
};

Filestore.prototype.getMainLogFile = function(branch, buildId, buildNumber, cb) {
  this.getLogFile(branch, buildId, buildNumber, 'user-script.clean.log', cb);
};

module.exports = Filestore;
