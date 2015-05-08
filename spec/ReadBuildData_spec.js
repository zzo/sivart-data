var ReadBuildData = require('../ReadBuildData');
jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe("ReadBuildData", function() {
  var rbd;

  beforeEach(function() {
    rbd = new ReadBuildData('a/repo/name');
  });

  it("can be created", function() {
    expect(rbd).toBeDefined();
  });

  it("can get push builds", function(done) {
    rbd.getAllPushBuilds(function(err, builds) {
      console.log(builds);
      done();
    });
  });
});
