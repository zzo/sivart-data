var fs = require('fs');
var projectId = 'focal-inquiry-92622';
var keyFilename = '/Users/trostler/sivart-6ddd2fa23c3b.json';
var gce_args = {
 projectId: projectId
};
try {
  fs.readFileSync(keyFilename);
  gce_args.keyFilename = keyFilename;
} catch(e) {}

module.exports = gce_args;
