var WriteBuildData = require('../WriteBuildData');
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

});
