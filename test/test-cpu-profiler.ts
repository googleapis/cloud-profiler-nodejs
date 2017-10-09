import {perftools} from '../src/profile';
import {CpuProfiler} from '../src/profilers/cpu-profiler';
import {getIndexOrAdd} from '../src/util';

let assert = require('assert');

describe('CpuProfiler', function() {
  describe('profile', function() {
    it('should profile during duration and finish profiling by end of duration',
       function(done) {
         const duration = 500;
         const sampleInterval = 1000;
         let profiler = new CpuProfiler(sampleInterval);
         let profilePromise = profiler.profile(duration);
         assert.equal(true, profiler.isRunning(), 'profiler is not running');
         setTimeout(function() {
           assert.equal(
               false, profiler.isRunning(), 'profiler is still running');
           done();
         }, duration);
       });

    it('should return a promise that resolves to a profile with sample types' +
           ' of CPU profile',
       function(done) {
         const duration = 500;
         const sampleInterval = 1000;
         let profiler = new CpuProfiler(sampleInterval);
         let profilePromise = profiler.profile(duration);
         profilePromise.then(function(profile) {
           if (profile.sampleType !== undefined) {
             const vt1: perftools.profiles.IValueType = profile.sampleType[0];
             const vt2: perftools.profiles.IValueType = profile.sampleType[1];

             if (profile.stringTable !== undefined) {
               assert.equal(
                   profile.stringTable[vt1.type as number], 'samples',
                   'first sampleType has wrong type for CPU profile');
               assert.equal(
                   profile.stringTable[vt1.unit as number], 'count',
                   'first sampleType has wrong unit for CPU profile');
               assert.equal(
                   profile.stringTable[vt2.type as number], 'time',
                   'second sampleType has wrong type for CPU profile');
               assert.equal(
                   profile.stringTable[vt2.unit as number], 'microseconds',
                   'second sampleType has wrong unit for CPU profile');
             } else {
               assert.fail('profile does not have string table');
             }
           } else {
             assert.fail('profile sampleType is undefined');
           }
           done();
         });
       });

    it('should return a profile with samples', function(done) {
      const duration = 500;
      const sampleInterval = 1000;
      let profiler = new CpuProfiler(sampleInterval);
      let profilePromise = profiler.profile(duration);
      profilePromise.then(function(profile) {
        if (profile.sample !== undefined) {
          assert.ok(profile.sample.length > 0, 'there are no samples');
        } else {
          assert.fail('sample field of profile is undefined');
        }
        done();
      });
    });

    it('should return rejected promise when already profiling', function(done) {
      const sampleInterval = 1000;
      const profiler = new CpuProfiler(sampleInterval);
      profiler.profile(1000);
      let profilePromise = profiler.profile(500);
      profilePromise
          .then(function(profile) {
            assert.fail(
                'expected rejected promise, got promise which was not rejected');
            done();
          })
          .catch(function(err) {
            done();
          });
    });

  });
});
