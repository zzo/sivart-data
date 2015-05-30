'use strict';

var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');
var Q = require('q');
var path = require('path');
var fs = require('fs');

function Filestore(repoName) {
  this.name = repoName;
  this.bucketName = Util.makeBucketName(repoName);
  this.storage = gcloud.storage(Auth);
  this.bucket = this.storage.bucket(this.bucketName);
}

Filestore.prototype.save = function() {
  var args = Array.prototype.slice.call(arguments);
  var cb = args.pop();
  var fileOnDisk = args[args.length -1];
  args[0] = this.makeBranchName(args[0]);
  args[args.length - 1] = path.basename(args[args.length - 1]);
  var fullPath = args.join('/');
  this.persistFile(fileOnDisk, fullPath, cb);
};

Filestore.prototype.get = function(path, cb) {
  var file = this.bucket.file(path);
  file.download(cb);
};

Filestore.prototype.saveBuildNumberFile = function(branch, buildId, buildNumber, fileOnDisk, cb) {
  this.save.apply(this, arguments);
};

Filestore.prototype.saveBuildFile = function(branch, buildId, fileOnDisk, cb) {
  this.save.apply(this, arguments);
};

Filestore.prototype.saveBranchFile = function(branch, fileOnDisk, cb) {
  this.save.apply(this, arguments);
};

Filestore.prototype.saveRepoFile = function(fileOnDisk, cb) {
  this.persistFile(fileOnDisk, path.basename(fileOnDisk),  cb);
};

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
      var fullFilename = path.join(safeBranch, String(buildId), filePath);
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

Filestore.prototype.dealfest = function(err, cb, allItems, apiResponse, nextQuery, func) {
  if (err) {
    cb(err);
  } else {
    if (apiResponse.items) {
      allItems = allItems.concat(apiResponse.items.map(function(item) {
        return item.name;
      }));
    }
    if (!nextQuery) {
      cb(null, allItems);
    } else {
      func.call(this, null, cb, allItems, nextQuery);
    }
  }
};

Filestore.prototype.getFileList = function(filePath, cb, filesSoFar, nextQuery) {
  var query;
  if (!filesSoFar) {
    filesSoFar = [];
    query = {
      prefix: filePath,
      delimeter: '/'
    };
  }

  var me = this;
  this.bucket.getFiles(nextQuery || query, function(err, files, nextQ, apiResponse) {
    me.dealfest(err, cb, filesSoFar, apiResponse, nextQ, me.getFileList);
  });
};

Filestore.prototype.getBranches = function(cb) {
  var branches = {};
  this.getFileList('', function(err, fileList) {
    if (err) {
      cb(err);
    } else {
      fileList.forEach(function(fileName) {
        var regex = new RegExp('^branch-([^/]+)');
        var matches = regex.exec(fileName);
        if (matches) {
          branches[matches[1]] = 1;
        }
      });
      cb(null, Object.keys(branches));
    }
  });
};

Filestore.prototype.getBranchFileList = function(branch, cb) {
  var safeBranch = this.makeBranchName(branch);
  this.getFileList(safeBranch, cb);
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

// Not dangerous at all :)
Filestore.prototype.deleteAllBranches = function(cb) {
  var me = this;
  this.getBranches(function(err, branches) {
    if (err) {
      cb(err);
    } else {
      var promises = branches.map(function(branch) {
        return Q.ninvoke(me, 'deleteBranchFiles', branch);
      });
      Util.dealWithAllPromises(promises, cb);
    }
  });
};

Filestore.prototype.deleteBranchFiles = function(branch, cb) {
  var me = this;
  this.getBranchFileList(branch, function(err, fileList) {
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

Filestore.prototype.savePrivateKey = function(branch, buildId, buildNumber, keyData, cb) {
  var tmpFile = path.join('/tmp', branch + buildId + buildNumber, 'private.key');
  if (!fs.existsSync(path.dirname(tmpFile))) {
    fs.mkdirSync(path.dirname(tmpFile));
  }
  fs.writeFileSync(tmpFile, keyData, 'utf8');
  this.saveBuildNumberFile(branch, buildId, buildNumber, tmpFile, cb);
};

Filestore.prototype.getPrivateKey = function(buildId, buildNumber, cb) {
  this.getFile(buildId, path.join(String(buildNumber), 'private.key'), cb);
};

Filestore.prototype.saveStartupScript = function(branch, buildId, buildNumber, script, cb) {
  var tmpFile = path.join('/tmp', branch + buildId + buildNumber, 'startupScript.sh');
  if (!fs.existsSync(path.dirname(tmpFile))) {
    fs.mkdirSync(path.dirname(tmpFile));
  }
  fs.writeFileSync(tmpFile, script, 'utf8');
  this.saveBuildNumberFile(branch, buildId, buildNumber, tmpFile, cb);
};

Filestore.prototype.getStartupScript = function(branch, buildId, buildNumber, cb) {
  this.getFile(buildId, path.join(String(buildNumber), 'startupScript.sh'), cb);
};

Filestore.prototype.saveScriptAndPK = function(branch, buildId, buildNumber, script, pk, cb) {
  var me = this;
  Q.ninvoke(this, 'saveStartupScript', branch, buildId, buildNumber, script)
  .then(function() {
    return Q.ninvoke(me, 'savePrivateKey', branch, buildId, buildNumber, pk);
  })
  .then(function() { cb(null); })
  .catch(cb);
};

module.exports = Filestore;
