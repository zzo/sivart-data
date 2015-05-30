'use strict';

'use strict'
var Filestore = require('../Filestore');
var fs = require('fs');
var path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 400000;

describe("Filestore get and delete", function() {
  var filestore;
  var branch = 'master';
  var buildId = 99;
  var buildNumber = 33;
  var f = 'Filestore.js';

  beforeEach(function() {
    filestore = new Filestore('test/filestore');
  });

  it('saves at repo level', function(done) {
    filestore.deleteFile(f, function(err, drez) {
      filestore.saveRepoFile(f, function(err, rez) {
        expect(err).toBeNull();
        filestore.get(f, function(err, file) {
          expect(err).toBeNull();
          var actual = fs.readFileSync(f, 'utf8');
          expect(file.toString()).toBe(actual);
          done();
        });
      });
    });
  });

  it('saves at branch level', function(done) {
    filestore.deleteBranchFiles(branch, function() {
      filestore.saveBranchFile(branch, f, function(err, rez) {
        expect(err).toBeNull();
        filestore.getBranchFileList(branch, function(err, files) {
          filestore.get(files[0], function(err, file) {
            expect(err).toBeNull();
            var actual = fs.readFileSync(f, 'utf8');
            expect(file.toString()).toBe(actual);
            done();
          });
        });
      });
    });
  });

  it('saves at build level', function(done) {
    filestore.deleteBuildFiles(buildId, function() {
      filestore.saveBuildFile(branch, buildId, f, function(err, rez) {
        expect(err).toBeNull();
        filestore.getBuildFileList(buildId, function(err, files) {
          expect(err).toBeNull();
          filestore.get(files[0], function(err, file) {
            expect(err).toBeNull();
            var actual = fs.readFileSync(f, 'utf8');
            expect(file.toString()).toBe(actual);
            done();
          });
        });
      });
    });
  });

  it('saves at run level', function(done) {
    filestore.deleteRunFiles(buildId, buildNumber, function() {
      filestore.saveBuildNumberFile(branch, buildId, buildNumber, f, function(err, rez) {
        expect(err).toBeNull();
        filestore.getRunFileList(buildId, buildNumber, function(err, files) {
          expect(err).toBeNull();
          filestore.get(files[0], function(err, file) {
            expect(err).toBeNull();
            var actual = fs.readFileSync(f, 'utf8');
            expect(file.toString()).toBe(actual);
            done();
          });
        });
      });
    });
  });

  it('saves a privateKey', function(done) {
    filestore.deleteRunFiles(buildId, buildNumber, function() {
      filestore.savePrivateKey(branch, buildId, buildNumber, 'PRIVATE KEY', function(err, rez) {
        expect(err).toBeNull();
        filestore.getPrivateKey(buildId, buildNumber, function(err, pk) {
          expect(err).toBeNull();
          expect(pk.toString()).toBe('PRIVATE KEY');
          done();
        });
      });
    });
  });

  it('saves a startup script', function(done) {
   filestore.deleteRunFiles(buildId, buildNumber, function() {
     filestore.saveStartupScript(branch, buildId, buildNumber, 'startup script', function(err, rez) {
       expect(err).toBeNull();
       filestore.getStartupScript(branch, buildId, buildNumber, function(err, script) {
         expect(err).toBeNull();
         expect(script.toString()).toBe('startup script');
         done();
       });
     });
   });
 });

});

