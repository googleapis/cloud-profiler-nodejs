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
