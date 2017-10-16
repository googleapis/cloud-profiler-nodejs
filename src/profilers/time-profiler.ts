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

import * as delay from 'delay';

import {perftools} from '../profile';
import {serializeTimeProfile} from './profile-serializer';

const timeProfiler = require('bindings')('time_profiler');

export class TimeProfiler {
  // True when the profiler is actively profiling.
  private profiling: boolean;

  // samplingInterval is average time in microseconds between samples.
  constructor(private samplingInterval: number) {
    this.profiling = false;
    timeProfiler.setSamplingInterval(this.samplingInterval);
  }

  // Collects a profile for the duration, in milliseconds, specified by
  // profileDuration.
  // Returns the collected profile.
  // If profiling is already started, throws error.
  async profile(profileDuration: number): Promise<perftools.profiles.IProfile> {
    if (this.profiling) {
      throw new Error('already profiling with TimeProfiler');
    }
    this.profiling = true;
    timeProfiler.startProfiling('', true);
    await delay(profileDuration);
    let result = timeProfiler.stopProfiling('');
    this.profiling = false;
    return serializeTimeProfile(result, this.samplingInterval);
  }

  // Returns true if the TimeProfiler is currently profiling and false
  // otherwise.
  isRunning(): boolean {
    return this.profiling;
  }
}
