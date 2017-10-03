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

import {Config} from './config';
import {Profiler} from './profiler';

let profiler: Profiler|undefined = undefined;

/**
 * Starts the profiling agent and returns a promise.
 * If any error is encountered when profiling, the promise will be rejected.
 *
 * config - Config describing configuration for profiling.
 *
 * @example
 * profiler.start({});
 *
 * @example
 * profiler.start(config);
 *
 */
export function start(config: Config): Promise<void> {
  try {
    profiler = new Profiler(config);
    return profiler.start();
  } catch (e) {
    return Promise.reject(e);
  }
}

// If the module was --require'd from the command line, start the agent.
if (module.parent && module.parent.id === 'internal/preload') {
  start({});
}
