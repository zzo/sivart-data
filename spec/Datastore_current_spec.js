'use strict'
var Datastore = require('../Datastore');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Datastore current', function() {
  var datastore;

  beforeEach(function() {
    datastore = new Datastore('zzo/angular');
  });

  it('gets the next build #', function(done) {
    datastore.getCurrentBuild(function(err, build) {
      expect(err).toBeNull();
      done();
    });
  });
});
