'use strict'
var Filestore = require('../Filestore');
var fs = require('fs');
var path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 400000;

var fileList = fs.readdirSync(__dirname).filter(function(file) {
  var stat = fs.lstatSync(path.join(__dirname, file));
  return file.match(/^[a-zA-Z0-9]/) && stat.isFile();
}).map(function(file) {
  return path.join(__dirname, file);
});

xdescribe("Filestore get and delete", function() {
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
    filestore.getBuildFileList(buildId, function(err, list) {
      expect(err).toBeNull();
      expect(list.length).toBe(fileList.length * 2);
      done();
    });
  });

  it('gets run files', function(done) {
    filestore.getRunFileList(buildId, buildNumber, function(err, list) {
      expect(err).toBeNull();
      expect(list.length).toBe(fileList.length);
      done();
    });
  });

  it('gets a log file', function(done) {
    var filename = fileList[3];  // Pick a random one
    filestore.getLogFile(buildId, buildNumber, path.basename(filename), function(err, contents) {
        expect(err).toBeNull();
        expect(contents.toString('utf8')).toBe(fs.readFileSync(filename, 'utf8'));
        done();
    });
  });

  it('writes a run file', function(done) {
    var f = '/tmp/foo';
    fs.writeFileSync(f, 'mark rox');
    filestore.saveRunFile(buildId, buildNumber, 'markymark', f, function(err) {
      expect(err).toBeNull();
      filestore.getLogFile(buildId, buildNumber, 'markymark', function(err, contents) {
        expect(err).toBeNull();
        expect(contents.toString()).toBe('mark rox');
        done();
      });
    });
  });

  it('deletes files', function(done) {
    filestore.deleteRunFiles(buildId, buildNumber, function(err) {
      expect(err).toBeNull();
      filestore.getBuildFileList(buildId, function(err, list) {
        expect(err).toBeNull();
        expect(list.length).toBe(list.length);
        done();
      });
    });
  });

  it('deletes build files', function(done) {
    filestore.deleteBuildFiles(buildId, function(err) {
      expect(err).toBeNull();
      filestore.getBuildFileList(buildId, function(err, list) {
        expect(err).not.toBeNull();
        done();
      });
    });
  });
});

xdescribe("Filestore get branch", function() {
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

xdescribe("Filestore get public URL", function() {
  var filestore;
  filestore = new Filestore('angular/angular');

  it('gets public url', function() {
    var url = filestore.getBasePublicURL('master', 44, 99);
    expect(url).toBe('sivart-angular-angular/branch-master/44/99');
  });
});

describe("Filestore branch list", function() {
  xit('gets branch files', function(done) {
    var filestore;
    filestore = new Filestore('zzo/angular');
    filestore.getBranchFileList('master', function(err, fileList) {
      expect(err).toBeNull();
      console.log(fileList);
      done();
    });
  });

  xit('gets all branch names', function(done) {
    var filestore;
    filestore = new Filestore('zzo/angular');
    filestore.getBranches(function(err, branches) {
      expect(err).toBeNull();
      expect(branches[0]).toBe('master');
      done();
    });
  });

  xit('deletes all branch files', function(done) {
    var filestore;
    filestore = new Filestore('zzo/angular.js');
    filestore.deleteBranchFiles('master', function(err) {
      expect(err).toBeNull();
      done();
    });
  });

  it('deletes all files in all branches', function(done) {
    var filestore = new Filestore('angular/angular');
    filestore.deleteAllBranches(function(err) {
      expect(err).toBeNull();
      done();
    });
  });

});
