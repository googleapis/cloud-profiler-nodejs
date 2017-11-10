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
import * as http from 'http';
import * as path from 'path';
import * as pify from 'pify';
import * as zlib from 'zlib';

import {perftools} from '../../proto/profile';
import {AuthenticationConfig, Common, Logger, Service, ServiceConfig, ServiceObject, ServiceObjectConfig} from '../third_party/types/common-types';
import {ProfilerConfig} from './config';
import {HeapProfiler} from './profilers/heap-profiler';
import {TimeProfiler} from './profilers/time-profiler';

export const common: Common = require('@google-cloud/common');
const pjson = require('../../package.json');
const API = 'https://cloudprofiler.googleapis.com/v2';
const zoneNameLabel = 'zone';
const versionLabel = 'version';
const instanceLabelName = 'instance';
const scope = 'https://www.googleapis.com/auth/monitoring.write';
const gzip = pify(zlib.gzip);

enum ProfileTypes {
  Wall = 'WALL',
  Heap = 'HEAP'
}

/**
 * Parses string containing a time duration, and returns this duration in ms.
 * If duration cannot be parsed, returns undefined.
 *
 * Public for testing.
 */
export function parseDurationMillis(durationString: string): number|undefined {
  if (!/(d+h)?(d+m)?(d+s)?(d+ms)?(d+us)?(d+ns)?/.test(durationString)) {
    return undefined;
  }
  const values = durationString.match(/\d+(h|m(?!s)|s|ms|us|ns)/g);
  if (values == null) {
    return undefined;
  }
  let durationMillis = 0;
  values.forEach(element => {
    const digit = element.match(/\d+/);
    const unit = element.match(/\D+/);
    if (unit && digit) {
      const num = Number(digit[0]);
      switch (unit[0]) {
        case 'h':
          durationMillis = durationMillis + num * 60 * 60 * 1000;
          break;
        case 'm':
          durationMillis = durationMillis + num * 60 * 1000;
          break;
        case 's':
          durationMillis = durationMillis + num * 1000;
          break;
        case 'ms':
          durationMillis = durationMillis + num;
          break;
        case 'us':
          durationMillis = durationMillis + num / 1000;
          break;
        case 'ns':
          durationMillis = durationMillis + num / (1000 * 1000);
          break;
        default:
          break;
      }
    }
  });
  return durationMillis;
}

/**
 * Returns true if http status code indicates an error.
 */
function isErrorResponseStatusCode(code: number) {
  return code < 200 || code >= 300;
}

/**
 * Interface for deployment field of RequestProfile. Profiles with matching
 * deployments will be grouped together.
 * Used as body of request when creating profile using the profiler API.
 *
 * Public for testing.
 */
export interface Deployment {
  projectId?: string;
  target?: string;
  labels?: {zone?: string, version?: string};
}

/**
 * Interface for body of response from profiler API when creating
 * profile and used as body of request to profiler API when
 * uploading a profile.
 *
 * Public for testing.
 */
export interface RequestProfile {
  name: string;
  profileType?: string;
  duration: string;
  profileBytes?: string;
  deployment?: Deployment;
  labels?: {instance: string};
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
 * Polls profiler server for instructions on behalf of a task and
 * collects and uploads profiles as requested
 */
export class Profiler extends common.ServiceObject {
  private config: ProfilerConfig;
  private logger: Logger;
  private profileLabels: {instance: string};
  private deployment: Deployment;
  private profileTypes: string[];

  // Public for testing.
  timeProfiler: TimeProfiler|undefined;
  heapProfiler: HeapProfiler|undefined;

  constructor(config: ProfilerConfig) {
    config = common.util.normalizeArguments(null, config);
    const serviceConfig = {
      baseUrl: API,
      scopes: [scope],
      packageJson: pjson,
    };
    super({parent: new common.Service(serviceConfig, config), baseUrl: '/'});

    this.config = config;

    this.logger = new common.logger({
      level: common.logger.LEVELS[config.logLevel as number],
      tag: pjson.name
    });

    this.deployment = {
      projectId: this.config.projectId,
      target: this.config.serviceContext.service,
      labels: {
        zone: this.config.zone,
        version: this.config.serviceContext.version
      }
    };

    this.profileLabels = {instance: this.config.instance};

    this.profileTypes = [];
    if (!this.config.disableTime) {
      this.profileTypes.push(ProfileTypes.Wall);
      this.timeProfiler = new TimeProfiler(this.config.timeIntervalMicros);
    }
    if (!this.config.disableHeap) {
      this.profileTypes.push(ProfileTypes.Heap);
      this.heapProfiler = new HeapProfiler(
          this.config.heapIntervalBytes, this.config.heapMaxStackDepth);
    }
  }

  /**
   * Starts and endless loop to poll profiler server for
   * instructions, and collects and uploads profiles as requested.
   * If there is a problem when collecting a profile or uploading a profile to
   * profiler server, this problem will be logged at the debug level.
   * If there is a problem polling profiler server for instructions
   * on the type of profile created, this problem will be logged. If the problem
   * indicates one definitely will not be able to profile, an error will be
   * thrown.
   */
  async start(): Promise<void> {
    return this.pollProfilerService();
  }

