var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');

function Builds(repoName) {
  this.name = repoName;
  this.namespace = Util.makeBucketName(repoName);
  this.dataset = gcloud.datastore.dataset(Auth);
}

Builds.prototype.runQuery_ = function(query, cb) {
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

Builds.prototype.getMoreBuilds = function(moreObject, cb) {
  var nextQuery = moreObject.query.start(moreObject.endCursor);
  this.runQuery_(nextQuery, cb);
};

Builds.prototype.getSomeBuilds_ = function(type, cb) {
  var query = this.dataset.createQuery(this.namespace, [type]).limit(50);
  this.runQuery_(query, cb);
};

Builds.prototype.getSomePushBuilds = function(cb) {
  this.getSomeBuilds_('push', cb);
};

Builds.prototype.getSomePRBuilds = function(cb) {
  this.getSomeBuilds_('pull_request', cb);
};

Builds.prototype.getStreamedBuilds_ = function(which, cb) {
  var data = [];
  var query = this.dataset.createQuery(this.namespace, [which]);
  this.dataset.runQuery(query)
    .on('data', function(entity) { data.push(entity.data); })
    .on('error', function(err) { cb(err); })
    .on('end', function() { cb(null, data); })
};

Builds.prototype.getAllPushBuilds = function(cb) {
  this.getStreamedBuilds_('push', cb);
};

Builds.prototype.getAllPRBuilds = function(cb) {
  this.getStreamedBuilds_('pull_request', cb);
};

Builds.prototype.getNextBuildNumber = function(cb) {
  var id;
  var me = this;
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'buildId' ] });
  this.dataset.runInTransaction(function(transaction, done) {
    var query = me.dataset.createQuery(me.namespace, [ kind ]);
    transaction.runQuery(query, function(err, entities, endCursor, apiResponse) {
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
        id = entity.data.value;
        done();
      }
    });
  }, function(err) { cb(err, id); });
};

module.exports = Builds;
