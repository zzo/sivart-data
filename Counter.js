'use strict';

// https://cloud.google.com/appengine/articles/sharding_counters
var Util = require('./Util');

function Counter(namespace, dataset) {
  this.kind = 'BuildCounter';
  this.dataset = dataset;
  this.namespace = namespace;
}

Counter.prototype.getCount = function(cb) {
  var key = this.dataset.key({ namespace: this.namespace, path: [ this.kind, '1' ] });
  this.dataset.get(key, function(err, entity) {
    if (err) {
      cb(err);
    } else {
      if (entity) {
        cb(null, entity.data.count);
      } else {
        cb(null, 0);
      }
    }
  });
};

Counter.prototype.increment = function(cb) {
  var key = this.dataset.key({
    namespace: this.namespace,
    path: [ this.kind, '1' ]
  });
  this.incrementPropertyTx(key, 'count', 1, 1, cb);
};

Counter.prototype.incrementPropertyTx = function(key, prop, increment, initialValue, cb) {
  var me = this;
  var value;
  var originalArguments = arguments;
  this.dataset.runInTransaction(function(transaction, done) {
    transaction.get(key, function(err, entity) {
      if (err) {
        transaction.rollback(done);
      } else {
        if (!entity) {
          entity = { key: key, data: {} };
          value = initialValue;
        } else {
          value = entity.data[prop] + increment;
        }
        entity.data[prop] = value;
        transaction.save(entity);
        done();
      }
    });
  },
  function(err) {
    var handler = Util.retryHandler.bind(me);
    handler(me.incrementPropertyTx, 'tries', originalArguments, err, value);
  });
};

module.exports = Counter;
