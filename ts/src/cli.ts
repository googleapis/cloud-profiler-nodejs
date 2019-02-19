import { writeFileSync, fstat } from 'fs';
import { gzipSync } from 'zlib';
import {TimeProfiler} from './profilers/time-profiler';
import {perftools} from '../../proto/profile';

const DEFAULT_INTERVAL_MICROS = 1000;  // 1ms.

let timeProfiler: TimeProfiler;
function profile(intervalMicros = DEFAULT_INTERVAL_MICROS) {
  if (timeProfiler) {
    throw new Error('already profiling');
  }
  timeProfiler = new TimeProfiler(intervalMicros);
  timeProfiler.startProfiling();
}

process.on('exit', code => {
  if (!timeProfiler)
    return;

  // The process is going to terminate imminently. All the work here needs to
  // be synchronous.
  const profile = timeProfiler.stopProfiling();
  const buffer = perftools.profiles.Profile.encode(profile).finish();
  const gzBuffer = gzipSync(buffer);
  writeFileSync('./profile.pb.gz', gzBuffer);
});

profile();
