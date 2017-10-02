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

import {AuthenticationConfig, ServiceConfig} from '../third_party/types/common-types';

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
    // version defaults to the value in the environment variable GAE_VERSION.
    // If there is no value for GAE_VERSION, it defaults to an empty string.
    version?: string;
  };

  // Virtual machine instance to associate profiles with instead of the one
  // read from the VM metadata server.
  instance?: string;

  // Zone to associate profiles with instead of the one read from the VM
  // metadata server.
  zone?: string;

  // When true, CPU profiling will be disabled.
  // The default value is false.
  disableCpu?: boolean;

  // When true, heap profiling will be disabled.
  // The default value is false.
  disableHeap?: boolean;
}
