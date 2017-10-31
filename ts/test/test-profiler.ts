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
import * as extend from 'extend';
import * as nock from 'nock';
import * as pify from 'pify';
import * as sinon from 'sinon';
import {instance, mock, when} from 'ts-mockito';
import * as zlib from 'zlib';

import {perftools} from '../../proto/profile';
import {ProfilerConfig} from '../src/config';
import {Profiler} from '../src/profiler';
import {TimeProfiler} from '../src/profilers/time-profiler';
import {Common} from '../third_party/types/common-types';

import {base64TimeProfile, decodedTimeProfile, timeProfile} from './profiles-for-tests';

const common: Common = require('@google-cloud/common');
const v8TimeProfiler = require('bindings')('time_profiler');

const fakeCredentials =
    require('../../ts/test/fixtures/gcloud-credentials.json');

const testConfig: ProfilerConfig = {
  projectId: 'test-projectId',
  logLevel: 1,
  serviceContext: {service: 'test-service', version: 'test-version'},
  instance: 'test-instance',
  zone: 'test-zone',
  disableTime: false,
  disableHeap: false,
  credentials: fakeCredentials,
  timeSamplingIntervalMicros: 1000,
  backoffMillis: 1000,  // 1 second
};

const API = 'https://cloudprofiler.googleapis.com/v2';

const mockTimeProfiler = mock(TimeProfiler);
when(mockTimeProfiler.profile(10 * 1000)).thenReturn(new Promise((resolve) => {
  resolve(timeProfile);
}));

nock.disableNetConnect();
function nockOauth2(): nock.Scope {
  return nock('https://accounts.google.com')
      .post(
          '/o/oauth2/token',
          (body: any) => {
            return true;
          })
      .once()
      .reply(200, {
        refresh_token: 'hello',
        access_token: 'goodbye',
        expiry_date: new Date(9999, 1, 1)
      });
}

afterEach(() => {
  nock.cleanAll();
});

