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
const delay_1 = require("delay");
const sinon = require("sinon");
const time_profiler_1 = require("../src/profilers/time-profiler");
const profiles_for_tests_1 = require("./profiles-for-tests");
const assert = require('assert');
const v8TimeProfiler = require('bindings')('time_profiler');
describe('TimeProfiler', () => {
    describe('profile', () => {
        it('should detect idle time', () => __awaiter(this, void 0, void 0, function* () {
            const durationMillis = 500;
            const intervalMicros = 1000;
            const profiler = new time_profiler_1.TimeProfiler(intervalMicros);
            const profile = yield profiler.profile(durationMillis);
            assert.ok(profile.stringTable);
            assert.notStrictEqual(profile.stringTable.indexOf('(idle)'), -1);
        }));
    });
    describe('profile (w/ stubs)', () => {
        const sinonStubs = new Array();
        before(() => {
            sinonStubs.push(sinon.stub(v8TimeProfiler, 'startProfiling'));
            sinonStubs.push(sinon.stub(v8TimeProfiler, 'stopProfiling').returns(profiles_for_tests_1.v8TimeProfile));
            sinonStubs.push(sinon.stub(v8TimeProfiler, 'setSamplingInterval'));
            sinonStubs.push(sinon.stub(Date, 'now').returns(0));
        });
        after(() => {
            sinonStubs.forEach((stub) => {
                stub.restore();
            });
        });
        it('should profile during duration and finish profiling after duration', () => __awaiter(this, void 0, void 0, function* () {
            const durationMillis = 500;
            const intervalMicros = 1000;
            const profiler = new time_profiler_1.TimeProfiler(intervalMicros);
            let isProfiling = true;
            const profilePromise = profiler.profile(durationMillis).then(() => {
                isProfiling = false;
            });
            yield delay_1.default(2 * durationMillis);
            assert.strictEqual(false, isProfiling, 'profiler is still running');
        }));
        it('should return a profile equal to the expected profile', () => __awaiter(this, void 0, void 0, function* () {
            const durationMillis = 500;
            const intervalMicros = 1000;
            const profiler = new time_profiler_1.TimeProfiler(intervalMicros);
            const profile = yield profiler.profile(durationMillis);
            assert.deepEqual(profiles_for_tests_1.timeProfile, profile);
        }));
    });
});
//# sourceMappingURL=test-time-profiler.js.map