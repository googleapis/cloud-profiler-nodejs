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

import * as http from 'http';
import * as path from 'path';
import * as pify from 'pify';
import * as zlib from 'zlib';

import {perftools} from '../src/profile';
import {AuthenticationConfig, Common, Logger, Service, ServiceConfig, ServiceObject, ServiceObjectConfig} from '../third_party/types/common-types';

import {ProfilerConfig} from './config';
import {HeapProfiler} from './profilers/heap-profiler';
import {TimeProfiler} from './profilers/time-profiler';

export const common: Common = require('@google-cloud/common');
const pjson = require('../../package.json');
const API = 'https://cloudprofiler.googleapis.com/v2';
const gzip = pify(zlib.gzip);

export interface ProfilerConfig extends AuthenticationConfig {
  logLevel: number;
  serviceContext: {service: string; version?: string;};
  instance: string;
  zone: string;
  disableTime: boolean;
  disableHeap: boolean;
}
// Interface for body of response from Stackdriver Profiler API when creating
// profile and used as body of request to Stackdriver Profiler API when
// uploading a profile.
// Public for testing.
const WALL_TYPE = 'WALL';
const HEAP_TYPE = 'HEAP';
const SAMPLING_INTERVAL_MICROS = 1000;

/**
 * Interface for body of response from Stackdriver Profiler API when creating
 * profile and used as body of request to Stackdriver Profiler API when
 * uploading a profile.
 *
 * Public for testing.
 */
export interface RequestProfile {
  name?: string;
  profileType?: string;
  duration?: any;
  profileBytes?: string;
  labels?: {instance?: string; zone?: string};
}

/**
 * Converts a profile to a compressed, base64 encoded string.
 *
 * @param p - profile to be converted to string.
 */
async function profileBytes(p: perftools.profiles.IProfile): Promise<string> {
  const pwriter = perftools.profiles.Profile.encode(p);
  const buffer = new Buffer(pwriter.finish());
  const gzBuf = await gzip(buffer);
  return gzBuf.toString('base64');
}

/**
 * Polls Stackdriver Profiler server for instructions on behalf of a task and
 * collects and uploads profiles as requested
 */
export class Profiler extends common.ServiceObject {
  private config: ProfilerConfig;
  private logger: Logger;
  private profileTypes: string[];
  private continueProfiling: boolean;

  // Public for testing.
  timeProfiler: TimeProfiler|undefined;

  constructor(config: ProfilerConfig) {
    config = common.util.normalizeArguments(null, config);
    const serviceConfig = {
      baseUrl: API,
      scopes: ['https://www.googleapis.com/auth/monitoring.write'],
      packageJson: pjson,
    };
    super({parent: new common.Service(serviceConfig, config), baseUrl: '/'});

    this.config = config;

    this.logger = new common.logger({
      level: common.logger.LEVELS[config.logLevel as number],
      tag: pjson.name
    });

    // TODO: enable heap profiling once heap-profiler implemented.
    this.profileTypes = [];
    if (!this.config.disableTime) {
      this.profileTypes.push(WALL_TYPE);
      this.timeProfiler = new TimeProfiler(SAMPLING_INTERVAL_MICROS);
    }
  }

  /**
   * Starts and endless loop to poll Stackdriver Profiler server for
   * instructions, and collects and uploads profiles as requested.
   * If there is a problem when collecting a profile or uploading a profile to
   * Stackdriver Profiler, this problem will be logged at the debug level.
   * If there is a problem polling Stackdriver Profiler for instructions
   * on the type of profile created, an error will be thrown.
   */
  async start(): Promise<void> {
    while (true) {
      const prof = await this.createProfile();
      try {
        await this.profileAndUpload(prof);
      } catch (err) {
        this.logger.debug(err);
      }
    }
  }

  /**
   * Talks to Stackdriver Profiler server to create profile.
   * If any problem is encountered, an error will be thrown.
   * TODO: retry rather than fail when createProfile() throws error.
   *
   * Public to allow for testing.
   */
  async createProfile(): Promise<RequestProfile> {
    const reqBody = {
      deployment: {
        projectId: this.config.projectId,
        target: this.config.serviceContext.service,
        labels: {zone: this.config.zone, instance: this.config.instance},
      },
      profileType: this.profileTypes,
    };
    const options = {
      method: 'POST',
      uri: API + '/projects/' + this.config.projectId + '/profiles',
      body: reqBody,
      json: true,
    };
    return new Promise<any>((resolve, reject) => {
      this.request(
          options,
          function(
              err: Error, body: RequestProfile, response: http.ServerResponse) {
            err ? reject(err) : resolve(body);
          });
    });
  }

  /**
   * Collects a profile of the type specified by the profileType field of prof.
   * If any problem is encountered, like a problem collecting or uploading the
   * profile, an error will be thrown.
   *
   * Public to allow for testing.
   *
   * @param prof
   */
  async profileAndUpload(prof: RequestProfile): Promise<void> {
    prof = await this.writeTimeProfile(prof);
    const options = {
      method: 'PATCH',
      uri: API + '/' + prof.name,
      body: prof,
      json: true,
    };
    return new Promise<any>((resolve, reject) => {
      this.request(
          options,
          function(err: Error, body: any, response: http.ServerResponse) {
            err ? reject(new Error('failed to upload profile: ' + err)) :
                  resolve();
          });
    });
  }

  /**
   * Collects a profile of the type specified by the profileType field of prof.
   * If any problem is encountered, for example the profileType is not
   * recognized or profiling is disabled for the specified profileType, an
   * error will be thrown.
   *
   * Public to allow for testing.
   *
   * @param prof
   */
  async profile(prof: RequestProfile): Promise<RequestProfile> {
    switch (prof.profileType) {
      case WALL_TYPE:
        if (this.config.disableTime) {
          throw new Error('time profiling is not enabled');
        }
        return this.writeTimeProfile(prof);
      case HEAP_TYPE:
        if (this.config.disableHeap) {
          throw new Error('heap profiling is not enabled');
        }
        return this.writeHeapProfile(prof);
      default:
        throw new Error('unexpected profile type ' + prof.profileType);
    }
  }

  /**
   * Collects a time profile, converts profile to compressed, base64 encoded
   * string, and adds profileBytes field to prof with this string.
   *
   * Public to allow for testing.
   *
   * @param prof
   */
  async writeTimeProfile(prof: RequestProfile): Promise<RequestProfile> {
    if (this.timeProfiler) {
      // TODO: determine time from request profile.
      const duration = 10 * 1000;  // 10 seconds
      const p = await this.timeProfiler.profile(duration);
      prof.profileBytes = await profileBytes(p);
      return prof;
    } else {
      throw Error('cannot collect time profile, time profiler not enabled');
    }
  }

  /**
   * Collects a time profile, converts profile to compressed, base64 encoded
   * string, and adds profileBytes field to prof with this string.
   *
   * Public to allow for testing.
   *
   * Unimplemented
   *
   * @param prof
   */
  async writeHeapProfile(prof: RequestProfile): Promise<RequestProfile> {
    throw new Error('heap profile collection unimplemented.');
  }
}
