'use strict'
var User = require('../User');


describe('User', function() {
  var user;

  beforeEach(function() {
    user = new User('mark@zzo.com');
  });

  it('saves a user', function(done) {
    user.create({ foo: 'goo' }, function(err) {
      expect(err).toBeNull();
      done();
    });
  });

  it('checks a user', function(done) {
    user.get(function(err, user) {
      expect(err).toBeNull();
      expect(user.foo).toBe('goo');
      done();
    });
  });

  it('deletes', function(done) {
    user.delete(function(err) {
      expect(err).toBeNull();
      done();
    });
  });

  it('checks a user does not exist', function(done) {
    user.get(function(err, user) {
      expect(err).toBeNull();
      expect(user).toBeUndefined();
      done();
    });
  });

});

