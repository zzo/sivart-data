var util = require('../Util');

describe("Util", function() {
  describe("bucket names", function() {
    it("can lower case bucket name", function() {
      var name = util.makeBucketName('FOIE');
      expect(name).toMatch(/foie/);
    });

    it("can make a name the right length", function() {
      var longString = 'ewofjiwfoiwfeiojefwiojwefijoewfijoefwijowefijoefwijefwijefwijfjiewijfweijfewijfewijfewjifewjiefwijfew';
      var name = util.makeBucketName(longString);
      expect(name.length).toEqual(63);
    });

    it("can make a name start with a lowercase char", function() {
      var string = '9';
      var name = util.makeBucketName(string);
      expect(name).toMatch(/^[a-z]/);
    });

    it("can get rid of funny characters", function() {
      var string = '$#@@$#/234243$$##\\23232';
      var name = util.makeBucketName(string);
      expect(name).toMatch(/^[a-z][0-9a-z-]*[0-9a-z]$/);
    });

    it("can end with number or letter", function() {
      var string = '';
      var name = util.makeBucketName(string);
      expect(name).toMatch(/[0-9a-z]$/);

      string = '-------';
      name = util.makeBucketName(string);
      expect(name).toMatch(/[0-9a-z]$/);

      string = 'mark-';
      name = util.makeBucketName(string);
      expect(name).toMatch(/[0-9a-z]$/);
    });
  });
});
