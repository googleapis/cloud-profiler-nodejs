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

import {AuthenticationConfig, Common, Logger, Service, ServiceConfig} from '../third_party/types/common-types';

import {Config} from './config';
import {CpuProfiler} from './profilers/cpu-profiler';
import {HeapProfiler} from './profilers/heap-profiler';

const common: Common = require('@google-cloud/common');

const pjson = require('../../../package.json');
const path = require('path');
const extend = require('extend');

// TODO: finish implementing Profiler.
// TODO: add stop() method to stop profiling.
export class Profiler {
  // The Cloud Console project ID to use instead of the one read from the
  // environment variable GCLOUD_PROJECT.
  projectId: string;

  // Virtual machine instance to associate profiles with instead of the one
  // read from the VM metadata server.
  instance?: string;

  // Zone to associate profiles with instead of the one read from the VM
  // metadata server.
  zone?: string;

  // Specifies the service with which profiles from this application will be
  // associated.
  serviceContext: {
    // Name of the service under which the profiled data will be recorded and
    // exposed in the UI for the project.
    // You can specify an arbitrary string, see deployment.target at
    // https://github.com/googleapis/googleapis/blob/master/google/devtools/cloudprofiler/v2/profiler.proto
    // for restrictions.
    // The string should be the same across different replicas of your service
    // so that a globally constant profiling rate is maintained.
    // service defaults to the value in the environment variable GAE_SERVICE.
    service?: string;

    // Version of the service. It can be an arbitrary string. Stackdriver
    // Profiler profiles each version of each service in each zone once per
    // minute.
    // version defaults to the value in the environment variable GAE_VERSION.
    // If there is no value for GAE_VERSION, it defaults to an empty string.
    version?: string;
  };

  logger: Logger;
  service: Service;

  constructor(config: Config) {
    config = initConfig(config);

    this.service = new common.Service(
        {
          baseUrl: 'https://cloudprofiler.googleapis.com/v2',
          scopes: ['https://www.googleapis.com/auth/monitoring.write'],
        },
        config);

    this.logger = new common.logger({
      level: common.logger.LEVELS[config.logLevel as number],
      tag: pjson.name
    });

    // '{{projectId}}' is a string which is auto-replaced by the projectId
    // fetched from the metadata service.
    this.projectId = config.projectId as string;

    // TODO: fetch zone and instance from metadata if not initialized.
    this.zone = config.zone;
    this.instance = config.instance;
  }

  // Begins collection and uploading of profiles.
  // If profiling fails or another problem is encountered, the returned promise
  // will be rejected.
  // TODO: implement
  // TODO: explain failure situations.
  async start(): Promise<void> {
    return Promise.reject(
        new Error('start() is unimplemented for ProfileAgent'));
  }
}

// default values for Config when initializing the Profiler.
const defaultConfig: Config = {
  projectId: '{{projectId}}',
  logLevel: 1,
  serviceContext: {
    service: undefined,
    version: '',
  },
  disableHeap: false,
  disableCpu: false,
};

// initConfig sets any unset values in the configuration to the default value.
function initConfig(config: Config): Config {
  config = common.util.normalizeArguments(null, config);

  const envConfig = {
    logLevel: process.env.GCLOUD_PROFILER_LOGLEVEL,
    projectId: process.env.GCLOUD_PROJECT,
    serviceContext: {
      service: process.env.GAE_SERVICE,
      version: process.env.GAE_VERSION,
    }
  };

  config = extend(true, {}, defaultConfig, envConfig, config);

  return config;
}
