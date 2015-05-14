'use strict'
var Datastore = require('../Datastore');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

var metadata = { 
  kind: 'push',
  created: new Date().getTime(),
  state: 'running',
  branch: 'master'
};

var TIME_DIFF = 5000;
var now = new Date().getTime();
var done = now + TIME_DIFF;

var runs = [
  {
    buildNumber: 1,
    created: now,
    updated: done
  },
  {
    buildNumber: 2,
    created: now,
    updated: done
  }
];


describe('Datastore update states', function() {
  var datastore;
  var buildId;

  beforeEach(function(done) {
    datastore = new Datastore('zzo/angular');
    datastore.getNextBuildNumber(function(err, number) {
      buildId = number;
      expect(err).toBeNull();
      datastore.saveInitialData(runs, {}, metadata, function(err, resp) {
        done();
      });
    });
  });

  it('gets total runtime', function(done) {
    datastore.getTotalRunTime(buildId, function(err, totalTime) {
      expect(err).toBeNull();
      expect(totalTime).toBe(TIME_DIFF * 2); // there are 2 runs
      done();
    });
  });

  it('updates an overall state', function(done) {
    var now = new Date().getTime();
    datastore.updateOverallState(buildId, String(now), now, function(err, data) {
      datastore.getABuild(buildId, function(err, build) {
        expect(err).toBeNull();
        expect(build.buildData.state).toBe(String(now));
        expect(build.buildData.totalRunTime).toBe(now);
        done();
      });
    });
  });

  it('updates a run state', function(done) {
    var now = new Date().getTime();
    datastore.updateRunState(buildId, 1, String(now), function(err, data) {
      datastore.getABuild(buildId, function(err, build) {
        expect(err).toBeNull();
        expect(build.runs[0].state).toBe(String(now));
        expect(build.runs[0].updated).toBeGreaterThan(now);
        done();
      });
    });
  });
});
