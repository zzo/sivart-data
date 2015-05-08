var WriteBuildData = require('../WriteBuildData');
jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe("WriteBuildData", function() {
  var wbd;

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
    wbd.store([ { a: 3} , {b:5}], { meta: 'data'}, function(err) {
      expect(err).toBeNull();
      done();
    });
  });
});
