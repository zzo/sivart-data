'use strict';

var Auth = require('./Auth');
var Util = require('./Util');
var gcloud = require('gcloud');

function User(username) {
  this.dataset = gcloud.datastore.dataset(Auth);
  this.namespace = 'github';
  this.username = username;
  this.key = this.dataset.key({ namespace: this.namespace, path: [ 'users', this.username ]});
}

User.prototype.get = function(cb) {
  this.dataset.get(this.key, function(err, user) {
    if (err) {
      cb(err);
    } else {
      if (user) {
        cb(null, user.data);
      } else {
        cb(null);
      }
    }
  });
};

User.prototype.delete = function(cb) {
  this.dataset.delete(this.key, cb);
};

User.prototype.create = function(profile, cb) {
  var dataToStore = Util.cleanDatastoreContents(profile);
  var entity = { key: this.key, data: dataToStore };
  this.dataset.save(entity, cb);
};

module.exports = User;
