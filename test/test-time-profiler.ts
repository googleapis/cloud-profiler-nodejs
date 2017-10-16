/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as delay from 'delay';
import * as simple from 'simple-mock';

import {perftools} from '../src/profile';
import {TimeProfiler} from '../src/profilers/time-profiler';

let assert = require('assert');
const v8TimeProfiler = require('bindings')('time_profiler');

const testProfile = {
  startTime: 0,
  endTime: 10 * 1000,
  topDownRoot: {
    callUid: 1,
    scriptResourceName: 'script1',
    functionName: 'main',
    lineNumber: 1,
    hitCount: 5,
    children: []
  }
};

describe('TimeProfiler', () => {
  describe('profile', () => {
    before(() => {
      simple.mock(v8TimeProfiler, 'startProfiling');
      simple.mock(v8TimeProfiler, 'stopProfiling').returnWith(testProfile);
      simple.mock(v8TimeProfiler, 'setSamplingInterval');
    });

    after(() => {
      simple.restore();
    });

    it('should profile during duration and finish profiling after duration',
       async () => {
         const duration = 500;
         const sampleInterval = 1000;
         let profiler = new TimeProfiler(sampleInterval);
         let profilePromise = profiler.profile(duration);
         await delay(2 * duration);
         assert.equal(false, profiler.isRunning(), 'profiler is still running');
       });

    it('should return a promise that resolves to a profile with sample types' +
           ' of time profile',
       async () => {
         const duration = 500;
         const sampleInterval = 1000;
         let profiler = new TimeProfiler(sampleInterval);
         let profile = await profiler.profile(duration);
         if (profile.sampleType !== undefined) {
           const vt1: perftools.profiles.IValueType = profile.sampleType[0];
           const vt2: perftools.profiles.IValueType = profile.sampleType[1];

           if (profile.stringTable !== undefined) {
             assert.equal(
                 profile.stringTable[vt1.type as number], 'samples',
                 'first sampleType has wrong type for time profile');
             assert.equal(
                 profile.stringTable[vt1.unit as number], 'count',
                 'first sampleType has wrong unit for time profile');
             assert.equal(
                 profile.stringTable[vt2.type as number], 'time',
                 'second sampleType has wrong type for time profile');
             assert.equal(
                 profile.stringTable[vt2.unit as number], 'microseconds',
                 'second sampleType has wrong unit for time profile');
           } else {
             assert.fail('profile does not have string table');
           }
         } else {
           assert.fail('profile sampleType is undefined');
         }
       });

    it('should return a profile with samples', async () => {
      const duration = 500;
      const sampleInterval = 1000;
      let profiler = new TimeProfiler(sampleInterval);
      let profile = await profiler.profile(duration);
      if (profile.sample !== undefined) {
        assert.ok(profile.sample.length > 0, 'there are no samples');
      } else {
        assert.fail('sample field of profile is undefined');
      }
    });

    it('should return rejected promise when already profiling', async () => {
      const sampleInterval = 1000;
      const profiler = new TimeProfiler(sampleInterval);
      profiler.profile(1000);
      try {
        await profiler.profile(500);
        assert.fail(
            'expected rejected promise, got promise which was not rejected');
      } catch (err) {
        assert.equal(err.message, 'already profiling with TimeProfiler');
      }
    });
  });
});
