var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');

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
  this.dataset.runQuery(query, function(err, entities, endCursor, apiResponse) {
    if (err) {
      cb("Error fetching builds: " + err);
    } else {
      var data = [];
      entities.forEach(function(entity) {
        data.push(entity.data);
      });
      if (data.length) {
        cb(null, data, { endCursor: endCursor, query: query});
      } else {
        cb(null, data);
      }
    }
  });
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
    .on('end', function() { cb(null, data); })
};

ReadBuildData.prototype.getAllPushBuilds = function(cb) {
  this.getStreamedBuilds_('push', cb);
};

ReadBuildData.prototype.getAllPRBuilds = function(cb) {
  this.getStreamedBuilds_('pull_request', cb);
};

ReadBuildData.prototype.getAllFiles = function(hrerr, files, nextQuery, cb, soFar) {
  if (hrerr) {
    return cb(herr);
  }

  var me = this;
  if (!soFar) {
    soFar = [];
  }

  // Extract results
  soFar = soFar.concat(files.map(function(f) { return f.name }));

  if (nextQuery) {
    this.bucket.getFiles(nextQuery, function(err, files, next) {
      me.getAllFiles(err, files, next, cb, soFar);
    });
  } else {
    cb(null, soFar);
  }
};

ReadBuildData.prototype.getBranches = function(cb) {
  this.bucket = this.storage.bucket(this.getBucketName());
  var me = this;

  // Get all the cache files for this repo+branch combination
  //  see 'saveLogs.js' in sivart-slave for where this stuff is saved
  this.bucket.getFiles({ prefix: 'branch-' }, function(err, files, next) {
    me.getAllFiles(err, files, next, function(err, files) {
      // get rid of all 'cache-' files - the rest are branches
      cb(null, files);
    });
  });
};

module.exports = ReadBuildData;
