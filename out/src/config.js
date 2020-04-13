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
Object.defineProperty(exports, "__esModule", { value: true });
const parseDuration = require('parse-duration');
// Default values for configuration for a profiler.
exports.defaultConfig = {
    logLevel: 2,
    serviceContext: {},
    disableHeap: false,
    disableTime: false,
    timeIntervalMicros: 1000,
    heapIntervalBytes: 512 * 1024,
    heapMaxStackDepth: 64,
    ignoreHeapSamplesPath: '@google-cloud/profiler',
    initialBackoffMillis: 60 * 1000,
    backoffCapMillis: parseDuration('1h'),
    backoffMultiplier: 1.3,
    baseApiUrl: 'https://cloudprofiler.googleapis.com/v2',
    // This is the largest duration for setTimeout which does not cause it to
    // run immediately.
    // https://nodejs.org/dist/latest-v9.x/docs/api/timers.html#timers_settimeout_callback_delay_args.
    serverBackoffCapMillis: 2147483647,
    localProfilingPeriodMillis: 1000,
    localLogPeriodMillis: 10000,
    localTimeDurationMillis: 1000,
    sourceMapSearchPath: [process.cwd()],
    disableSourceMaps: false,
};
//# sourceMappingURL=config.js.map