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

import {AuthenticationConfig, Common, ServiceConfig} from '../third_party/types/common-types';

const common: Common = require('@google-cloud/common');
const extend = require('extend');

// Configuration for Profiler.
export interface Config extends AuthenticationConfig {
  // Log levels: 0-disabled,1-error,2-warn,3-info,4-debug.
  // Defaults to value of 1.
  logLevel?: number;

  // Specifies the service with which profiles from this application will be
  // associated.
  serviceContext?: {
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
    // Defaults to the value in the environment variable GAE_VERSION.
    // If there is no value for GAE_VERSION, it defaults to an empty string.
    version?: string;
  };

  // Virtual machine instance to associate profiles with instead of the one
  // read from the VM metadata server.
  // Defaults to an empty string.
  instance?: string;

  // Zone to associate profiles with instead of the one read from the VM
  // metadata server.
  // Defaults to an empty string.
  zone?: string;

  // When true, CPU profiling will be disabled.
  // Defaults to false.
  disableCpu?: boolean;

  // When true, heap profiling will be disabled.
  // Defaults to false.
  disableHeap?: boolean;
}

// Default values for configuration for a profiler.
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

// initConfig sets unset values in the configuration to the value retrieved from
// environment variables or to the default value specified in defaultConfig.
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

export class ConfigImpl implements Config {
  // The Cloud Console project ID.
  // Defaults to value of environment variable GCLOUD_PROJECT.
  projectId: string;

  // Path to a service account .json, .pem or .p12 key file.
  keyFilename?: string;

  // Required when using .p12 or pem key files.
  email?: string;

  // Instead of a keyFilename, credentials can also be provided inline.
  credentials?: {client_email?: string; private_key?: string;};

  // Log levels: 0-disabled,1-error,2-warn,3-info,4-debug.
  // Defaults to value of 1.
  logLevel: number;

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
    // service defaults to the value of the environment variable GAE_SERVICE.
    service: string;

    // Version of the service. It can be an arbitrary string. Stackdriver
    // Profiler profiles each version of each service in each zone once per
    // minute.
    // Defaults to the value in the environment variable GAE_VERSION.
    // If there is no value for GAE_VERSION, it defaults to an empty string.
    version: string;
  };

  // Virtual machine instance to associate profiles with instead of the one
  // read from the VM metadata server.
  // Defaults to an empty string.
  instance: string;

  // Zone to associate profiles with instead of the one read from the VM
  // metadata server.
  // Defaults to an empty string.
  zone: string;

  // When true, CPU profiling will be disabled.
  // Defaults to false.
  disableCpu: boolean;

  // When true, heap profiling will be disabled.
  // Defaults to false.
  disableHeap: boolean;


  // Constructor for config.
  // If a value for a required field cannot be determined from environment
  // variables, metadata, or defaults, an error will be thrown.
  constructor(config: Config) {
    config = initConfig(config);

    this.keyFilename = config.keyFilename;
    this.email = config.email;
    this.credentials = config.credentials;
    this.logLevel = config.logLevel || 1;
    this.disableCpu = config.disableCpu || false;
    this.disableHeap = config.disableCpu || false;

    if (config.serviceContext !== undefined && config.serviceContext.service) {
      this.serviceContext = {
        service: config.serviceContext.service,
        version: config.serviceContext.version || ''
      };
    } else {
      throw new Error('service name must be specified in the configuration');
    }

    // '{{projectId}}' is a string which is auto-replaced by the projectId
    // fetched from the metadata service.
    this.projectId = config.projectId || '{{projectId}}';

    // TODO: fetch zone and instance from metadata if not initialized.
    this.zone = config.zone || '';
    this.instance = config.instance || '';
  }
}
