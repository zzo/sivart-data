'use strict';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

var ReadBuildData = require('../ReadBuildData');

describe('Get Builds', function() {
  var rdb;

  beforeEach(function() {
    rdb = new ReadBuildData('angular/angular');
  });

  it('find branches', function(done) {
    rdb.findBranch(96, function(err, branch) {
      expect(err).toBeNull();
      expect(branch).toBe('master');
      done();
    });
  });

  it('get build numbers', function(done) {
    rdb.getBuildNumbers('master', 96, function(err, files) {
      expect(err).toBeNull();
      console.log(files);
      done();
    });
  });

  it('get build files', function(done) {
    rdb.getBuildFilenames('master', 96, 2, function(err, files) {
      expect(err).toBeNull();
      console.log(files);
      done();
    });
  });


});
