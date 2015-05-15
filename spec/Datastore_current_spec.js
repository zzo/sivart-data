'use strict'
var Datastore = require('../Datastore');

//jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Datastore current', function() {
  var datastore;

  beforeEach(function() {
    datastore = new Datastore('angular/angular');
  });

  it('gets the next build #', function(done) {
    datastore.getCurrentBuild(function(err, build) {
      expect(err).toBeNull();
      done();
    });
  });

  it('gets the next build # unknown repo', function(done) {
    datastore = new Datastore('angular/ular');
    datastore.getCurrentBuild(function(err, build) {
      expect(err).not.toBeNull();
      expect(build).toBeUndefined();
      done();
    });
  });

});