  /**
   * Endlessly polls the profiler server for instructions, and collects and
   * uploads profiles as requested.
   */
  async pollProfilerService(): Promise<void> {
    const startCreateMillis = Date.now();
    const prof = await this.createProfile();
    await this.profileAndUpload(prof);
    const endCreateMillis = Date.now();

    // Schedule the next profile.
    setTimeout(this.pollProfilerService.bind(this), 0).unref();
  }

  /**
   * Talks to profiler server, which hangs until server indicates
   * job should be profiled.
   *
   * If any problem is encountered, the problem will be logged and
   * createProfile() will be retried.
   *
   * TODO: implement backoff and retry when error encountered. createProfile()
   * should be retried at time response indicates this request should be retried
   * or with exponential backoff (up to one hour) if the response does not
   * indicate when to retry this request. Once this is implemented, an error
   * will be thrown only if the error indicates one definitely should not
   * retry createProfile.
   *
   * TODO (issue #28): right now, this call could hang for up to an hour when
   * this method is the only thing on the event loop, keeping the program open
   * even when all work is done. Should expose the ability to cancel the http
   * request made here, and then determine when to cancel this request.
   *
   * Public to allow for testing.
   */
  async createProfile(): Promise<RequestProfile> {
    const reqBody = {
      deployment: this.deployment,
      profileType: this.profileTypes,
    };
    const options = {
      method: 'POST',
      uri: '/profiles',
      body: reqBody,
      json: true,
    };

    try {
      const results = await this.request(options);
      // TODO: check types, don't cast.
      const body = results[0] as RequestProfile;
      const response = results[1] as http.ServerResponse;

      if (isErrorResponseStatusCode(response.statusCode)) {
        this.logger.error('Error creating profile: ' + response.statusMessage);
      } else {
        return body;
      }
    } catch (err) {
      this.logger.error('Error creating profile: ' + err.toString());
    }

    // TODO: determine which codes and errors one should not retry on.
    // TODO: check response to see if response specifies a backoff.
    // TODO: implement exponential backoff.
    await delay(this.config.backoffMillis);
    return this.createProfile();
  }

  /**
   * Collects a profile of the type specified by the profileType field of prof.
   * If any problem is encountered, like a problem collecting or uploading the
   * profile, an error will be logged at the debug level, but otherwise ignored.
   *
   * Public to allow for testing.
   */
  async profileAndUpload(prof: RequestProfile): Promise<void> {
    try {
      prof = await this.profile(prof);
      prof.labels = this.profileLabels;
    } catch (err) {
      this.logger.debug('Error collecting profile: ' + err.toString());
      return;
    }
    const options = {
      method: 'PATCH',
      uri: API + '/' + prof.name,
      body: prof,
      json: true,
    };
    try {
      const results = await this.request(options);
      const response = results[1] as http.ServerResponse;

      if (isErrorResponseStatusCode(response.statusCode)) {
        this.logger.debug('Error uploading profile: ' + response.statusMessage);
      }
    } catch (err) {
      this.logger.debug('Error uploading profile: ' + err.toString());
    }
  }

  /**
   * Collects a profile of the type specified by the profileType field of prof.
   * If any problem is encountered, for example the profileType is not
   * recognized or profiling is disabled for the specified profileType, an
   * error will be thrown.
   *
   * Public to allow for testing.
   */
  async profile(prof: RequestProfile): Promise<RequestProfile> {
    switch (prof.profileType) {
      case ProfileTypes.Wall:
        return await this.writeTimeProfile(prof);
      case ProfileTypes.Heap:
        return this.writeHeapProfile(prof);
      default:
        throw new Error('Unexpected profile type ' + prof.profileType + '.');
    }
  }

  /**
   * Collects a time profile, converts profile to compressed, base64 encoded
   * string, and adds profileBytes field to prof with this string.
   *
   * Public to allow for testing.
   */
  async writeTimeProfile(prof: RequestProfile): Promise<RequestProfile> {
    if (this.timeProfiler) {
      // TODO: determine time from request profile.
      const durationMillis = parseDurationMillis(prof.duration);
      if (!durationMillis) {
        throw Error(
            'Cannot collect time profile, duration \"' + prof.duration +
            '\" cannot be parsed');
      }
      const p = await this.timeProfiler.profile(durationMillis);
      prof.profileBytes = await profileBytes(p);
      return prof;
    }
    throw Error('Cannot collect time profile, time profiler not enabled.');
  }

  /**
   * Collects a time profile, converts profile to compressed, base64 encoded
   * string, and adds profileBytes field to prof with this string.
   *
   * Public to allow for testing.
   *
   */
  async writeHeapProfile(prof: RequestProfile): Promise<RequestProfile> {
    if (this.heapProfiler) {
      const p = this.heapProfiler.profile();
      prof.profileBytes = await profileBytes(p);
      return prof;
    }
    throw Error('Cannot collect heap profile, heap profiler not enabled.');
  }
}
