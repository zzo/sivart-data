var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');

function WriteBuildData(repoName, githubEvent) {
  this.name = repoName;
  this.bucketName = Util.makeBucketName(repoName);
  this.kind = githubEvent;
  this.namespace = Util.makeBucketName(repoName);
  this.dataset = gcloud.datastore.dataset(Auth);
}

WriteBuildData.prototype.getBucketName = function() {
  return this.bucketName;
};

// Write out what happened 
WriteBuildData.prototype.store = function(buildInfo, rawBuildRequest, cb) {
  if (!this.buildId) {
    var me = this;
    this.getNextBuildNumber(function(err, number) {
      me.store(buildInfo, rawBuildRequest, cb);
    });
  } else {
    var key = this.dataset.key({ namespace: this.namespace, path: [ this.kind, this.buildId ]});
    var dataToStore = Util.cleanDatastoreContents({ builds: buildInfo, metadata: rawBuildRequest });
    var entity = { key: key, data: dataToStore };
    this.dataset.save(entity, cb);
  }
};

WriteBuildData.prototype.getNextBuildNumber = function(cb) {
  var me = this;
  var key = this.dataset.key({ namespace: this.namespace, path: [ 'buildId' ] });
  this.dataset.runInTransaction(function(transaction, done) {
    var query = me.dataset.createQuery(me.namespace, key.path);
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
        me.buildId = entity.data.value;
        done();
      }
    });
  }, function(err) { cb(err, me.buildId); });
};

module.exports = WriteBuildData;
