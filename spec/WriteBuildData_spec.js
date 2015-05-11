var WriteBuildData = require('../WriteBuildData');
var ReadBuildData = require('../ReadBuildData');
var path = require('path');
var fs = require('fs');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe("WriteBuildData datastore tests", function() {
  var wbd;
  var buildId;

  beforeEach(function() {
    wbd = new WriteBuildData('a/repo/name', 'push');
  });

  it("can be created", function() {
    expect(wbd).toBeDefined();
  });

  it("can create a good bucket name", function() {
    expect(wbd.getBucketName()).toEqual('sivart-a-repo-name');
  });

  it("can get ids", function(done) {
    wbd.getNextBuildNumber(function(err, number) {
      expect(err).toBeNull();
      expect(typeof number).toEqual('number');
      wbd.getNextBuildNumber(function(err, newNumber) {
        expect(err).toBeNull();
        expect(newNumber).toBe(number + 1);
        done();
      });
    });
  });

  it("can store", function(done) {
    wbd.store([{ a: 3, state: 'fun' } , { b:5, state: 'somewhere' }], { meta: 'data'}, function(err) {
      expect(err).toBeNull();
      buildId = wbd.buildId;
      done();
    });
  });

  it("can update", function(done) {
    var rbd = new ReadBuildData('zzo/angular', 'push');
    rbd.getSomePushBuilds(function(err, builds) {
      var buildId = builds[0].__buildid;
      wbd = new WriteBuildData('zzo/angular', 'push');
      wbd.updateState(buildId, 1, 'NEWSTAT2', function(err) {
        expect(err).toBeNull();
        done();
      });
    });
  });
});

describe("WriteBuildData bucket tests", function() {
  var wbd;

  beforeEach(function() {
    wbd = new WriteBuildData('a/repo/name', 'push');
  });

  it("can write a file to a bucket", function(done) {
    wbd.writeFileToBucket(
      path.join(__dirname, 'WriteBuildData_spec.js'),
      'test/foo/goo/WBDS.js',
      function(err, ok) {
        expect(err).toBeNull();
        done();
      }
    );
  });

  it("can write files to a bucket", function(done) {
    var files = fs.readdirSync(__dirname)
      .map(function(file) {
        return path.join(__dirname, file);
      })
      .filter(function(file) {
        var stat = fs.lstatSync(file);
        return stat.isFile() && file.match(/\.js$/);
      });
    wbd.writeFilesToBucket(
      'path/to/files',
      files,
      function(err, ok) {
        expect(err).toBeUndefined();
        done();
      }
    );
  });
});