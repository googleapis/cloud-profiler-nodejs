"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const common = require("@google-cloud/common");
const assert = require("assert");
const extend = require("extend");
const nock = require("nock");
const pify = require("pify");
const pprof_1 = require("pprof");
const sinon = require("sinon");
const zlib = require("zlib");
const profile_1 = require("../../proto/profile");
const profiler_1 = require("../src/profiler");
const profiles_for_tests_1 = require("./profiles-for-tests");
const parseDuration = require('parse-duration');
const fakeCredentials = require('../../ts/test/fixtures/gcloud-credentials.json');
const API = 'https://cloudprofiler.googleapis.com/v2';
const TEST_API = 'https://test-cloudprofiler.sandbox.googleapis.com/v2';
const testConfig = {
    projectId: 'test-projectId',
    logLevel: 0,
    serviceContext: { service: 'test-service', version: 'test-version' },
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
    backoffCapMillis: parseDuration('1h'),
    backoffMultiplier: 1.3,
    serverBackoffCapMillis: parseDuration('7d'),
    baseApiUrl: API,
    localProfilingPeriodMillis: 1000,
    localTimeDurationMillis: 1000,
    localLogPeriodMillis: 1000,
    sourceMapSearchPath: [],
    disableSourceMaps: true,
};
nock.disableNetConnect();
function nockOauth2() {
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
        const retryer = new profiler_1.Retryer(1000, 1000000, 5, () => 0.5);
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
    // tslint:disable-next-line: no-any
    const sinonStubs = new Array();
    beforeEach(() => {
        sinonStubs.push(sinon.stub(pprof_1.time, 'start'));
        sinonStubs.push(sinon.stub(pprof_1.time, 'profile').returns(Promise.resolve(profiles_for_tests_1.timeProfile)));
        sinonStubs.push(sinon.stub(pprof_1.heap, 'stop'));
        sinonStubs.push(sinon.stub(pprof_1.heap, 'start'));
        sinonStubs.push(sinon.stub(pprof_1.heap, 'profile').returns(profiles_for_tests_1.heapProfile));
    });
    afterEach(() => {
        nock.cleanAll();
        sinonStubs.forEach(stub => {
            stub.restore();
        });
    });
    describe('profile', () => {
        it('should return expected profile when profile type is WALL.', () => __awaiter(this, void 0, void 0, function* () {
            const profiler = new profiler_1.Profiler(testConfig);
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { instance: 'test-instance' },
            };
            const prof = yield profiler.profile(requestProf);
            const decodedBytes = Buffer.from(prof.profileBytes, 'base64');
            const unzippedBytes = yield pify(zlib.gunzip)(decodedBytes);
            const outProfile = profile_1.perftools.profiles.Profile.decode(unzippedBytes);
            assert.deepStrictEqual(profiles_for_tests_1.decodedTimeProfile, outProfile);
        }));
        it('should return expected profile when profile type is HEAP.', () => __awaiter(this, void 0, void 0, function* () {
            const profiler = new profiler_1.Profiler(testConfig);
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'HEAP',
                labels: { instance: 'test-instance' },
            };
            const prof = yield profiler.profile(requestProf);
            const decodedBytes = Buffer.from(prof.profileBytes, 'base64');
            const unzippedBytes = yield pify(zlib.gunzip)(decodedBytes);
            const outProfile = profile_1.perftools.profiles.Profile.decode(unzippedBytes);
            assert.deepStrictEqual(profiles_for_tests_1.decodedHeapProfile, outProfile);
        }));
        it('should throw error when unexpected profile type is requested.', () => __awaiter(this, void 0, void 0, function* () {
            const profiler = new profiler_1.Profiler(testConfig);
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'UNKNOWN',
                duration: '10s',
                labels: { instance: 'test-instance' },
            };
            try {
                yield profiler.profile(requestProf);
                assert.fail('Expected an error to be thrown,');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Unexpected profile type UNKNOWN.');
            }
        }));
    });
    describe('writeTimeProfile', () => {
        it('should return request with base64-encoded profile when time profiling' +
            ' enabled', () => __awaiter(this, void 0, void 0, function* () {
            const profiler = new profiler_1.Profiler(testConfig);
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { instance: 'test-instance' },
            };
            const outRequestProfile = yield profiler.writeTimeProfile(requestProf);
            const encodedBytes = outRequestProfile.profileBytes;
            if (encodedBytes === undefined) {
                assert.fail('profile bytes are undefined.');
            }
            const decodedBytes = Buffer.from(encodedBytes, 'base64');
            const unzippedBytes = yield pify(zlib.gunzip)(decodedBytes);
            const outProfile = profile_1.perftools.profiles.Profile.decode(unzippedBytes);
            // compare to decodedTimeProfile, which is equivalent to timeProfile,
            // but numbers are replaced with longs.
            assert.deepStrictEqual(profiles_for_tests_1.decodedTimeProfile, outProfile);
        }));
        it('should throw error when time profiling is not enabled.', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            config.disableTime = true;
            const profiler = new profiler_1.Profiler(config);
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { instance: 'test-instance' },
            };
            try {
                yield profiler.writeTimeProfile(requestProf);
                assert.fail('expected error, no error thrown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Cannot collect time profile, time profiler not enabled.');
            }
        }));
    });
    describe('writeHeapProfile', () => {
        it('should return request with base64-encoded profile when time profiling' +
            ' enabled', () => __awaiter(this, void 0, void 0, function* () {
            const profiler = new profiler_1.Profiler(testConfig);
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'HEAP',
                labels: { instance: 'test-instance' },
            };
            const outRequestProfile = yield profiler.writeHeapProfile(requestProf);
            const encodedBytes = outRequestProfile.profileBytes;
            if (encodedBytes === undefined) {
                assert.fail('profile bytes are undefined.');
            }
            const decodedBytes = Buffer.from(encodedBytes, 'base64');
            const unzippedBytes = yield pify(zlib.gunzip)(decodedBytes);
            const outProfile = profile_1.perftools.profiles.Profile.decode(unzippedBytes);
            // compare to decodedTimeProfile, which is equivalent to timeProfile,
            // but numbers are replaced with longs.
            assert.deepStrictEqual(profiles_for_tests_1.decodedHeapProfile, outProfile);
        }));
        it('should throw error when heap profiling is not enabled.', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            config.disableHeap = true;
            const profiler = new profiler_1.Profiler(config);
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'HEAP',
                labels: { instance: 'test-instance' },
            };
            try {
                yield profiler.writeHeapProfile(requestProf);
                assert.fail('expected error, no error thrown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Cannot collect heap profile, heap profiler not enabled.');
            }
        }));
    });
    describe('profileAndUpload', () => {
        let requestStub;
        afterEach(() => {
            if (requestStub) {
                requestStub.restore();
            }
        });
        it('should send request to upload time profile.', () => __awaiter(this, void 0, void 0, function* () {
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                duration: '10s',
                profileType: 'WALL',
                labels: { instance: 'test-instance' },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, null, {}, { statusCode: 200 });
            const profiler = new profiler_1.Profiler(testConfig);
            yield profiler.profileAndUpload(requestProf);
            const uploaded = requestStub.firstCall.args[0].body;
            const decodedBytes = Buffer.from(uploaded.profileBytes, 'base64');
            const unzippedBytes = yield pify(zlib.gunzip)(decodedBytes);
            const outProfile = profile_1.perftools.profiles.Profile.decode(unzippedBytes);
            assert.deepStrictEqual(profiles_for_tests_1.decodedTimeProfile, outProfile);
            uploaded.profileBytes = undefined;
            assert.deepStrictEqual(uploaded, requestProf);
        }));
        it('should send request to upload heap profile.', () => __awaiter(this, void 0, void 0, function* () {
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                duration: '10s',
                profileType: 'HEAP',
                labels: { instance: 'test-instance' },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, null, {}, { statusCode: 200 });
            const profiler = new profiler_1.Profiler(testConfig);
            yield profiler.profileAndUpload(requestProf);
            const uploaded = requestStub.firstCall.args[0].body;
            const decodedBytes = Buffer.from(uploaded.profileBytes, 'base64');
            const unzippedBytes = yield pify(zlib.gunzip)(decodedBytes);
            const outProfile = profile_1.perftools.profiles.Profile.decode(unzippedBytes);
            assert.deepStrictEqual(profiles_for_tests_1.decodedHeapProfile, outProfile);
            uploaded.profileBytes = undefined;
            assert.deepStrictEqual(uploaded, requestProf);
        }));
        it('should not uploaded when profile type unknown.', () => __awaiter(this, void 0, void 0, function* () {
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                duration: '10s',
                profileType: 'UNKNOWN_PROFILE_TYPE',
                labels: { instance: 'test-instance' },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, null, {}, {});
            const profiler = new profiler_1.Profiler(testConfig);
            yield profiler.profileAndUpload(requestProf);
            assert.strictEqual(0, requestStub.callCount);
        }));
        it('should ignore error thrown by http request.', () => __awaiter(this, void 0, void 0, function* () {
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                duration: '10s',
                profileType: 'WALL',
                labels: { instance: 'test-instance' },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .callsArgWith(1, new Error('Network error'), {}, {});
            const profiler = new profiler_1.Profiler(testConfig);
            yield profiler.profileAndUpload(requestProf);
        }));
        it('should ignore when non-200 status code returned.', () => __awaiter(this, void 0, void 0, function* () {
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                duration: '10s',
                profileType: 'WALL',
                labels: { instance: 'test-instance' },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .callsArgWith(1, null, {}, { statusCode: 500, statusMessage: 'Error 500' });
            const profiler = new profiler_1.Profiler(testConfig);
            yield profiler.profileAndUpload(requestProf);
        }));
        it('should send request to upload profile to default API without error.', () => __awaiter(this, void 0, void 0, function* () {
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                duration: '10s',
                profileType: 'HEAP',
                labels: { instance: 'test-instance' },
            };
            nockOauth2();
            const apiMock = nock(API)
                .patch('/' + requestProf.name)
                .once()
                .reply(200);
            const profiler = new profiler_1.Profiler(testConfig);
            yield profiler.profileAndUpload(requestProf);
            assert.strictEqual(apiMock.isDone(), true, 'completed call to real API');
        }));
        it('should send request to upload profile to non-default API without error.', () => __awaiter(this, void 0, void 0, function* () {
            const requestProf = {
                name: 'projects/12345678901/test-projectId',
                duration: '10s',
                profileType: 'HEAP',
                labels: { instance: 'test-instance' },
            };
            nockOauth2();
            const apiMock = nock(TEST_API)
                .patch('/' + requestProf.name)
                .once()
                .reply(200);
            const config = extend(true, {}, testConfig);
            config.baseApiUrl = TEST_API;
            const profiler = new profiler_1.Profiler(config);
            yield profiler.profileAndUpload(requestProf);
            assert.strictEqual(apiMock.isDone(), true, 'completed call to test API');
        }));
    });
    describe('createProfile', () => {
        let requestStub;
        afterEach(() => {
            if (requestStub) {
                requestStub.restore();
            }
        });
        it('should successfully create wall profile', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            config.disableHeap = true;
            const response = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                deployment: {
                    labels: { version: 'test-version', language: 'nodejs' },
                    projectId: 'test-projectId',
                    target: 'test-service',
                },
                labels: { version: config.serviceContext.version },
            };
            nockOauth2();
            const requestProfileMock = nock(API)
                .post('/projects/' + testConfig.projectId + '/profiles')
                .once()
                .reply(200, response);
            const profiler = new profiler_1.Profiler(testConfig);
            const actualResponse = yield profiler.createProfile();
            assert.deepStrictEqual(response, actualResponse);
            assert.ok(requestProfileMock.isDone(), 'expected call to create profile');
        }));
        it('should successfully create profile using non-default api', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            config.disableHeap = true;
            config.baseApiUrl = TEST_API;
            const response = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                deployment: {
                    labels: { version: 'test-version', language: 'nodejs' },
                    projectId: 'test-projectId',
                    target: 'test-service',
                },
                labels: { version: config.serviceContext.version },
            };
            nockOauth2();
            const requestProfileMock = nock(TEST_API)
                .post('/projects/' + config.projectId + '/profiles')
                .once()
                .reply(200, response);
            const profiler = new profiler_1.Profiler(config);
            const actualResponse = yield profiler.createProfile();
            assert.deepStrictEqual(response, actualResponse);
            assert.ok(requestProfileMock.isDone(), 'expected call to create profile');
        }));
        it('should successfully create heap profile', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            config.disableHeap = true;
            const response = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'HEAP',
                deployment: {
                    labels: { version: 'test-version', language: 'nodejs' },
                    projectId: 'test-projectId',
                    target: 'test-service',
                },
                labels: { version: config.serviceContext.version },
            };
            nockOauth2();
            const requestProfileMock = nock(API)
                .post('/projects/' + testConfig.projectId + '/profiles')
                .once()
                .reply(200, response);
            const profiler = new profiler_1.Profiler(testConfig);
            const actualResponse = yield profiler.createProfile();
            assert.deepStrictEqual(response, actualResponse);
            assert.ok(requestProfileMock.isDone(), 'expected call to create profile');
        }));
        it('should throw error when invalid profile created', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            config.disableHeap = true;
            const response = { name: 'projects/12345678901/test-projectId' };
            nockOauth2();
            const requestProfileMock = nock(API)
                .post('/projects/' + testConfig.projectId + '/profiles')
                .once()
                .reply(200, response);
            const profiler = new profiler_1.Profiler(testConfig);
            try {
                yield profiler.createProfile();
                assert.fail('expected error, no error thrown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Profile not valid: ' +
                    '{"name":"projects/12345678901/test-projectId"}.');
            }
        }));
        it('should not have instance and zone in request body when instance and' +
            ' zone undefined', () => __awaiter(this, void 0, void 0, function* () {
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
                .callsArgWith(1, undefined, response, { statusCode: 200 });
            const expRequestBody = {
                deployment: {
                    labels: { version: 'test-version', language: 'nodejs' },
                    projectId: 'test-projectId',
                    target: 'test-service',
                },
                profileType: ['WALL', 'HEAP'],
            };
            const profiler = new profiler_1.Profiler(config);
            const actualResponse = yield profiler.createProfile();
            assert.deepStrictEqual(response, actualResponse);
            assert.deepStrictEqual(expRequestBody, requestStub.firstCall.args[0].body);
        }));
        it('should not have instance and zone in request body when instance and' +
            ' zone empty strings', () => __awaiter(this, void 0, void 0, function* () {
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
                .callsArgWith(1, undefined, response, { statusCode: 200 });
            const expRequestBody = {
                deployment: {
                    labels: { version: 'test-version', language: 'nodejs' },
                    projectId: 'test-projectId',
                    target: 'test-service',
                },
                profileType: ['WALL', 'HEAP'],
            };
            const profiler = new profiler_1.Profiler(config);
            const actualResponse = yield profiler.createProfile();
            assert.deepStrictEqual(response, actualResponse);
            assert.deepStrictEqual(expRequestBody, requestStub.firstCall.args[0].body);
        }));
        it('should keep additional fields in request profile.', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            config.disableHeap = true;
            const response = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { version: config.serviceContext.version },
                additionalField: 'additionalField',
            };
            nockOauth2();
            const requestProfileMock = nock(API)
                .post('/projects/' + testConfig.projectId + '/profiles')
                .once()
                .reply(200, response);
            const profiler = new profiler_1.Profiler(testConfig);
            const actualResponse = yield profiler.createProfile();
            assert.deepStrictEqual(response, actualResponse);
        }));
        it('should throw error when error thrown by http request.', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            config.disableHeap = true;
            const response = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { version: config.serviceContext.version },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, new Error('Network error'), undefined, undefined);
            const profiler = new profiler_1.Profiler(testConfig);
            try {
                yield profiler.createProfile();
                assert.fail('expected error, no error thrown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Network error');
            }
        }));
        it('should throw status message when response has non-200 status.', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const response = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { version: config.serviceContext.version },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, undefined, {
                statusCode: 500,
                statusMessage: '500 status code',
            });
            const profiler = new profiler_1.Profiler(testConfig);
            try {
                yield profiler.createProfile();
                assert.fail('expected error, no error thrown');
            }
            catch (err) {
                assert.strictEqual(err.message, '500 status code');
            }
        }));
        it('should throw error with server-specified backoff when non-200 error' +
            ' and backoff specified', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const requestProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { version: config.serviceContext.version },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, { error: { details: [{ retryDelay: '50s' }] } }, { statusCode: 409 });
            const profiler = new profiler_1.Profiler(testConfig);
            try {
                yield profiler.createProfile();
                assert.fail('expected error, no error thrown');
            }
            catch (err) {
                assert.strictEqual(err.backoffMillis, 50000);
            }
        }));
        it('should throw error when response undefined', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const requestProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { version: config.serviceContext.version },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, undefined, { status: 200 });
            const profiler = new profiler_1.Profiler(testConfig);
            try {
                yield profiler.createProfile();
                assert.fail('expected error, no error thrown');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Profile not valid: undefined.');
            }
        }));
    });
    describe('collectProfile', () => {
        let requestStub;
        let randomStub;
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
        it('should indicate collectProfile should be called immediately when no errors', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const requestProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { version: config.serviceContext.version },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, requestProfileResponseBody, {
                statusCode: 200,
            })
                .onCall(1)
                .callsArgWith(1, undefined, undefined, { statusCode: 200 });
            const profiler = new profiler_1.Profiler(testConfig);
            const delayMillis = yield profiler.collectProfile();
            assert.strictEqual(0, delayMillis, 'No delay before asking to collect next profile');
        }));
        it('should return expect backoff when non-200 response and no backoff' +
            ' indicated', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const requestProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { version: config.serviceContext.version },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, undefined, { statusCode: 404 });
            const profiler = new profiler_1.Profiler(testConfig);
            const delayMillis = yield profiler.collectProfile();
            assert.deepStrictEqual(500, delayMillis);
        }));
        it('should reset backoff after success', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const requestProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { instance: config.instance },
            };
            const createProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { instance: config.instance },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                // createProfile - first failure
                .onCall(0)
                .callsArgWith(1, undefined, undefined, { statusCode: 404 })
                // createProfile - second failure
                .onCall(1)
                .callsArgWith(1, undefined, undefined, { statusCode: 404 })
                // createProfile - third failure
                .onCall(2)
                .callsArgWith(1, undefined, undefined, { statusCode: 404 })
                // createProfile
                .onCall(3)
                // createProfile - success
                .callsArgWith(1, undefined, createProfileResponseBody, {
                statusCode: 200,
            })
                // upload profiler - success
                .onCall(4)
                .callsArgWith(1, undefined, undefined, { statusCode: 200 })
                // createProfile - failure
                .onCall(5)
                .callsArgWith(1, new Error('error creating profile'), undefined, undefined);
            const profiler = new profiler_1.Profiler(config);
            let delayMillis = yield profiler.collectProfile();
            assert.deepStrictEqual(500, delayMillis);
            delayMillis = yield profiler.collectProfile();
            assert.deepStrictEqual(650, delayMillis);
            delayMillis = yield profiler.collectProfile();
            assert.deepStrictEqual(845, delayMillis);
            delayMillis = yield profiler.collectProfile();
            assert.deepStrictEqual(0, delayMillis);
            delayMillis = yield profiler.collectProfile();
            assert.deepStrictEqual(500, delayMillis);
        }));
        it('should return server-specified backoff when non-200 error and backoff' +
            ' specified', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const requestProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { instance: config.instance },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, { error: { details: [{ retryDelay: '50s' }] } }, { statusCode: 409 });
            const profiler = new profiler_1.Profiler(testConfig);
            const delayMillis = yield profiler.collectProfile();
            assert.strictEqual(50000, delayMillis);
        }));
        it('should return expected backoff when non-200 error and invalid server backoff' +
            ' specified', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const requestProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { instance: config.instance },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, { message: 'some message' }, {
                statusCode: 409,
                body: { message: 'some message' },
            });
            const profiler = new profiler_1.Profiler(testConfig);
            const delayMillis = yield profiler.collectProfile();
            assert.strictEqual(500, delayMillis);
        }));
        it('should return backoff limit, when server specified backoff is greater' +
            ' then backoff limit', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const requestProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { version: config.serviceContext.version },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, { error: { details: [{ retryDelay: '1000h' }] } }, { statusCode: 409 });
            const profiler = new profiler_1.Profiler(testConfig);
            const delayMillis = yield profiler.collectProfile();
            assert.strictEqual(parseDuration('7d'), delayMillis);
        }));
        it('should indicate collectProfile should be called immediately if there' +
            ' is an error when collecting and uploading profile.', () => __awaiter(this, void 0, void 0, function* () {
            const config = extend(true, {}, testConfig);
            const createProfileResponseBody = {
                name: 'projects/12345678901/test-projectId',
                profileType: 'WALL',
                duration: '10s',
                labels: { instance: config.instance },
            };
            requestStub = sinon
                .stub(common.ServiceObject.prototype, 'request')
                .onCall(0)
                .callsArgWith(1, undefined, createProfileResponseBody, {
                statusCode: 200,
            })
                .onCall(1)
                .callsArgWith(1, new Error('Error uploading'), undefined, undefined);
            const profiler = new profiler_1.Profiler(testConfig);
            const delayMillis = yield profiler.collectProfile();
            assert.strictEqual(0, delayMillis);
        }));
    });
    describe('parseBackoffDuration', () => {
        it('should return undefined when no duration specified', () => {
            assert.strictEqual(undefined, profiler_1.parseBackoffDuration(''));
        });
        it('should parse backoff with minutes and seconds specified', () => {
            assert.strictEqual(62000, profiler_1.parseBackoffDuration('action throttled, backoff for 1m2s'));
        });
        it('should parse backoff with fraction of second', () => {
            assert.strictEqual(2500, profiler_1.parseBackoffDuration('action throttled, backoff for 2.5s'));
        });
        it('should parse backoff with minutes and seconds, including fraction of second', () => {
            assert.strictEqual(62500, profiler_1.parseBackoffDuration('action throttled, backoff for 1m2.5s'));
        });
        it('should parse backoff with hours and seconds', () => {
            assert.strictEqual(3602500, profiler_1.parseBackoffDuration('action throttled, backoff for 1h2.5s'));
        });
        it('should parse backoff with hours, minutes, and seconds', () => {
            assert.strictEqual(3662500, profiler_1.parseBackoffDuration('action throttled, backoff for 1h1m2.5s'));
        });
        it('should parse return undefined for unexpected backoff time string format', () => {
            assert.strictEqual(undefined, profiler_1.parseBackoffDuration('action throttled, backoff for  1m2+s'));
        });
        it('should parse return undefined for unexpected string format', () => {
            assert.strictEqual(undefined, profiler_1.parseBackoffDuration('time 1m2s'));
        });
    });
});
//# sourceMappingURL=test-profiler.js.map