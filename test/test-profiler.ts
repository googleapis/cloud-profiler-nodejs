// Copyright 2017 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as common from '@google-cloud/common';
import {
  BodyResponseCallback,
  DecorateRequestOptions,
} from '@google-cloud/common';
import * as assert from 'assert';
import {describe, it, beforeEach, afterEach, before, after} from 'mocha';
import * as extend from 'extend';
import * as nock from 'nock';
import {heap as heapProfiler, time as timeProfiler} from 'pprof';
import * as sinon from 'sinon';
import {promisify} from 'util';
import * as zlib from 'zlib';

import {perftools} from 'pprof/proto/profile';
import {ProfilerConfig} from '../src/config';
import {
  parseBackoffDuration,
  Profiler,
  Retryer,
  BackoffResponseError,
} from '../src/profiler';

import {
  decodedHeapProfile,
  decodedTimeProfile,
  heapProfile,
  timeProfile,
} from './profiles-for-tests';

import parseDuration from 'parse-duration';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fakeCredentials = require('../../test/fixtures/gcloud-credentials.json');

const API = 'cloudprofiler.googleapis.com';
const TEST_API = 'test-cloudprofiler.sandbox.googleapis.com';

const FULL_API = `https://${API}/v2`;
const FULL_TEST_API = `https://${TEST_API}/v2`;

const testConfig: ProfilerConfig = {
  projectId: 'test-projectId',
  logLevel: 0,
  serviceContext: {service: 'test-service', version: 'test-version'},
  instance: 'test-instance',
  zone: 'test-zone',
  disableTime: false,
  disableHeap: false,
  credentials: fakeCredentials,
  timeIntervalMicros: 1000,
  heapIntervalBytes: 512 * 1024,
  heapMaxStackDepth: 64,
  ignoreHeapSamplesPath: '@google-cloud/profiler',
  initialBackoffMillis: 1000,
  backoffCapMillis: parseDuration('1h')!,
  backoffMultiplier: 1.3,
  serverBackoffCapMillis: parseDuration('7d')!,
  localProfilingPeriodMillis: 1000,
  localTimeDurationMillis: 1000,
  localLogPeriodMillis: 1000,
  sourceMapSearchPath: [],
  disableSourceMaps: true,
  apiEndpoint: API,
};

nock.disableNetConnect();
function nockOauth2(): nock.Scope {
  return nock('https://oauth2.googleapis.com')
    .post(/\/token/, () => true)
    .once()
    .reply(200, {
      refresh_token: 'hello',
      access_token: 'goodbye',
      expiry_date: new Date(9999, 1, 1),
    });
}

describe('Retryer', () => {
  it('should backoff until max-backoff reached', () => {
    const retryer = new Retryer(1000, 1000000, 5, () => 0.5);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 1000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 5000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 25000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 125000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 625000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 1000000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 1000000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 1000000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 1000000);
    assert.strictEqual(retryer.getBackoff(), 0.5 * 1000000);
  });
});

