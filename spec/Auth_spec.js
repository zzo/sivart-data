describe("Auth", function() {
  it("has the right project", function() {
    var Auth = require('../Auth');
    var projectId = 'focal-inquiry-92622';
    expect(Auth.projectId).toEqual(projectId);
  });

  it("has a keyFilename", function() {
    var Auth = require('../Auth');
    expect(Auth.keyFilename).toBeDefined();
  });
});
