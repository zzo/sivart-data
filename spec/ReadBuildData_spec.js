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

  it("can get all files in a bucket", function(done) {
    rbd.getBranches(function(err, branches) {
      console.log('branches');
      console.log(branches);
      done();
    });
  });


});
