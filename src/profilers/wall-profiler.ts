import * as delay from 'delay';

import {perftools} from '../profile';

import {serializeWallProfile} from './profile-serializer';

const wallProfiler = require('bindings')('wall_profiler');

export class WallProfiler {
  // True when the profiler is actively profiling.
  private profiling: boolean;

  // samplingInterval is average time in microseconds between samples.
  constructor(private samplingInterval: number) {
    this.profiling = false;
    wallProfiler.setSamplingInterval(this.samplingInterval);
  }

  // Collects a profile for the duration, in milliseconds, specified by
  // profileDuration.
  // Returns the collected profile.
  // If profiling is already started, throws error.
  async profile(profileDuration: number): Promise<perftools.profiles.IProfile> {
    if (this.profiling) {
      throw new Error('already profiling with WallProfiler');
    }
    this.profiling = true;
    wallProfiler.startProfiling('', true);
    return delay(profileDuration).then(() => {
      let result = wallProfiler.stopProfiling('');
      this.profiling = false;
      let profile = serializeWallProfile(result, this.samplingInterval);
      return profile;
    });
  }

  // Returns true if the WallProfiler is currently profiling and false
  // otherwise.
  isRunning(): boolean {
    return this.profiling;
  }
}
