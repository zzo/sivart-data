'use strict'
var Datastore = require('../Datastore');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Datastore get startup script', function() {
  var datastore;

  beforeEach(function() {
    datastore = new Datastore('zzo/angular');
  });

  it('fetches a script', function(done) {
    datastore.getStartupScript(221, 1, function(err, script) {
      expect(err).toBeNull();
      expect(typeof script).toBe('string');
      console.log(script);
      done();
    });
  });

  it('fetches a private key', function(done) {
    datastore.getPrivateKey(223, 3, function(err, key) {
      expect(err).toBeNull();
      expect(typeof key).toBe('string');
      console.log(key);
      done();
    });
  });

});
