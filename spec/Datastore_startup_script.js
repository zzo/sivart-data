'use strict'
var Datastore = require('../Datastore');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Datastore get startup script', function() {
  var datastore;

  beforeEach(function() {
    datastore = new Datastore('angular/angular');
  });

  it('fetches a script', function(done) {
    datastore.getStartupScript(378, 1, function(err, script) {
      expect(err).toBeNull();
      expect(typeof script).toBe('string');
      console.log(script);
      done();
    });
  });
});
