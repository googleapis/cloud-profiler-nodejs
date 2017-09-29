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

import {CpuProfilerConfig, HeapProfilerConfig, ProfileAgentConfig}
    from './config'

import {AuthenticationConfig, ServiceConfig, Common, Logger, Service} 
    from '../third_party/types/common-types'
export const common: Common = require('@google-cloud/common');


const pjson = require('../../../package.json');
const path = require('path');
const extend = require('extend');

// TODO: finish implementing ProfileAgent
export class ProfileAgent {
  // projectId is the Cloud Console project ID to use instead of the one read
  // from the VM metadata server.
  //
  // Set this if running the agent in your local environment or anywhere
  // outside of Google Cloud Platform.
  projectId: string;

  // instance is the virtual machine instance to be used instead of the one read
  // from the VM metadata server.
  //
  // this field is optional. 
  instance?: string;

  // zone is the zone to be used instead of the one read from the VM metadata
  // server.
  //
  // this field is optional.
  zone?: string;
  serviceContext: {
    // service specified the name of the service under which the profiled data
    // will be recorded and exposed at the Cloud Profiler UI for the project.
    // You can specify an arbitray string, but see deployment.target at
    // https://github.com/googleapis/googleapis/blob/master/google/devtools/cloudprofiler/v2/profiler.proto
	  // for restrictions.
    // The string should be the same across different replicas of your service.
    // so that a globally constant profiling rate is maintained. 
    service: string;

    // version is an optional field, specifying the version of the service.
    // It can be an arbitrary string. Cloud Profiler profiles each version of
    // each service in each zone once per minute.
    // service defaults to an empty string. 
    version?: string;
  };
  
  logger: Logger
  service: Service;

  constructor(config: ProfileAgentConfig) {
    let initializedConfig: ProfileAgentConfig = ProfileAgent.initConfig(config);
    
    
    let serviceConfig = {
      baseUrl: "https://cloudprofiler.googleapis.com/v2",
      scopes: ["https://www.googleapis.com/auth/monitoring.write"],
    };
    this.service = new common.Service(serviceConfig, initializedConfig);
    
    
    let logLevel: number= initializedConfig.logLevel || defaultConfig.logLevel;
    this.logger = new common.logger(
      {level: common.logger.LEVELS[logLevel], tag: pjson.name});

    this.projectId = initializedConfig.projectId || "{{projectId}}";
    
    // TODO: fetch zone and instance from metadata if not initialized. 
    this.zone = initializedConfig.zone;
    this.instance = initializedConfig.instance;
  }

  // start begins a collection and uploading of profiles.
  // Currently unimplemented.
  // TODO: implement 
  async start(): Promise<void> {
    throw new Error('start() is unimplemented for ProfileAgent');
  } 

  // initConfig sets values .
  static initConfig(config: ProfileAgentConfig): ProfileAgentConfig {
    let normalizedConfig =  common.util.normalizeArguments(null, config);
    
    let envConfig = {
      logLevel: process.env.GCLOUD_TRACE_LOGLEVEL,
      projectId: process.env.GCLOUD_PROJECT,
      serviceContext: {
        service: process.env.GAE_SERVICE || process.env.GAE_MODULE_NAME,
        version: process.env.GAE_VERSION || process.env.GAE_MODULE_VERSION,
        minorVersion: process.env.GAE_MINOR_VERSION
      }
    };

    let envSetConfig = {};
    if (process.env.hasOwnProperty('GCLOUD_PROFILE_CONFIG')) {
      envSetConfig = require(path.resolve(process.env.GCLOUD_TRACE_CONFIG));
    }

    let initializedConfig = extend(true, {}, defaultConfig, envSetConfig, 
      envConfig, config);

    return initializedConfig;
  }
}


// Unimplemented stub of HeapProfiler
// TODO: implement  
class HeapProfiler {
  constructor(config: HeapProfilerConfig) {

  }
}

// Unimplemented stub of CpuProfiler
// TODO: implement 
class CpuProfiler {
  constructor(config: CpuProfilerConfig){

  }
}

const defaultConfig = {
  logLevel: 1,
  heap: {disable: false},
  cpu: {disbale: false},
};