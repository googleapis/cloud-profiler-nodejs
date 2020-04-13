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
import { SemVer } from 'semver';
import { Config } from './config';
import { Profiler } from './profiler';
/**
 * Returns true if the version passed in satifised version requirements
 * specified in the profiler's package.json.
 *
 * Exported for testing.
 */
export declare function nodeVersionOkay(version: string | SemVer): boolean;
/**
 * Initializes the config, and starts heap profiler if the heap profiler is
 * needed. Returns a profiler if creation is successful. Otherwise, returns
 * rejected promise.
 */
export declare function createProfiler(config: Config): Promise<Profiler>;
/**
 * Starts the profiling agent and returns a promise.
 * If any error is encountered when configuring the profiler the promise will
 * be rejected. Resolves when profiling is started.
 *
 * config - Config describing configuration for profiling.
 *
 * @example
 * profiler.start();
 *
 * @example
 * profiler.start(config);
 *
 */
export declare function start(config?: Config): Promise<void>;
/**
 * For debugging purposes. Collects profiles and discards the collected
 * profiles.
 */
export declare function startLocal(config?: Config): Promise<void>;
