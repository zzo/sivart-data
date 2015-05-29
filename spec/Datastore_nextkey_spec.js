'use strict'
var Datastore = require('../Datastore');
var Q = require('q');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe('Datastore update states', function() {
  var datastore;

  beforeEach(function() {
    datastore = new Datastore('test/repo');
  });

  it('gets the next build number a bunch', function(done) {
    var datastores = [];
    for(var i = 0; i < 10; i++) {
      datastores.push(new Datastore('test/repo'));
    }

    var promises = datastores.map(function(datastore) {
      return Q.ninvoke(datastore, 'getNextBuildNumber');
    });

    Q.all(promises).then(function(results) {
      console.log(JSON.stringify(results));
      var hash = {};
      results.forEach(function(result) {
        hash[result] = 1;
      });
      expect(results.length).toBe(Object.keys(hash).length);
      done();
    });
  });
});
