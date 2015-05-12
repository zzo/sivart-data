var ReadBuildData = require('../ReadBuildData');
jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe("ReadBuildData", function() {
  var rbd;

  beforeEach(function() {
    rbd = new ReadBuildData('angular/angular.js');
  });

  it("can be created", function() {
    expect(rbd).toBeDefined();
  });

  it("can get push builds", function(done) {
    rbd.getAllPushBuilds(function(err, builds) {
      console.log('push builds');
      console.log(builds);
      done();
    });
  });

  it("can get PR builds", function(done) {
    rbd.getAllPRBuilds(function(err, builds) {
      console.log('pr builds');
      console.log(builds);
      done();
    });
  });

  it("can get branch names", function(done) {
    rbd = new ReadBuildData('test/repo');
    rbd.getBranches(function(err, branches) {
      console.log('branches');
      console.log(branches);
      done();
    });
  });

  it("can get build numbers", function(done) {
    rbd = new ReadBuildData('test/repo');
    rbd.getBuilds('foobie', function(err, builds) {
      console.log('build #s');
      console.log(builds);
      done();
    });
  });

});

describe("ReadBuildData", function() {
  var rbd;

  beforeEach(function() {
    rbd = new ReadBuildData('angular/angular');
  });

  it("can get some push builds", function(done) {
    rbd.getSomePushBuilds(function(err, buildData) {
      expect(err).toBeNull();
      console.log(buildData);
      done();
    });
  });

  it("can get some PR builds", function(done) {
    rbd.getSomePRBuilds(function(err, buildData) {
      expect(err).toBeNull();
      console.log(buildData);
      done();
    });
  });

});
