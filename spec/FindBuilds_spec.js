'use strict';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

var ReadBuildData = require('../ReadBuildData');
var path = require('path');

describe('Get Builds', function() {
  var rdb;

  beforeEach(function() {
    rdb = new ReadBuildData('angular/angular');
  });

  xit('get build numbers', function(done) {
    rdb.getBuildNumbers('master', 96, function(err, files) {
      expect(err).toBeNull();
      console.log(files);
      done();
    });
  });

  xit('get build files', function(done) {
    rdb.getBuildFilenames('master', 96, 2, function(err, files) {
      expect(err).toBeNull();
      console.log(files);
      done();
    });
  });

  it('gets main log file', function(done) {
    rdb = new ReadBuildData('zzo/angular');
    rdb.getMainLogFile('master', 12, 1, function(err, contents) {
      if (err) {
        console.log(err.code + ' ' + err.message);
      } else {
        expect(err).toBeNull();
        console.log(contents.toString());
      }
      done();
    });
  });

  it('gets last log file', function(done) {
    rdb = new ReadBuildData('zzo/angular');
    rdb.getLastLog('master', 12, 1, function(err, contents) {
      if (err) {
        console.log(err.code + ' ' + err.message);
      } else {
        expect(err).toBeNull();
        console.log(contents.toString());
      }
      done();
    });
  });

  xit('gets a files', function(done) {
    rdb = new ReadBuildData('zzo/angular');
    var user_script = path.join('12', '1', 'user-script.log');
    rdb.getFile('master', user_script, function(err, contents) {
      if (err) {
        console.log(err.code + ' ' + err.message);
      } else {
        expect(err).toBeNull();
        console.log(contents.toString());
      }
      done();
    });
  });
});
