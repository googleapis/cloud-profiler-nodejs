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

import {AuthenticationConfig, ServiceConfig} from
    '../third_party/types/common-types';

// ProfileAgentConfig is the configuration for the profiler.
export interface ProfileAgentConfig extends AuthenticationConfig {
  // Log levels: 0-disabled,1-error,2-warn,3-info,4-debug.
  // Defaults value of 1.
  logLevel?: number;

  // Specifies the service with which profiles from this application
  // will be associated.
  serviceContext?: {
    // service specified the name of the service under which the profiled data
    // will be recorded and exposed at the Cloud Profiler UI for the project.
    // You can specify an arbitray string, but see deployment.target at
    // https://github.com/googleapis/googleapis/blob/master/google/devtools/cloudprofiler/v2/profiler.proto
    // for restrictions.
    // The string should be the same across different replicas of your service.
    // so that a globally constant profiling rate is maintained. 
    // If service is not specified, the value will default to the value of 
    // GAE_SERVICE or GAE_MODULE_NAME (in that order)
    service: string;

    // version is a field specifying the version of the service.
    // It can be an arbitrary string. Cloud Profiler profiles each version of
    // each service in each zone once per minute.
    // service defaults to an empty string. 
    version?: string;
  };

  // Configuration for heap profiling.
  heap?: HeapProfilerConfig;

  // Configuration for cpu profiling.
  cpu?: CpuProfilerConfig;

  // instance is the virtual machine instance to be used instead of the one read
  // from the VM metadata server.
  instance?: string;
  
  // zone is the zone to be used instead of the one read from the VM metadata
  // server.
  zone?: string;
}

// HeapProfilerConfig is the configuration for the heap profiler.
export interface HeapProfilerConfig {
  // When disable is true, heap profiling will be disabled.
  // The default value is false.
  disable?: boolean;
}

// CpuProfilerConfig is the configuration for the cpu profiler.
export interface CpuProfilerConfig {
  // When disable is true, cpu profiling will be disabled.
  // The default value is false.
  disable?: boolean;
}