describe('Profiler', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sinonStubs: Array<sinon.SinonStub<any, any>> = [];
  beforeEach(() => {
    sinonStubs.push(sinon.stub(timeProfiler, 'start'));
    sinonStubs.push(
      sinon.stub(timeProfiler, 'profile').returns(Promise.resolve(timeProfile))
    );

    sinonStubs.push(sinon.stub(heapProfiler, 'stop'));
    sinonStubs.push(sinon.stub(heapProfiler, 'start'));
    sinonStubs.push(sinon.stub(heapProfiler, 'profile').returns(heapProfile));
  });
  afterEach(() => {
    nock.cleanAll();
    sinonStubs.forEach(stub => {
      stub.restore();
    });
  });
  describe('profile', () => {
    it('should return expected profile when profile type is WALL.', async () => {
      const profiler = new Profiler(testConfig);
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        labels: {instance: 'test-instance'},
      };
      const prof = await profiler.profile(requestProf);
      const decodedBytes = Buffer.from(prof.profileBytes as 'string', 'base64');
      const unzippedBytes = (await promisify(zlib.gunzip)(
        decodedBytes
      )) as Uint8Array;
      const outProfile = perftools.profiles.Profile.decode(unzippedBytes);
      assert.deepStrictEqual(decodedTimeProfile, outProfile);
    });
    it('should return expected profile when profile type is HEAP.', async () => {
      const profiler = new Profiler(testConfig);
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'HEAP',
        labels: {instance: 'test-instance'},
      };
      const prof = await profiler.profile(requestProf);
      const decodedBytes = Buffer.from(prof.profileBytes as 'string', 'base64');
      const unzippedBytes = (await promisify(zlib.gunzip)(
        decodedBytes
      )) as Uint8Array;
      const outProfile = perftools.profiles.Profile.decode(unzippedBytes);
      assert.deepStrictEqual(decodedHeapProfile, outProfile);
    });
    it('should throw error when unexpected profile type is requested.', async () => {
      const profiler = new Profiler(testConfig);
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'UNKNOWN',
        duration: '10s',
        labels: {instance: 'test-instance'},
      };
      try {
        await profiler.profile(requestProf);
        assert.fail('Expected an error to be thrown,');
      } catch (err) {
        assert.strictEqual(
          (err as Error).message,
          'Unexpected profile type UNKNOWN.'
        );
      }
    });
  });
  describe('writeTimeProfile', () => {
    it(
      'should return request with base64-encoded profile when time profiling' +
        ' enabled',
      async () => {
        const profiler = new Profiler(testConfig);

        const requestProf = {
          name: 'projects/12345678901/test-projectId',
          profileType: 'WALL',
          duration: '10s',
          labels: {instance: 'test-instance'},
        };

        const outRequestProfile = await profiler.writeTimeProfile(requestProf);
        const encodedBytes = outRequestProfile.profileBytes;

        if (encodedBytes === undefined) {
          assert.fail('profile bytes are undefined.');
        }

        const decodedBytes = Buffer.from(encodedBytes as string, 'base64');
        const unzippedBytes = (await promisify(zlib.gunzip)(
          decodedBytes
        )) as Uint8Array;
        const outProfile = perftools.profiles.Profile.decode(unzippedBytes);

        // compare to decodedTimeProfile, which is equivalent to timeProfile,
        // but numbers are replaced with longs.
        assert.deepStrictEqual(decodedTimeProfile, outProfile);
      }
    );
    it('should throw error when time profiling is not enabled.', async () => {
      const config = extend(true, {}, testConfig);
      config.disableTime = true;
      const profiler = new Profiler(config);
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        labels: {instance: 'test-instance'},
      };
      try {
        await profiler.writeTimeProfile(requestProf);
        assert.fail('expected error, no error thrown');
      } catch (err) {
        assert.strictEqual(
          (err as Error).message,
          'Cannot collect time profile, time profiler not enabled.'
        );
      }
    });
  });
  describe('writeHeapProfile', () => {
    it(
      'should return request with base64-encoded profile when time profiling' +
        ' enabled',
      async () => {
        const profiler = new Profiler(testConfig);

        const requestProf = {
          name: 'projects/12345678901/test-projectId',
          profileType: 'HEAP',
          labels: {instance: 'test-instance'},
        };

        const outRequestProfile = await profiler.writeHeapProfile(requestProf);
        const encodedBytes = outRequestProfile.profileBytes;

        if (encodedBytes === undefined) {
          assert.fail('profile bytes are undefined.');
        }

        const decodedBytes = Buffer.from(encodedBytes as string, 'base64');
        const unzippedBytes = (await promisify(zlib.gunzip)(
          decodedBytes
        )) as Uint8Array;
        const outProfile = perftools.profiles.Profile.decode(unzippedBytes);

        // compare to decodedTimeProfile, which is equivalent to timeProfile,
        // but numbers are replaced with longs.
        assert.deepStrictEqual(decodedHeapProfile, outProfile);
      }
    );
    it('should throw error when heap profiling is not enabled.', async () => {
      const config = extend(true, {}, testConfig);
      config.disableHeap = true;
      const profiler = new Profiler(config);
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'HEAP',
        labels: {instance: 'test-instance'},
      };
      try {
        await profiler.writeHeapProfile(requestProf);
        assert.fail('expected error, no error thrown');
      } catch (err) {
        assert.strictEqual(
          (err as Error).message,
          'Cannot collect heap profile, heap profiler not enabled.'
        );
      }
    });
  });
  describe('profileAndUpload', () => {
    let requestStub:
      | undefined
      | sinon.SinonStub<[DecorateRequestOptions, BodyResponseCallback], void>;
    afterEach(() => {
      if (requestStub) {
        requestStub.restore();
      }
    });
    it('should send request to upload time profile.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'WALL',
        labels: {instance: 'test-instance'},
      };

      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .onCall(0)
        .callsArgWith(1, null, {}, {statusCode: 200});

      const profiler = new Profiler(testConfig);
      await profiler.profileAndUpload(requestProf);

      const uploaded = requestStub.firstCall.args[0].body as {
        profileBytes?: string;
      };
      const decodedBytes = Buffer.from(
        uploaded.profileBytes as string,
        'base64'
      );
      const unzippedBytes = (await promisify(zlib.gunzip)(
        decodedBytes
      )) as Uint8Array;
      const outProfile = perftools.profiles.Profile.decode(unzippedBytes);
      assert.deepStrictEqual(decodedTimeProfile, outProfile);

      uploaded.profileBytes = undefined;
      assert.deepStrictEqual(uploaded, requestProf);
    });
    it('should send request to upload heap profile.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'HEAP',
        labels: {instance: 'test-instance'},
      };

      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .onCall(0)
        .callsArgWith(1, null, {}, {statusCode: 200});

      const profiler = new Profiler(testConfig);
      await profiler.profileAndUpload(requestProf);
      const uploaded = requestStub.firstCall.args[0].body as {
        profileBytes?: string;
      };
      const decodedBytes = Buffer.from(
        uploaded.profileBytes as string,
        'base64'
      );
      const unzippedBytes = (await promisify(zlib.gunzip)(
        decodedBytes
      )) as Uint8Array;
      const outProfile = perftools.profiles.Profile.decode(unzippedBytes);
      assert.deepStrictEqual(decodedHeapProfile, outProfile);

      uploaded.profileBytes = undefined;
      assert.deepStrictEqual(uploaded, requestProf);
    });
    it('should not uploaded when profile type unknown.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'UNKNOWN_PROFILE_TYPE',
        labels: {instance: 'test-instance'},
      };
      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .onCall(0)
        .callsArgWith(1, null, {}, {});
      const profiler = new Profiler(testConfig);
      await profiler.profileAndUpload(requestProf);
      assert.strictEqual(0, requestStub.callCount);
    });
    it('should ignore error thrown by http request.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'WALL',
        labels: {instance: 'test-instance'},
      };
      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .callsArgWith(1, new Error('Network error'), {}, {});
      const profiler = new Profiler(testConfig);
      await profiler.profileAndUpload(requestProf);
    });
    it('should ignore when non-200 status code returned.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'WALL',
        labels: {instance: 'test-instance'},
      };
      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .callsArgWith(
          1,
          null,
          {},
          {statusCode: 500, statusMessage: 'Error 500'}
        );
      const profiler = new Profiler(testConfig);
      await profiler.profileAndUpload(requestProf);
    });
    it('should not retry on non-200 status codes', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'WALL',
        labels: {instance: 'test-instance'},
      };
      nockOauth2();
      const apiMock = nock(FULL_API)
        .patch('/' + requestProf.name)
        .once()
        .reply(500)
        .patch('/' + requestProf.name)
        .once()
        .reply(200);
      const profiler = new Profiler(testConfig);
      await profiler.profileAndUpload(requestProf);
      assert.strictEqual(
        apiMock.isDone(),
        false,
        'call to upload profile should not be retried'
      );
    });
    it('should send request to upload profile to default API without error.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'HEAP',
        labels: {instance: 'test-instance'},
      };
      nockOauth2();
      const apiMock = nock(FULL_API)
        .patch('/' + requestProf.name)
        .once()
        .reply(200);
      const profiler = new Profiler(testConfig);
      await profiler.profileAndUpload(requestProf);
      assert.strictEqual(apiMock.isDone(), true, 'completed call to real API');
    });
    it('should send request to upload profile to non-default API without error.', async () => {
      const requestProf = {
        name: 'projects/12345678901/test-projectId',
        duration: '10s',
        profileType: 'HEAP',
        labels: {instance: 'test-instance'},
      };
      nockOauth2();
      const apiMock = nock(FULL_TEST_API)
        .patch('/' + requestProf.name)
        .once()
        .reply(200);
      const config = extend(true, {}, testConfig);
      config.apiEndpoint = TEST_API;
      const profiler = new Profiler(config);
      await profiler.profileAndUpload(requestProf);
      assert.strictEqual(apiMock.isDone(), true, 'completed call to test API');
    });
  });
  describe('createProfile', () => {
    let requestStub:
      | undefined
      | sinon.SinonStub<[DecorateRequestOptions, BodyResponseCallback], void>;
    afterEach(() => {
      if (requestStub) {
        requestStub.restore();
      }
    });
    it('should successfully create wall profile', async () => {
      const response = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        deployment: {
          labels: {version: 'test-version', language: 'nodejs'},
          projectId: 'test-projectId',
          target: 'test-service',
        },
        labels: {version: testConfig.serviceContext.version},
      };
      nockOauth2();
      const requestProfileMock = nock(FULL_API)
        .post('/projects/' + testConfig.projectId + '/profiles')
        .once()
        .reply(200, response);
      const profiler = new Profiler(testConfig);
      const actualResponse = await profiler.createProfile();
      assert.deepStrictEqual(response, actualResponse);
      assert.ok(requestProfileMock.isDone(), 'expected call to create profile');
    });
    it('should successfully create profile using non-default api', async () => {
      const config = extend(true, {}, testConfig);
      config.apiEndpoint = TEST_API;
      const response = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        deployment: {
          labels: {version: 'test-version', language: 'nodejs'},
          projectId: 'test-projectId',
          target: 'test-service',
        },
        labels: {version: config.serviceContext.version},
      };
      nockOauth2();
      const requestProfileMock = nock(FULL_TEST_API)
        .post('/projects/' + config.projectId + '/profiles')
        .once()
        .reply(200, response);
      const profiler = new Profiler(config);
      const actualResponse = await profiler.createProfile();
      assert.deepStrictEqual(response, actualResponse);
      assert.ok(requestProfileMock.isDone(), 'expected call to create profile');
    });
    it('should successfully create heap profile', async () => {
      const response = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'HEAP',
        deployment: {
          labels: {version: 'test-version', language: 'nodejs'},
          projectId: 'test-projectId',
          target: 'test-service',
        },
        labels: {version: testConfig.serviceContext.version},
      };
      nockOauth2();
      const requestProfileMock = nock(FULL_API)
        .post('/projects/' + testConfig.projectId + '/profiles')
        .once()
        .reply(200, response);
      const profiler = new Profiler(testConfig);
      const actualResponse = await profiler.createProfile();
      assert.deepStrictEqual(response, actualResponse);
      assert.ok(requestProfileMock.isDone(), 'expected call to create profile');
    });
    it('should throw error when invalid profile created', async () => {
      const response = {name: 'projects/12345678901/test-projectId'};
      nockOauth2();
      nock(FULL_API)
        .post('/projects/' + testConfig.projectId + '/profiles')
        .once()
        .reply(200, response);
      const profiler = new Profiler(testConfig);
      try {
        await profiler.createProfile();
        assert.fail('expected error, no error thrown');
      } catch (err) {
        assert.strictEqual(
          (err as Error).message,
          'Profile not valid: ' +
            '{"name":"projects/12345678901/test-projectId"}.'
        );
      }
    });
    it('should not retry on non-200 status codes', async () => {
      const response = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'HEAP',
        deployment: {
          labels: {version: 'test-version', language: 'nodejs'},
          projectId: 'test-projectId',
          target: 'test-service',
        },
        labels: {version: testConfig.serviceContext.version},
      };
      nockOauth2();
      nock(FULL_API)
        .post('/projects/' + testConfig.projectId + '/profiles')
        .once()
        .reply(503, {})
        .post('/projects/' + testConfig.projectId + '/profiles')
        .once()
        .reply(200, response);
      const profiler = new Profiler(testConfig);
      try {
        await profiler.createProfile();
        assert.fail('expected error, no error thrown');
      } catch (_) {
        // 👻
      }
    });
    it(
      'should not have instance and zone in request body when instance and' +
        ' zone undefined',
      async () => {
        const config = extend(true, {}, testConfig);
        config.instance = undefined;
        config.zone = undefined;
        const response = {
          name: 'projects/12345678901/test-projectId',
          profileType: 'WALL',
          duration: '10s',
        };
        requestStub = sinon
          .stub(common.ServiceObject.prototype, 'request')
          .onCall(0)
          .callsArgWith(1, undefined, response, {statusCode: 200});
        const expRequestBody = {
          deployment: {
            labels: {version: 'test-version', language: 'nodejs'},
            projectId: 'test-projectId',
            target: 'test-service',
          },
          profileType: ['WALL', 'HEAP'],
        };
        const profiler = new Profiler(config);
        const actualResponse = await profiler.createProfile();
        assert.deepStrictEqual(response, actualResponse);
        assert.deepStrictEqual(
          expRequestBody,
          requestStub.firstCall.args[0].body
        );
      }
    );
    it(
      'should not have instance and zone in request body when instance and' +
        ' zone empty strings',
      async () => {
        const config = extend(true, {}, testConfig);
        config.instance = '';
        config.zone = '';
        const response = {
          name: 'projects/12345678901/test-projectId',
          profileType: 'WALL',
          duration: '10s',
        };
        requestStub = sinon
          .stub(common.ServiceObject.prototype, 'request')
          .onCall(0)
          .callsArgWith(1, undefined, response, {statusCode: 200});
        const expRequestBody = {
          deployment: {
            labels: {version: 'test-version', language: 'nodejs'},
            projectId: 'test-projectId',
            target: 'test-service',
          },
          profileType: ['WALL', 'HEAP'],
        };
        const profiler = new Profiler(config);
        const actualResponse = await profiler.createProfile();
        assert.deepStrictEqual(response, actualResponse);
        assert.deepStrictEqual(
          expRequestBody,
          requestStub.firstCall.args[0].body
        );
      }
    );
    it('should keep additional fields in request profile.', async () => {
      const response = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        labels: {version: testConfig.serviceContext.version},
        additionalField: 'additionalField',
      };
      nockOauth2();
      nock(FULL_API)
        .post('/projects/' + testConfig.projectId + '/profiles')
        .once()
        .reply(200, response);
      const profiler = new Profiler(testConfig);
      const actualResponse = await profiler.createProfile();
      assert.deepStrictEqual(response, actualResponse);
    });
    it('should throw error when error thrown by http request.', async () => {
      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .onCall(0)
        .callsArgWith(1, new Error('Network error'), undefined, undefined);
      const profiler = new Profiler(testConfig);
      try {
        await profiler.createProfile();
        assert.fail('expected error, no error thrown');
      } catch (err) {
        assert.strictEqual((err as Error).message, 'Network error');
      }
    });
    it('should throw status message when response has non-200 status.', async () => {
      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .onCall(0)
        .callsArgWith(1, undefined, undefined, {
          statusCode: 500,
          statusMessage: '500 status code',
        });

      const profiler = new Profiler(testConfig);
      try {
        await profiler.createProfile();
        assert.fail('expected error, no error thrown');
      } catch (err) {
        assert.strictEqual((err as Error).message, '500 status code');
      }
    });
    it(
      'should throw error with server-specified backoff when non-200 error' +
        ' and backoff specified',
      async () => {
        requestStub = sinon
          .stub(common.ServiceObject.prototype, 'request')
          .onCall(0)
          .callsArgWith(
            1,
            undefined,
            {error: {details: [{retryDelay: '50s'}]}},
            {statusCode: 409}
          );

        const profiler = new Profiler(testConfig);
        try {
          await profiler.createProfile();
          assert.fail('expected error, no error thrown');
        } catch (err) {
          assert.strictEqual(
            (err as BackoffResponseError).backoffMillis,
            50000
          );
        }
      }
    );
    it('should throw error when response undefined', async () => {
      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .onCall(0)
        .callsArgWith(1, undefined, undefined, {status: 200});

      const profiler = new Profiler(testConfig);
      try {
        await profiler.createProfile();
        assert.fail('expected error, no error thrown');
      } catch (err) {
        assert.strictEqual(
          (err as Error).message,
          'Profile not valid: undefined.'
        );
      }
    });
  });
  describe('collectProfile', () => {
    let requestStub:
      | undefined
      | sinon.SinonStub<[DecorateRequestOptions, BodyResponseCallback], void>;
    let randomStub: sinon.SinonStub<[], number> | undefined;
    before(() => {
      randomStub = sinon.stub(Math, 'random').returns(0.5);
    });
    afterEach(() => {
      if (requestStub) {
        requestStub.restore();
      }
    });
    after(() => {
      if (randomStub) {
        randomStub.restore();
      }
    });
    it('should indicate collectProfile should be called immediately when no errors', async () => {
      const requestProfileResponseBody = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        labels: {version: testConfig.serviceContext.version},
      };
      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        .onCall(0)
        .callsArgWith(1, undefined, requestProfileResponseBody, {
          statusCode: 200,
        })
        .onCall(1)
        .callsArgWith(1, undefined, undefined, {statusCode: 200});

      const profiler = new Profiler(testConfig);
      const delayMillis = await profiler.collectProfile();
      assert.strictEqual(
        0,
        delayMillis,
        'No delay before asking to collect next profile'
      );
    });
    it(
      'should return expect backoff when non-200 response and no backoff' +
        ' indicated',
      async () => {
        requestStub = sinon
          .stub(common.ServiceObject.prototype, 'request')
          .onCall(0)
          .callsArgWith(1, undefined, undefined, {statusCode: 404});

        const profiler = new Profiler(testConfig);
        const delayMillis = await profiler.collectProfile();
        assert.deepStrictEqual(500, delayMillis);
      }
    );
    it('should reset backoff after success', async () => {
      const createProfileResponseBody = {
        name: 'projects/12345678901/test-projectId',
        profileType: 'WALL',
        duration: '10s',
        labels: {instance: testConfig.instance},
      };
      requestStub = sinon
        .stub(common.ServiceObject.prototype, 'request')
        // createProfile - first failure
        .onCall(0)
        .callsArgWith(1, undefined, undefined, {statusCode: 404})
        // createProfile - second failure
        .onCall(1)
        .callsArgWith(1, undefined, undefined, {statusCode: 404})
        // createProfile - third failure
        .onCall(2)
        .callsArgWith(1, undefined, undefined, {statusCode: 404})
        // createProfile
        .onCall(3)
        // createProfile - success
        .callsArgWith(1, undefined, createProfileResponseBody, {
          statusCode: 200,
        })
        // upload profiler - success
        .onCall(4)
        .callsArgWith(1, undefined, undefined, {statusCode: 200})
        // createProfile - failure
        .onCall(5)
        .callsArgWith(
          1,
          new Error('error creating profile'),
          undefined,
          undefined
        );
      const profiler = new Profiler(testConfig);
      let delayMillis = await profiler.collectProfile();
      assert.deepStrictEqual(500, delayMillis);
      delayMillis = await profiler.collectProfile();
      assert.deepStrictEqual(650, delayMillis);
      delayMillis = await profiler.collectProfile();
      assert.deepStrictEqual(845, delayMillis);
      delayMillis = await profiler.collectProfile();
      assert.deepStrictEqual(0, delayMillis);
      delayMillis = await profiler.collectProfile();
      assert.deepStrictEqual(500, delayMillis);
    });
    it(
      'should return server-specified backoff when non-200 error and backoff' +
        ' specified',
      async () => {
        requestStub = sinon
          .stub(common.ServiceObject.prototype, 'request')
          .onCall(0)
          .callsArgWith(
            1,
            undefined,
            {error: {details: [{retryDelay: '50s'}]}},
            {statusCode: 409}
          );
        const profiler = new Profiler(testConfig);
        const delayMillis = await profiler.collectProfile();
        assert.strictEqual(50000, delayMillis);
      }
    );
    it(
      'should return expected backoff when non-200 error and invalid server backoff' +
        ' specified',
      async () => {
        requestStub = sinon
          .stub(common.ServiceObject.prototype, 'request')
          .onCall(0)
          .callsArgWith(
            1,
            undefined,
            {message: 'some message'},
            {
              statusCode: 409,
              body: {message: 'some message'},
            }
          );
        const profiler = new Profiler(testConfig);
        const delayMillis = await profiler.collectProfile();
        assert.strictEqual(500, delayMillis);
      }
    );
    it(
      'should return backoff limit, when server specified backoff is greater' +
        ' then backoff limit',
      async () => {
        requestStub = sinon
          .stub(common.ServiceObject.prototype, 'request')
          .onCall(0)
          .callsArgWith(
            1,
            undefined,
            {error: {details: [{retryDelay: '1000h'}]}},
            {statusCode: 409}
          );
        const profiler = new Profiler(testConfig);
        const delayMillis = await profiler.collectProfile();
        assert.strictEqual(parseDuration('7d'), delayMillis);
      }
    );
    it(
      'should indicate collectProfile should be called immediately if there' +
        ' is an error when collecting and uploading profile.',
      async () => {
        const createProfileResponseBody = {
          name: 'projects/12345678901/test-projectId',
          profileType: 'WALL',
          duration: '10s',
          labels: {instance: testConfig.instance},
        };
        requestStub = sinon
          .stub(common.ServiceObject.prototype, 'request')
          .onCall(0)
          .callsArgWith(1, undefined, createProfileResponseBody, {
            statusCode: 200,
          })
          .onCall(1)
          .callsArgWith(1, new Error('Error uploading'), undefined, undefined);

        const profiler = new Profiler(testConfig);
        const delayMillis = await profiler.collectProfile();
        assert.strictEqual(0, delayMillis);
      }
    );
  });
  describe('parseBackoffDuration', () => {
    it('should return undefined when no duration specified', () => {
      assert.strictEqual(undefined, parseBackoffDuration(''));
    });
    it('should parse backoff with minutes and seconds specified', () => {
      assert.strictEqual(
        62000,
        parseBackoffDuration('action throttled, backoff for 1m2s')
      );
    });
    it('should parse backoff with fraction of second', () => {
      assert.strictEqual(
        2500,
        parseBackoffDuration('action throttled, backoff for 2.5s')
      );
    });
    it('should parse backoff with minutes and seconds, including fraction of second', () => {
      assert.strictEqual(
        62500,
        parseBackoffDuration('action throttled, backoff for 1m2.5s')
      );
    });
    it('should parse backoff with hours and seconds', () => {
      assert.strictEqual(
        3602500,
        parseBackoffDuration('action throttled, backoff for 1h2.5s')
      );
    });
    it('should parse backoff with hours, minutes, and seconds', () => {
      assert.strictEqual(
        3662500,
        parseBackoffDuration('action throttled, backoff for 1h1m2.5s')
      );
    });
    it('should parse return undefined for unexpected backoff time string format', () => {
      assert.strictEqual(
        undefined,
        parseBackoffDuration('action throttled, backoff for  1m2+s')
      );
    });
    it('should parse return undefined for unexpected string format', () => {
      assert.strictEqual(undefined, parseBackoffDuration('time 1m2s'));
    });
  });
});
