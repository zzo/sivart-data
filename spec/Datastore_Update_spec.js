'use strict'
var Datastore = require('../Datastore');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

var metadata = { 
  kind: 'push',
  created: new Date().getTime(),
  state: 'running',
  branch: 'master'
};

var runs = [
  {
    buildNumber: 1,
  }
];


describe('Datastore update states', function() {
  var datastore;

  beforeEach(function() {
    datastore = new Datastore('zzo/angular');
  });

  it('updates an overall state', function(done) {
    var now = new Date().getTime();
    datastore.updateOverallState(69, String(now), now, function(err, data) {
      datastore.getABuild(69, function(err, build) {
        expect(err).toBeNull();
        expect(build.buildData.state).toBe(String(now));
        expect(build.buildData.totalRunTime).toBe(now);
        done();
      });
    });
  });

  it('updates a run state', function(done) {
    var now = new Date().getTime();
    datastore.getNextBuildNumber(function(err, number) {
      expect(err).toBeNull();
      datastore.saveInitialData(runs, {}, metadata, function(err, resp) {
        expect(err).toBeNull();

        datastore.updateRunState(number, 1, String(now), function(err, data) {
          datastore.getABuild(number, function(err, build) {
            expect(err).toBeNull();
            expect(build.runs[0].state).toBe(String(now));
            expect(build.runs[0].updated).toBeGreaterThan(now);
            done();
          });
        });
      });
    });
  });
});
