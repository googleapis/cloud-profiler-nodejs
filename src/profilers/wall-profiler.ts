import {perftools} from '../profile';
import {serializeWallProfile} from './profile-serializer';
const wallProfiler = require('bindings')('wall_profiler');

export class WallProfiler {
  // Average time in microseconds between samples.
  samplingInterval: number;

  // True when the profiler is actively profiling.
  private profiling: boolean;

  constructor(samplingInterval: number) {
    this.samplingInterval = samplingInterval;  // us
    this.profiling = false;
    wallProfiler.setSamplingInterval(this.samplingInterval);
  }

  // Collects a profile for the duration, in milliseconds, specified by
  // profileDuration.
  // Returns a promise which will resolve to the collected profile.
  // If profiling is already started, the returned promise will be rejected.
  async profile(profileDuration: number): Promise<perftools.profiles.IProfile> {
    const that = this;
    if (!that.profiling) {
      that.profiling = true;
      wallProfiler.startProfiling('', true);
      return new Promise(function(resolve) {
        setTimeout(function() {
          let result = wallProfiler.stopProfiling('');
          that.profiling = false;
          let profile = serializeWallProfile(result, that.samplingInterval);
          resolve(profile);
        }, profileDuration);
      });
    }
    return Promise.reject(new Error('already profiling with WallProfiler'));
  }

  // Returns true if the WallProfiler is currently profiling and false
  // otherwise.
  isRunning(): boolean {
    return this.profiling;
  }
}
