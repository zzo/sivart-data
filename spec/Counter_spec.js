var Counter = require('../Counter');
var Util = require('../Util');
var Auth = require('../Auth');
var gcloud = require('gcloud');
var Q = require('q');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000000;

describe("Counter", function() {
  beforeEach(function() {
    this.namespace = Util.makeBucketName('test/repo');
    this.dataset = gcloud.datastore.dataset(Auth);
    this.myCounter = new Counter(this.namespace, this.dataset);
  });

  afterEach(function(done) {
    // delete the counters & shard counter
    var myCounter = this.myCounter;
    var counterKey = myCounter.dataset.key({namespace: myCounter.namespace, path: ['BuildCounter', '1' ]});
    this.myCounter.dataset.delete(counterKey, done);
  });

  it("can create", function() {
    expect(this.myCounter.namespace).toBe(Util.makeBucketName('test/repo'));
    expect(this.myCounter.kind).toBe('BuildCounter');
  });
 
  it("counts zero first", function(done) {
    this.myCounter.getCount(function(err, count) {
      expect(err).toBeNull();
      expect(count).toBe(0);
      done();
    });
  });

  it("can increment", function(done) {
    var me = this;
    this.myCounter.increment(function(err) {
      expect(err).toBeNull();
      me.myCounter.getCount(function(cerr, count) {
        expect(cerr).toBeNull();
        expect(count).toBe(1);
        done();
      });
    });
  });

  it("can go apeshit", function(done) {
    var me = this;
    var counters = [];
    for (var i = 0; i < 100; i++) {
      counters.push(new Counter(this.namespace, this.dataset));
    }
    var promises = counters.map(function(counter) {
      return Q.ninvoke(counter, 'increment');
    });
    Q.all(promises).then(function(results) {
      // ensure these are all unique values
      console.log('-----');
      console.log(results.sort());
      console.log('-----');
      var hash = {};
      results.forEach(function(result) {
        hash[result] = 1;
      });
      expect(results.length).toBe(Object.keys(hash).length);
      done();
    })
    .catch(function(err) {
      done.fail(err);
    });
  });

});
