var Q = require('q');

module.exports = {

  // Buckets must begin with [a-z] and cannot end with '-'
  //   and must be globally unique and lower case and less than 64 chars length.
  makeBucketName: function(string) {
    var bucket = 'sivart-' + string.toLowerCase().replace(/[^0-9a-z-]/g, '-');
    while (bucket.match(/-$/)) {
      bucket = bucket.slice(0, - 1); 
    }
    return bucket.slice(0, 63);
  },

  // Cloud datastore does not like nulls or empty Objects - replace them with ''
  cleanDatastoreContents: function(data) {
    data = JSON.parse(JSON.stringify(data, function(k, v) {
      if (!v) {
        // Datasets don't like nulls in them - replace with empty strings
        return '';
      } else if (v instanceof Object && !Object.keys(v).length) {
        // Datasets also don't like empty objects!
        return ''; // or maybe { ____iamempty: 0 }?
      } else {
        return v;
      }
    }));

    return data;
  },

  dealWithAllPromises: function(promises, cb) {
    Q.allSettled(promises).then(function(results) {
      var successResponses =
        results
          .filter(function(result) {
            return result.state === 'fulfilled';
          })
          .map(function(success) {
            return success.value;
          });

      var failedResponses =
        results
          .filter(function(result) {
            return result.state === 'rejected';
          })
          .map(function(failed) {
            return failed.reason;
          });

      if (failedResponses.length) {
        cb(failedResponses, successResponses);
      } else {
        cb(null);
      }
    });
  }
};
