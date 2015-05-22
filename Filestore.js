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

// Takes contents and saves it into a file named 'filename' for the build
Filestore.prototype.saveRunFile = function(buildId, buildNumber, filename, fileOnDisk, cb) {
  var me = this;
  this.getBranch(buildId, function(err, branch, safeBranch) {
    if (err) {
      cb(err);
    } else {
      var fullPath = path.join(safeBranch, String(buildId), String(buildNumber), filename);
      me.persistFile(fileOnDisk, fullPath, cb);
    }
  });
};

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

Filestore.prototype.getFile = function(buildId, filePath, cb) {
  var me = this;
  this.getBranch(buildId, function(err, branch, safeBranch) {
    if (err) {
      cb(err);
    } else {
      var fullFilename = path.join(safeBranch, filePath);
      var file = me.bucket.file(fullFilename);
      file.download(cb);
    }
  });
};

Filestore.prototype.getLogFile = function(buildId, buildNumber, filename, cb) {
  var logFile = path.join(String(buildId), String(buildNumber), filename);
  this.getFile(buildId, logFile, cb);
};

Filestore.prototype.getMainLogFile = function(buildId, buildNumber, cb) {
  this.getLogFile(buildId, buildNumber, 'user-script.clean.log', cb);
};

Filestore.prototype.getFileList = function(filePath, cb) {
  this.bucket.getFiles({
    prefix: filePath,
    delimeter: '/'
  }, function(err, files, nextQuery, apiResponse) {
    if (err) {
      cb(err);
    } else {
      var retFiles = [];
      if (apiResponse.items) {
        retFiles = apiResponse.items.map(function(item) {
          return item.name;
        });
      }
      cb(null, retFiles);
    }
  });
};

Filestore.prototype.getBuildFileList = function(buildId, cb) {
  var me = this;
  this.getBranch(buildId, function(err, branch, safeBranch) {
    if (err) {
      cb(err);
    } else {
      var dirPath = path.join(safeBranch, String(buildId));
      me.getFileList(dirPath, cb);
    }
  });
};

Filestore.prototype.getRunFileList = function(buildId, buildNumber, cb) {
  var me = this;
  this.getBranch(buildId, function(err, branch, safeBranch) {
    if (err) {
      cb(err);
    } else {
      var dirPath = path.join(safeBranch, String(buildId), String(buildNumber));
      me.getFileList(dirPath, cb);
    }
  });
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

Filestore.prototype.deleteRunFiles = function(buildId, buildNumber, cb) {
  var me = this;
  this.getRunFileList(buildId, buildNumber, function(err, fileList) {
    if (err) {
      cb(err);
    } else {
      me.deleteFiles(fileList, cb);
    }
  });
};

Filestore.prototype.deleteBuildFiles = function(buildId, cb) {
  var me = this;
  this.getBuildFileList(buildId, function(err, fileList) {
    if (err) {
      cb(err);
    } else {
      me.deleteFiles(fileList, cb);
    }
  });
};

Filestore.prototype.getBranch = function(buildId, cb) {
  var me = this;
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
        cb(null, branch, me.makeBranchName(branch));
      }
    }
  });
};

module.exports = Filestore;
