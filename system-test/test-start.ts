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

import * as assert from 'assert';
import {describe, it, before, after} from 'mocha';
import delay from 'delay';
import * as nock from 'nock';
import {promisify} from 'util';
import * as zlib from 'zlib';

import {perftools} from '../protos/profile';
import {RequestProfile} from '../src/profiler';

const API = 'https://cloudprofiler.googleapis.com/v2';
let savedEnv: {};
let uploadedProfiles: RequestProfile[] = new Array<RequestProfile>();
let createProfileCount = 0;
nock.disableNetConnect();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fakeCredentials = require('../../test/fixtures/gcloud-credentials.json');

// Start profiler and collect profiles before testing.
before(async () => {
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
    .reply(200, (): RequestProfile => {
      let prof;
      if (createProfileCount % 2 === 0) {
        prof = {
          name: 'projects/X/test-projectId',
          profileType: 'WALL',
          duration: '10s',
        };
      } else {
        prof = {
          name: 'projects/X/test-projectId',
          profileType: 'HEAP',
          duration: '10s',
        };
      }
      createProfileCount++;
      return prof;
    });
  const tempUploadedProfiles = new Array<RequestProfile>();
  nock(API)
    .persist()
    .patch('/projects/X/test-projectId')
    .reply(200, (_: RequestProfile, body: RequestProfile) => {
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const profiler = require('../src/index');
  profiler.start({credentials: fakeCredentials});
  await delay(30 * 1000);

  // copy over currently uploaded profiles, so all tests look at same profiles.
  uploadedProfiles = tempUploadedProfiles.slice();

  // Restore environment variables and mocks.
  process.env = savedEnv;
});

// Restore environment variables after tests.
// nock not restored, since profiles still being uploaded.
after(() => {
  process.env = savedEnv;
});

describe('start', () => {
  it('should have uploaded multiple profiles', () => {
    nock.restore();
    assert.ok(
      uploadedProfiles.length >= 2,
      'Expected 2 or more profiles to be uploaded'
    );
  });
  it('should have uploaded wall profile with samples first', async () => {
    const wall = uploadedProfiles[0];
    const decodedBytes = Buffer.from(wall.profileBytes as string, 'base64');
    const unzippedBytes = (await promisify(zlib.gunzip)(
      decodedBytes
    )) as Uint8Array;
    const outProfile = perftools.profiles.Profile.decode(unzippedBytes);
    assert.strictEqual(wall.profileType, 'WALL');
    assert.strictEqual(
      outProfile.stringTable[outProfile.sampleType[0].type as number],
      'sample'
    );
    assert.strictEqual(
      outProfile.stringTable[outProfile.sampleType[1].type as number],
      'wall'
    );
    assert.strictEqual(
      outProfile.stringTable[outProfile.sampleType[0].unit as number],
      'count'
    );
    assert.strictEqual(
      outProfile.stringTable[outProfile.sampleType[1].unit as number],
      'microseconds'
    );
    assert.ok(outProfile.sample.length > 0, 'Expected 1 or more samples');
  });
  it('should have uploaded heap profile second', async () => {
    const heap = uploadedProfiles[1];
    const decodedBytes = Buffer.from(heap.profileBytes as string, 'base64');
    const unzippedBytes = (await promisify(zlib.gunzip)(
      decodedBytes
    )) as Uint8Array;
    const outProfile = perftools.profiles.Profile.decode(unzippedBytes);
    assert.strictEqual(heap.profileType, 'HEAP');
    assert.strictEqual(
      outProfile.stringTable[outProfile.sampleType[0].type as number],
      'objects'
    );
    assert.strictEqual(
      outProfile.stringTable[outProfile.sampleType[1].type as number],
      'space'
    );
    assert.strictEqual(
      outProfile.stringTable[outProfile.sampleType[0].unit as number],
      'count'
    );
    assert.strictEqual(
      outProfile.stringTable[outProfile.sampleType[1].unit as number],
      'bytes'
    );
  });
});
