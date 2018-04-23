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

import {Buffer} from 'buffer';
import * as pify from 'pify';
import * as util from 'util';
import * as zlib from 'zlib';

import {perftools} from '../../../proto/profile';

const gzip = pify(zlib.gzip);
const profiler = require('bindings')('sampling_heap_profiler');

export class HeapProfiler {
  private enabled = false;

  /**
   * @param intervalBytes - average bytes between samples.
   * @param stackDepth - upper limit on number of frames in stack for sample.
   */
  constructor(private intervalBytes: number, private stackDepth: number) {
    this.enable();
  }

  /**
   * Collects a heap profile when heapProfiler is enabled. Otherwise throws
   * an error.
   */
  async profile(): Promise<string> {
    if (!this.enabled) {
      throw new Error('Heap profiler is not enabled.');
    }
    const startTimeNanos = Date.now() * 1000 * 1000;
    const b =
        profiler.getAllocationProfile(startTimeNanos, this.intervalBytes);
    const gzBuf = await gzip(b);
    return gzBuf.toString('base64');
  }

  enable() {
    profiler.startSamplingHeapProfiler(this.intervalBytes, this.stackDepth);
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    profiler.stopSamplingHeapProfiler();
  }
}
