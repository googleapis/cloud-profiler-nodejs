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

'use strict';

import {ProfileAgentConfig} from './config';
import {ProfileAgent} from './agent';

/**
 * Start the profiling agent.
 * Currently unimplemented
 *
 * config - ProfileAgentConfig describing configuration for profiling.
 *
 * @example
 * profiler.start();
 */
export function start(config: ProfileAgentConfig) {
  let agent = new ProfileAgent(config);
  agent.start()
}

// If the module was --require'd from the command line, start the agent.
if (module.parent && module.parent.id === 'internal/preload') {
  start({});
}