describe('Profiler', () => {
  describe('profile', () => {
    it('should return expected profile when profile type is WALL.',
       async () => {
         const profiler = new Profiler(testConfig);
         profiler.timeProfiler = instance(mockTimeProfiler);
         const requestProf = {
           name: 'projects/12345678901/test-projectId',
           profileType: 'WALL',
           duration: '10s',
           labels: {instance: 'test-instance', zone: 'test-zone'}
         };
         const prof = await profiler.profile(requestProf);
         assert.deepEqual(prof.profileBytes, base64TimeProfile);
       });
    it('should throw error when unexpected profile type is requested.',
       async () => {
         const profiler = new Profiler(testConfig);
         profiler.timeProfiler = instance(mockTimeProfiler);
         const requestProf = {
           name: 'projects/12345678901/test-projectId',
           profileType: 'UNKNOWN',
           duration: '10s',
           labels: {instance: 'test-instance', zone: 'test-zone'}
         };
         try {
           await profiler.profile(requestProf);
           assert.fail('Expected an error to be thrown,');
         } catch (err) {
           assert.equal(err.message, 'Unexpected profile type UNKNOWN.');
         }
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
           duration: '10s',
           labels: {instance: 'test-instance', zone: 'test-zone'}
         };

         const outRequestProfile = await profiler.writeTimeProfile(requestProf);
         const encodedBytes = outRequestProfile.profileBytes;

         if (encodedBytes === undefined) {
           assert.fail('profile bytes are undefined.');
         }

         const decodedBytes = Buffer.from(encodedBytes as string, 'base64');
         const unzippedBytes = await pify(zlib.gunzip)(decodedBytes);
         const outProfile = perftools.profiles.Profile.decode(unzippedBytes);

         // compare to decodedTimeProfile, which is equivalent to timeProfile,
         // but numbers are replaced with longs.
         assert.deepEqual(decodedTimeProfile, outProfile);
       });
    it('should throw error when time profiling is not enabled.', async () => {
      const config = extend(true, {}, testConfig);
      config.disableTime = true;
      const profiler = new Profiler(config);
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        labels: {instance: 'test-instance', zone: 'test-zone'}
      };
      try {
        await profiler.writeTimeProfile(requestProf);
        assert.fail('expected error, no error thrown');
      } catch (err) {
        assert.equal(
            err.message,
            'Cannot collect time profile, time profiler not enabled.');
      }
    });
  });
  describe('profileAndUpload', () => {
    it('should send request to upload profile.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'WALL',
        labels: {instance: 'test-instance', zone: 'test-zone'}
      };
      const expProf =
          extend(true, {profileBytes: base64TimeProfile}, testConfig);
      nockOauth2();
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
    it('should not retry when error thrown by http request.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'WALL',
        labels: {instance: 'test-instance', zone: 'test-zone'}
      };
      const requestStub =
          sinon.stub(common.ServiceObject.prototype, 'request')
              .returns(Promise.reject(new Error('Network error')));
      const profiler = new Profiler(testConfig);
      profiler.timeProfiler = instance(mockTimeProfiler);
      await profiler.profileAndUpload(requestProf);
      assert.equal(requestStub.callCount, 1, 'request should be made once');
      (common.ServiceObject.prototype.request as any).restore();
    });
    it('should not retry when non-200 status code returned.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'WALL',
        labels: {instance: 'test-instance', zone: 'test-zone'}
      };
      const requestStub = sinon.stub(common.ServiceObject.prototype, 'request')
                              .returns(new Promise(resolve => {
                                resolve([{}, {statusCode: 500}]);
                              }));
      const profiler = new Profiler(testConfig);
      profiler.timeProfiler = instance(mockTimeProfiler);
      await profiler.profileAndUpload(requestProf);
      assert.equal(requestStub.callCount, 1, 'request should be made once');
      (common.ServiceObject.prototype.request as any).restore();
    });
  });
  describe('createProfile', () => {
    it('should send request to create only wall profile when heap disabled.',
       async () => {
         const config = extend(true, {}, testConfig);
         config.disableHeap = true;
         const response = {
           name: 'projects/12345678901/test-projectId',
           profileType: 'WALL',
           duration: '10s',
           labels: {instance: config.instance, zone: config.zone}
         };
         nockOauth2();
         const createProfileMock =
             nock(API)
                 .post('/projects/' + testConfig.projectId + '/profiles')
                 .once()
                 .reply(200, response);
         const profiler = new Profiler(testConfig);
         const actualResponse = await profiler.createProfile();
         assert.deepEqual(response, actualResponse);
         assert.ok(
             createProfileMock.isDone(), 'expected call to create profile');
       });
    it('should retry when error thrown by http request.', async () => {
      const config = extend(true, {}, testConfig);
      config.disableHeap = true;
      const response = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        labels: {instance: config.instance, zone: config.zone}
      };
      const requestStub =
          sinon.stub(common.ServiceObject.prototype, 'request')
              .onCall(0)
              .returns(Promise.reject(new Error('Network error')))
              .onCall(1)
              .returns(new Promise(resolve => {
                resolve([response, {statusCode: 200}]);
              }));
      const profiler = new Profiler(testConfig);
      const actualResponse = await profiler.createProfile();
      assert.equal(requestStub.callCount, 2, 'request should be made twice');
      assert.deepEqual(response, actualResponse);
      (common.ServiceObject.prototype.request as any).restore();
    });
    it('should retry when non-200 status code returned.', async () => {
      const config = extend(true, {}, testConfig);
      config.disableHeap = true;
      const response = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        labels: {instance: config.instance, zone: config.zone}
      };
      const requestStub = sinon.stub(common.ServiceObject.prototype, 'request')
                              .onCall(0)
                              .returns(new Promise(resolve => {
                                resolve([{}, {statusCode: 500}]);
                              }))
                              .onCall(1)
                              .returns(new Promise(resolve => {
                                resolve([response, {statusCode: 200}]);
                              }));

      const profiler = new Profiler(testConfig);
      const actualResponse = await profiler.createProfile();
      assert.deepEqual(response, actualResponse);
      assert.equal(requestStub.callCount, 2, 'request should be made twice');
      (common.ServiceObject.prototype.request as any).restore();
    });
  });
});
