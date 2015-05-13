'use strict';

var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');
var path = require('path');

function ReadBuildData(repoName) {
  this.name = repoName;
  this.namespace = Util.makeBucketName(repoName);
  this.dataset = gcloud.datastore.dataset(Auth);
  this.storage = gcloud.storage(Auth);
}

ReadBuildData.prototype.getBucketName = function() {
  return this.namespace;
};

ReadBuildData.prototype.runQuery_ = function(query, cb) {
  this.dataset.runQuery(query, function(err, entities, endCursor) {
    if (err) {
      cb('Error fetching builds: ' + err);
    } else {
      var data = [];
      entities.forEach(function(entity) {
        data.push(entity.data);
      });
      if (data.length) {
        cb(null, data, { endCursor: endCursor, query: query });
      } else {
        cb(null, data);
      }
    }
  });
};

ReadBuildData.prototype.getABuild = function(kind, buildId, cb) {
  var query = this.dataset.createQuery(this.namespace, [kind, buildId]);
  this.runQuery_(query, cb);
};

ReadBuildData.prototype.getMoreBuilds = function(moreObject, cb) {
  var nextQuery = moreObject.query.start(moreObject.endCursor);
  this.runQuery_(nextQuery, cb);
};

ReadBuildData.prototype.getSomeBuilds_ = function(type, cb) {
  var query = this.dataset.createQuery(this.namespace, [type]).limit(50);
  this.runQuery_(query, cb);
};

ReadBuildData.prototype.getSomePushBuilds = function(cb) {
  this.getSomeBuilds_('push', cb);
};

ReadBuildData.prototype.getSomePRBuilds = function(cb) {
  this.getSomeBuilds_('pull_request', cb);
};

ReadBuildData.prototype.getStreamedBuilds_ = function(which, cb) {
  var data = [];
  var query = this.dataset.createQuery(this.namespace, [which]);
  this.dataset.runQuery(query)
    .on('data', function(entity) { data.push(entity.data); })
    .on('error', function(err) { cb(err); })
    .on('end', function() { cb(null, data); });
};

ReadBuildData.prototype.getAllPushBuilds = function(cb) {
  this.getStreamedBuilds_('push', cb);
};

ReadBuildData.prototype.getAllPRBuilds = function(cb) {
  this.getStreamedBuilds_('pull_request', cb);
};

ReadBuildData.prototype.getAllFiles = function(herr, files, nextQuery, cb, soFar) {
  if (herr) {
    return cb(herr);
  }

  var me = this;
  if (!soFar) {
    soFar = [];
  }

  // Extract results
  soFar = soFar.concat(files.map(function(f) { return f.name; }));

  if (nextQuery) {
    this.bucket.getFiles(nextQuery, function(err, gfiles, next) {
      me.getAllFiles(err, gfiles, next, cb, soFar);
    });
  } else {
    cb(null, soFar);
  }
};

ReadBuildData.prototype.getBranches = function(cb) {
  this.bucket = this.storage.bucket(this.getBucketName());

  // Get all the cache files for this repo+branch combination
  //  see 'saveLogs.js' in sivart-slave for where this stuff is saved
  this.bucket.getFiles({ delimiter: '/'  }, function(err, files, next, apiResponse) {
    var prefixes = apiResponse.prefixes.map(function(prefix) { 
      prefix = prefix.replace(/^branch-/, '');
      prefix = prefix.replace(/\/$/, '');
      return prefix;
    });
    cb(err, prefixes);
  });
};

ReadBuildData.prototype.getFilenamesInDirectory = function(directory, cb) {
  this.bucket = this.storage.bucket(this.getBucketName());
  console.log('get files from directory: ' + directory);
  this.bucket.getFiles({ delimiter: '/', prefix: directory + '/' }, function(err, files, next, api) {
    if (err) {
      cb(err);
    } else {
      var filenames;
      if (!files.length) {
        filenames = api.prefixes.map(function(build) {
          return build.replace(new RegExp(directory + '|\/', 'g'), '');
        });
      } else {
        filenames = files.map(function(file) {
          return file.name;
        });
      }
      cb(null, filenames);
    }
  });
};

ReadBuildData.prototype.makeBranchName = function(branch) {
  return ['branch', branch].join('-');
};

ReadBuildData.prototype.getBuilds = function(branch, cb) {
  var branchPrefix = this.makeBranchName(branch);
  this.getFilenamesInDirectory(branchPrefix, cb);
};

ReadBuildData.prototype.getBuildNumbers = function(branch, buildId, cb) {
  branch = this.makeBranchName(branch);
  var branchPrefix = path.join(branch, String(buildId));
  this.getFilenamesInDirectory(branchPrefix, cb);
};

ReadBuildData.prototype.getBuildFilenames = function(branch, buildId, buildNumber, cb) {
  branch = this.makeBranchName(branch);
  var branchPrefix = path.join(branch, String(buildId), String(buildNumber));
  this.getFilenamesInDirectory(branchPrefix, cb);
};

ReadBuildData.prototype.getFile = function(branch, filename, cb) {
  this.bucket = this.storage.bucket(this.getBucketName());
  branch = this.makeBranchName(branch);
  var fullFilename = path.join(branch, filename);
  var file = this.bucket.file(fullFilename);
  file.download(cb);
};

ReadBuildData.prototype.getMainLogFile = function(branch, buildId, buildNumber, cb) {
  this.getLogFile(branch, buildId, buildNumber, 'user-script.log', cb);
};

ReadBuildData.prototype.getLastLog = function(branch, buildId, buildNumber, cb) {
  var me = this;
  this.getBuildFilenames(branch, buildId, buildNumber, function(err, files) {
    var logs = files.filter(function(filename) {
      return filename.match(/\d+\.\d+\.log/);
    });
    me.getLogFile(branch, buildId, buildNumber, path.basename(logs[logs.length - 1]), cb);
  });
};

ReadBuildData.prototype.getLogFile = function(branch, buildId, buildNumber, filename, cb) {
  var logFile = path.join(String(buildId), String(buildNumber), filename);
  console.log('getting file: ' + logFile);
  this.getFile(branch, logFile, cb);
};

module.exports = ReadBuildData;
