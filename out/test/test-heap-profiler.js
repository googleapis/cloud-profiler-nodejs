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
const sinon = require("sinon");
const heapProfiler = require("../src/profilers/heap-profiler");
const profiles_for_tests_1 = require("./profiles-for-tests");
const copy = require('deep-copy');
const assert = require('assert');
const v8HeapProfiler = require('bindings')('sampling_heap_profiler');
describe('HeapProfiler', () => {
    let startStub;
    let stopStub;
    let profileStub;
    let dateStub;
    let memoryUsageStub;
    beforeEach(() => {
        startStub = sinon.stub(v8HeapProfiler, 'startSamplingHeapProfiler');
        stopStub = sinon.stub(v8HeapProfiler, 'stopSamplingHeapProfiler');
        dateStub = sinon.stub(Date, 'now').returns(0);
    });
    afterEach(() => {
        heapProfiler.stop();
        startStub.restore();
        stopStub.restore();
        profileStub.restore();
        dateStub.restore();
        memoryUsageStub.restore();
    });
    describe('profile', () => {
        it('should return a profile equal to the expected profile when external memory is allocated', () => __awaiter(this, void 0, void 0, function* () {
            profileStub = sinon.stub(v8HeapProfiler, 'getAllocationProfile')
                .returns(copy(profiles_for_tests_1.v8HeapProfile));
            memoryUsageStub = sinon.stub(process, 'memoryUsage').returns({
                external: 1024,
                rss: 2048,
                heapTotal: 4096,
                heapUse: 2048,
            });
            const intervalBytes = 1024 * 512;
            const stackDepth = 32;
            heapProfiler.start(intervalBytes, stackDepth);
            const profile = heapProfiler.profile();
            assert.deepEqual(profiles_for_tests_1.heapProfileWithExternal, profile);
        }));
        it('should return a profile equal to the expected profile when including all samples', () => __awaiter(this, void 0, void 0, function* () {
            profileStub = sinon.stub(v8HeapProfiler, 'getAllocationProfile')
                .returns(copy(profiles_for_tests_1.v8HeapWithPathProfile));
            memoryUsageStub = sinon.stub(process, 'memoryUsage').returns({
                external: 0,
                rss: 2048,
                heapTotal: 4096,
                heapUse: 2048,
            });
            const intervalBytes = 1024 * 512;
            const stackDepth = 32;
            heapProfiler.start(intervalBytes, stackDepth);
            const profile = heapProfiler.profile();
            assert.deepEqual(profiles_for_tests_1.heapProfileIncludePath, profile);
        }));
        it('should return a profile equal to the expected profile when excluding profiler samples', () => __awaiter(this, void 0, void 0, function* () {
            profileStub = sinon.stub(v8HeapProfiler, 'getAllocationProfile')
                .returns(copy(profiles_for_tests_1.v8HeapWithPathProfile));
            memoryUsageStub = sinon.stub(process, 'memoryUsage').returns({
                external: 0,
                rss: 2048,
                heapTotal: 4096,
                heapUse: 2048,
            });
            const intervalBytes = 1024 * 512;
            const stackDepth = 32;
            heapProfiler.start(intervalBytes, stackDepth);
            const profile = heapProfiler.profile('@google-cloud/profiler');
            assert.deepEqual(profiles_for_tests_1.heapProfileExcludePath, profile);
        }));
        it('should throw error when not started', () => {
            assert.throws(() => {
                heapProfiler.profile();
            }, (err) => {
                return err.message === 'Heap profiler is not enabled.';
            });
        });
        it('should throw error when started then stopped', () => {
            const intervalBytes = 1024 * 512;
            const stackDepth = 32;
            heapProfiler.start(intervalBytes, stackDepth);
            heapProfiler.stop();
            assert.throws(() => {
                heapProfiler.profile();
            }, (err) => {
                return err.message === 'Heap profiler is not enabled.';
            });
        });
    });
    describe('start', () => {
        it('should call startSamplingHeapProfiler', () => {
            const intervalBytes1 = 1024 * 512;
            const stackDepth1 = 32;
            heapProfiler.start(intervalBytes1, stackDepth1);
            assert.ok(startStub.calledWith(intervalBytes1, stackDepth1), 'expected startSamplingHeapProfiler to be called');
        });
        it('should throw error when enabled and started with different parameters', () => {
            const intervalBytes1 = 1024 * 512;
            const stackDepth1 = 32;
            heapProfiler.start(intervalBytes1, stackDepth1);
            assert.ok(startStub.calledWith(intervalBytes1, stackDepth1), 'expected startSamplingHeapProfiler to be called');
            startStub.resetHistory();
            const intervalBytes2 = 1024 * 128;
            const stackDepth2 = 64;
            try {
                heapProfiler.start(intervalBytes2, stackDepth2);
            }
            catch (e) {
                assert.strictEqual(e.message, 'Heap profiler is already started  with intervalBytes 524288 and' +
                    ' stackDepth 64');
            }
            assert.ok(!startStub.called, 'expected startSamplingHeapProfiler not to be called second time');
        });
    });
    describe('stop', () => {
        it('should not call stopSamplingHeapProfiler if profiler not started', () => {
            heapProfiler.stop();
            assert.ok(!stopStub.called, 'stop() should have been no-op.');
        });
        it('should call stopSamplingHeapProfiler if profiler started', () => {
            heapProfiler.start(1024 * 512, 32);
            heapProfiler.stop();
            assert.ok(stopStub.called, 'expected stopSamplingHeapProfiler to be called');
        });
    });
});
//# sourceMappingURL=test-heap-profiler.js.map