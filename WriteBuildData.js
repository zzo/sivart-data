var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');

function WriteBuildData(repoName, githubEvent) {
  this.name = repoName;
  this.bucketName = Util.makeBucketName(repoName);
  this.github = githubEvent;
  this.namespace = Util.makeBucketName(repoName);
  this.dataset = gcloud.datastore.dataset(Auth);
}

WriteBuildData.prototype.getBucketName = function() {
  return this.bucketName;
};

WriteBuildData.prototype.addBuild = function(buildNumber, buildError, metadata, cb) {
};

WriteBuildData.prototype.getNextBuildNumber = function(cb) {
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

module.exports = WriteBuildData;
