'use strict';

var Filestore = require('./Filestore');
var repo = process.argv[2];
console.log('Delete all branch files from', repo, 'in 5 seconds...');

setTimeout(function() {
  var filestore = new Filestore(repo);
  filestore.deleteAllBranches(function(err) {
    console.log(err);
  });
}, 5000);
