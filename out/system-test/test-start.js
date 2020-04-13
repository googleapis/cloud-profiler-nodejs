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
const assert = require("assert");
const delay_1 = require("delay");
const nock = require("nock");
const pify = require("pify");
const zlib = require("zlib");
const profile_1 = require("../../proto/profile");
const API = 'https://cloudprofiler.googleapis.com/v2';
let savedEnv;
let uploadedProfiles = new Array();
let createProfileCount = 0;
nock.disableNetConnect();
const fakeCredentials = require('../../ts/test/fixtures/gcloud-credentials.json');
// Start profiler and collect profiles before testing.
before(() => __awaiter(this, void 0, void 0, function* () {
    savedEnv = process.env;
    process.env = {};
    process.env.GCLOUD_PROJECT = 'test-projectId';
    process.env.GAE_SERVICE = 'test-service';
    process.env.GAE_VERSION = '0.0.0';
    // Mock profiler API.
    nock(API)
        .persist()
        .post('/projects/' + process.env.GCLOUD_PROJECT + '/profiles')
        .delay(1000)
        .reply(200, () => {
        let prof;
        if (createProfileCount % 2 === 0) {
            prof = {
                name: 'projects/X/test-projectId',
                profileType: 'WALL',
                duration: '10s',
            };
        }
        else {
            prof = {
                name: 'projects/X/test-projectId',
                profileType: 'HEAP',
                duration: '10s',
            };
        }
        createProfileCount++;
        return prof;
    });
    const tempUploadedProfiles = new Array();
    nock(API)
        .persist()
        .patch('/projects/X/test-projectId')
        .reply(200, (request, body) => {
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }
        tempUploadedProfiles.push(body);
    });
    nock('https://oauth2.googleapis.com')
        .post(/\/token/, () => true)
        .once()
        .reply(200, {
        refresh_token: 'hello',
        access_token: 'goodbye',
        expiry_date: new Date(9999, 1, 1),
    });
    // start profiling and wait to collect profiles.
    const profiler = require('../src/index');
    profiler.start({ credentials: fakeCredentials });
    yield delay_1.default(30 * 1000);
    // copy over currently uploaded profiles, so all tests look at same profiles.
    uploadedProfiles = tempUploadedProfiles.slice();
    // Restore environment variables and mocks.
    process.env = savedEnv;
}));
// Restore environment variables after tests.
// nock not restored, since profiles still being uploaded.
after(() => {
    process.env = savedEnv;
});
describe('start', () => {
    it('should have uploaded multiple profiles', () => {
        nock.restore();
        assert.ok(uploadedProfiles.length >= 2, 'Expected 2 or more profiles to be uploaded');
    });
    it('should have uploaded wall profile with samples first', () => __awaiter(this, void 0, void 0, function* () {
        const wall = uploadedProfiles[0];
        const decodedBytes = Buffer.from(wall.profileBytes, 'base64');
        const unzippedBytes = yield pify(zlib.gunzip)(decodedBytes);
        const outProfile = profile_1.perftools.profiles.Profile.decode(unzippedBytes);
        assert.strictEqual(wall.profileType, 'WALL');
        assert.strictEqual(outProfile.stringTable[outProfile.sampleType[0].type], 'sample');
        assert.strictEqual(outProfile.stringTable[outProfile.sampleType[1].type], 'wall');
        assert.strictEqual(outProfile.stringTable[outProfile.sampleType[0].unit], 'count');
        assert.strictEqual(outProfile.stringTable[outProfile.sampleType[1].unit], 'microseconds');
        assert.ok(outProfile.sample.length > 0, 'Expected 1 or more samples');
    }));
    it('should have uploaded heap profile second', () => __awaiter(this, void 0, void 0, function* () {
        const heap = uploadedProfiles[1];
        const decodedBytes = Buffer.from(heap.profileBytes, 'base64');
        const unzippedBytes = yield pify(zlib.gunzip)(decodedBytes);
        const outProfile = profile_1.perftools.profiles.Profile.decode(unzippedBytes);
        assert.strictEqual(heap.profileType, 'HEAP');
        assert.strictEqual(outProfile.stringTable[outProfile.sampleType[0].type], 'objects');
        assert.strictEqual(outProfile.stringTable[outProfile.sampleType[1].type], 'space');
        assert.strictEqual(outProfile.stringTable[outProfile.sampleType[0].unit], 'count');
        assert.strictEqual(outProfile.stringTable[outProfile.sampleType[1].unit], 'bytes');
    }));
});
//# sourceMappingURL=test-start.js.map