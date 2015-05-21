'use strict'
var Filestore = require('../Filestore');
var fs = require('fs');
var path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 40000;

var fileList = fs.readdirSync(__dirname).filter(function(file) {
  var stat = fs.lstatSync(path.join(__dirname, file));
  return file.match(/^[a-zA-Z0-9]/) && stat.isFile();
}).map(function(file) {
  return path.join(__dirname, file);
});

describe("Filestore get and delete", function() {
  var filestore;
  var branch = 'master';
  var buildId = 99;
  var buildNumber = 33;

  beforeEach(function() {
    filestore = new Filestore('test/filestore');
  });

  it('saves files', function(done) {
    var prefix = path.join('branch-' + branch, String(buildId), String(buildNumber));
    filestore.persistFiles(prefix, fileList, function(err) {
      expect(err).toBeNull();

      var prefix = path.join('branch-' + branch, String(buildId), String(buildNumber + 1));
      filestore.persistFiles(prefix, fileList, function(err) {
        expect(err).toBeNull();
        done();
      });
    });

  });

  it('gets build files', function(done) {
    filestore.getBuildFileList(branch, buildId, function(err, list) {
      expect(err).toBeNull();
      expect(list.length).toBe(fileList.length * 2);
      done();
    });
  });

  it('gets run files', function(done) {
    filestore.getRunFileList(branch, buildId, buildNumber, function(err, list) {
      expect(err).toBeNull();
      expect(list.length).toBe(fileList.length);
      done();
    });
  });

  it('deletes files', function(done) {
    filestore.deleteRunFiles(branch, buildId, buildNumber, function(err) {
      expect(err).toBeNull();
      filestore.getBuildFileList(branch, buildId, function(err, list) {
        expect(err).toBeNull();
        expect(list.length).toBe(list.length);
        done();
      });
    });
  });

  it('deletes build files', function(done) {
    filestore.deleteBuildFiles(branch, buildId, function(err) {
      expect(err).toBeNull();
      filestore.getBuildFileList(branch, buildId, function(err, list) {
        expect(err).toBeNull();
        expect(list.length).toBe(0);
        done();
      });
    });
  });
});

describe("Filestore get branch", function() {
  var filestore;

  beforeEach(function() {
    filestore = new Filestore('angular/angular');
  });

  it('finds the branch', function(done) {
    filestore.getBranch(273, function(err, branch) {
      expect(err).toBeNull();
      expect(branch).toBe('master');
      done();
    });
  });

  it('finds the branch', function(done) {
    filestore.getBranch(314, function(err, branch) {
      expect(err).toBeNull();
      expect(branch).toBe('2.0.0-alpha.24');
      done();
    });
  });

  it('does not find the branch', function(done) {
    filestore.getBranch(3, function(err, branch) {
      expect(err).toBe('Cannot find branch for buildId 3');
      done();
    });
  });


});
