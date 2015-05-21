'use strict';

var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');
var Q = require('q');
var fs = require('fs');
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
  Util.dealWithAllPromises(promises, cb);
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

Filestore.prototype.getBasePublicURL = function(branch, buildId, buildNumber) {
  branch = this.makeBranchName(branch);
  return path.join(this.bucketName, branch, String(buildId), String(buildNumber));
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

Filestore.prototype.getFileList = function(path, cb) {
  this.bucket.getFiles({
    prefix: path,
    delimeter: '/',
  }, function(err, files, nextQuery, apiResponse) {
    if (err) {
      cb(err);
    } else {
      var fiels = [];
      if (apiResponse.items) {
        files = apiResponse.items.map(function(item) {
          return item.name;
        });
      }
      cb(null, files);
    }
  });
}

Filestore.prototype.getBuildFileList = function(branch, buildId, cb) {
  branch = this.makeBranchName(branch);
  var dirPath = path.join(branch, String(buildId));
  this.getFileList(dirPath, cb);
};

Filestore.prototype.getRunFileList = function(branch, buildId, buildNumber, cb) {
  branch = this.makeBranchName(branch);
  var dirPath = path.join(branch, String(buildId), String(buildNumber));
  this.getFileList(dirPath, cb);
};

Filestore.prototype.deleteFile = function(filename, cb) {
  var file = this.bucket.file(filename);
  file.delete(cb);
};

Filestore.prototype.deleteFiles = function(fileList, cb) {
  var me = this;
  var promises = fileList.map(function(file) {
    return Q.ninvoke(me, 'deleteFile', file);
  });
  Util.dealWithAllPromises(promises, cb);
};

Filestore.prototype.deleteRunFiles = function(branch, buildId, buildNumber, cb) {
  var me = this;
  this.getRunFileList(branch, buildId, buildNumber, function(err, fileList) {
    if (err) {
      cb(err);
    } else {
      me.deleteFiles(fileList, cb);
    }
  });
};

Filestore.prototype.deleteBuildFiles = function(branch, buildId, cb) {
  var me = this;
  this.getBuildFileList(branch, buildId, function(err, fileList) {
    if (err) {
      cb(err);
    } else {
      me.deleteFiles(fileList, cb);
    }
  });
};

Filestore.prototype.getBranch = function(buildId, cb) {
  this.getFileList('', function(err, list) {
    if (err) {
      cb(err);
    } else {
      var branch = list.reduce(function(previous, fileName) {
        // try to match branch-(branch}/buildId
        if (previous) {
          return previous;
        }
        var regex = new RegExp('^branch-([^/]+)/' + buildId + '/');
        var matches = regex.exec(fileName);
        if (matches) {
          return matches[1];
        }
      }, '');
      if (!branch) {
        cb('Cannot find branch for buildId ' + buildId);
      } else {
        cb(null, branch);
      }
    }
  });
};

module.exports = Filestore;
