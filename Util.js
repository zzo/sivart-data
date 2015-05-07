module.exports = {

  // Buckets must begin with [a-z] and cannot end with '-'
  //   and must be globally unique and lower case and less than 64 chars length.
  makeBucketName: function(string) {
    var bucket = 'sivart-' + string.toLowerCase().replace(/[^0-9a-z-]/g, '-');
    while (bucket.match(/-$/)) {
      bucket = bucket.slice(0, - 1); 
    }
    return bucket.slice(0, 63);
  }
};
