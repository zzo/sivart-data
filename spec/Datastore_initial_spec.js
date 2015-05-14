'use strict'
var Datastore = require('../Datastore');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('Datastore Initial', function() {
  var datastore;

  beforeEach(function() {
    datastore = new Datastore('zzo/angular');
  });

  it('gets the next build #', function(done) {
    datastore.getNextBuildNumber(function(err, number) {
      expect(err).toBeNull();
      expect(number).toBe(datastore.buildId);
      datastore.getNextBuildNumber(function(nerr, nnumber) {
        expect(nerr).toBeNull();
        expect(nnumber).toBe(number + 1);
        expect(nnumber).toBe(datastore.buildId);
        done();
      });
    });
  });

  it('fails the initial save w/o a build id', function(done) {
    datastore.saveInitialData({}, {}, {}, function(err, number) {
      expect(err).not.toBeNull();
      done();
    });
  });

  it('saves push build', function(done) {
    var metadata = { 
      kind: 'push',
      created: new Date().getTime(),
      state: 'running',
      branch: 'master'
    };

    datastore.getNextBuildNumber(function(err, number) {
      expect(err).toBeNull();
      datastore.saveInitialData([], {}, metadata, function(err, resp) {
        expect(err).toBeNull();
        done();
      });
    });
  });

  it('saves pr build', function(done) {
    var metadata = { 
      kind: 'pull_request',
      created: new Date().getTime(),
      state: 'running',
      branch: 'master'
    };

    datastore.getNextBuildNumber(function(err, number) {
      expect(err).toBeNull();
      datastore.saveInitialData([], {}, metadata, function(err, resp) {
        expect(err).toBeNull();
        done();
      });
    });
  });

  it('gets push builds', function(done) {
    datastore.getSomePushBuilds(function(err, builds) {
      expect(err).toBeNull();
      expect(builds.length).toBeTruthy('runs');
      done();
    });
  });

  it('gets pr builds', function(done) {
    datastore.getSomePRBuilds(function(err, builds) {
      expect(err).toBeNull();
      expect(builds.length).toBeTruthy('runs');
      done();
    });
  });

  it('gets a single build', function(done) {
    datastore.getABuild(69, function(err, build) {
      expect(err).toBeNull();
      expect(build).toBeTruthy();
      done();
    });
  });

  it('does not get a bad single build', function(done) {
    datastore.getABuild(6, function(err, build) {
      expect(err).toMatch(/does not exist/);
      expect(build).toBeUndefined();
      done();
    });
  });

});
