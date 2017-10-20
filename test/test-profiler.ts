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

import * as assert from 'assert';
import * as delay from 'delay';
import * as extend from 'extend';
import * as nock from 'nock';
import * as sinon from 'sinon';
import {instance, mock, when} from 'ts-mockito';
import * as zlib from 'zlib';

import {ProfilerConfig} from '../src/config';
import {perftools} from '../src/profile';
import {Profiler} from '../src/profiler';
import {TimeProfiler} from '../src/profilers/time-profiler';

import {base64TestProfile, decodedTestProfile, testProfile} from './profiles-for-tests';

const v8TimeProfiler = require('bindings')('time_profiler');

const testConfig: ProfilerConfig = {
  projectId: 'test-projectId',
  logLevel: 1,
  serviceContext: {service: 'test-service', version: 'test-version'},
  instance: 'test-instance',
  zone: 'test-zone',
  disableTime: false,
  disableHeap: false
};
const API = 'https://cloudprofiler.googleapis.com/v2';

const mockTimeProfiler = mock(TimeProfiler);
when(mockTimeProfiler.profile(10 * 1000)).thenReturn(new Promise((resolve) => {
  resolve(testProfile);
}));

export function oauth2(): nock.Scope {
  return nock('https://accounts.google.com')
      .post('/o/oauth2/token', (body: any)=>{return true})
      .once()
      .reply(200, {
        refresh_token: 'hello',
        access_token: 'goodbye',
        expiry_date: new Date(9999, 1, 1)
      });
}

describe('Profiler', () => {
  describe('profile', () => {
    it('should return expected profile when profile type is WALL', async () => {
      const profiler = new Profiler(testConfig);
      profiler.timeProfiler = instance(mockTimeProfiler);
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        labels: {instance: 'test-instance', zone: 'test-zone'}
      };
      const prof = await profiler.profile(requestProf);
      assert.deepEqual(prof.profileBytes, base64TestProfile);
    });
  });
  describe('writeTimeProfile', () => {
    it('should return request with base64-encoded profile when time profiling' +
           ' enabled',
       async () => {
         const profiler = new Profiler(testConfig);
         profiler.timeProfiler = instance(mockTimeProfiler);

         const requestProf = {
           name: 'projects/12345678901/test-projectId',
           profileType: 'WALL',
           labels: {instance: 'test-instance', zone: 'test-zone'}
         };

         const outRequestProfile = await profiler.writeTimeProfile(requestProf);
         const encodedBytes = outRequestProfile.profileBytes;

         if (encodedBytes === undefined) {
           assert.fail('profile bytes are undefined.');
         }

         const decodedBytes = Buffer.from(encodedBytes as string, 'base64');
         const unzippedBytes = await new Promise<Buffer>((resolve, reject) => {
           zlib.gunzip(decodedBytes, (err: Error, result: Buffer) => {
             resolve(result);
           });
         });
         const outProfile = perftools.profiles.Profile.decode(unzippedBytes);

         // compare to decodedTestProfile, which is equivalent to testProfile,
         // but numbers are replaced with longs.
         assert.deepEqual(decodedTestProfile, outProfile);
       });
    it('should throw error when time profiling is not enabled', async () => {
      const config = extend(true, {}, testConfig);
      config.disableTime = true;
      const profiler = new Profiler(config);
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        labels: {instance: 'test-instance', zone: 'test-zone'}
      };
      try {
        await profiler.writeTimeProfile(requestProf);
        assert.fail('expected error, no error thrown');
      } catch (err) {
        assert.equal(
            err.message,
            'cannot collect time profile, time profiler not enabled');
      }
    });
  });
  describe('profileAndUpload', () => {
    // TODO: verify authentication.
    afterEach(() => {
      nock.cleanAll();
    });
    it('should send request to upload profile', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'WALL',
        labels: {instance: 'test-instance', zone: 'test-zone'}
      };
      const expProf =
          extend(true, {profileBytes: base64TestProfile}, testConfig);
      
      oauth2();
      const uploadProfileMock =
          nock(API)
              .patch('/' + requestProf.name)
              .reply(200, (uri: string, requestBody: any) => {
                assert.deepEqual(requestProf, requestBody);
              });

      const profiler = new Profiler(testConfig);
      profiler.timeProfiler = instance(mockTimeProfiler);
      await profiler.profileAndUpload(requestProf);
      assert.ok(uploadProfileMock.isDone(), 'expected call to upload profile');
    });
  });
  describe('createProfile', () => {
    afterEach(() => {
      nock.cleanAll();
    });
    it('should send request to create only wall profile when heap disabled',
       async () => {
         const config = extend(true, {}, testConfig);
         config.disableHeap = true;
         const response = {
           name: 'projects/12345678901/test-projectId',
           profileType: 'WALL',
           duration: '10s',
           labels: {instance: config.instance, zone: config.zone}
         };
        oauth2();
         const createProfileMock =
             nock(API)
                 .post('/projects/' + testConfig.projectId + '/profiles')
                 .reply(200, response);
         const profiler = new Profiler(testConfig);
         const actualResponse = await profiler.createProfile();
         assert.deepEqual(response, actualResponse);
         assert.ok(
             createProfileMock.isDone(), 'expected call to create profile');
       });
  });
});
