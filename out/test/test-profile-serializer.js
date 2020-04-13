"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const sinon = require("sinon");
const profile_serializer_1 = require("../src/profilers/profile-serializer");
const profiles_for_tests_1 = require("./profiles-for-tests");
const assert = require('assert');
describe('serializeTimeProfile', () => {
    let dateStub;
    before(() => {
        dateStub = sinon.stub(Date, 'now').returns(0);
    });
    after(() => {
        dateStub.restore();
    });
    it('should produce expected profile', () => {
        const timeProfileOut = profile_serializer_1.serializeTimeProfile(profiles_for_tests_1.v8TimeProfile, 1000);
        assert.deepEqual(timeProfileOut, profiles_for_tests_1.timeProfile);
    });
    it('should produce expected profile when there is anyonmous function', () => {
        const timeProfileOut = profile_serializer_1.serializeTimeProfile(profiles_for_tests_1.v8AnonymousFunctionTimeProfile, 1000);
        assert.deepEqual(timeProfileOut, profiles_for_tests_1.anonymousFunctionTimeProfile);
    });
});
describe('serializeHeapProfile', () => {
    it('should produce expected profile', () => {
        const heapProfileOut = profile_serializer_1.serializeHeapProfile(profiles_for_tests_1.v8HeapProfile, 0, 512 * 1024);
        assert.deepEqual(heapProfileOut, profiles_for_tests_1.heapProfile);
    });
    it('should produce expected profile when there is anyonmous function', () => {
        const heapProfileOut = profile_serializer_1.serializeHeapProfile(profiles_for_tests_1.v8AnonymousFunctionHeapProfile, 0, 512 * 1024);
        assert.deepEqual(heapProfileOut, profiles_for_tests_1.anonymousFunctionHeapProfile);
    });
});
//# sourceMappingURL=test-profile-serializer.js.map