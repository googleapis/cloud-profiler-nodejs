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

import * as extend from 'extend';
import * as path from 'path';
import * as request from 'request';

import {AuthenticationConfig, Common, ServiceConfig, ServiceObject} from '../third_party/types/common-types';

import {Config, defaultConfig} from './config';
import {Profiler, ProfilerConfig} from './profiler';

const common: Common = require('@google-cloud/common');
const metadataAPI = 'http://metadata.google.internal/computeMetadata/v1/';

// Returns a promise which will resolve to true if running on GCE and false
// otherwise.
// It is assumed a program is running on GCE if the metadata API can be
// accessed.
function onGCE(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    request.get(
        {url: metadataAPI, headers: {'Metadata-Flavor': 'Google'}},
        function(err: Error, response) {
          err ? resolve(false) : resolve(true);
        });
  });
}

// Returns a promise that resolves to the value of metadata field.
// Promise will be rejected if there is a problem accessing metadata API.
function getField(field: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    request.get(
        {url: metadataAPI + field, headers: {'Metadata-Flavor': 'Google'}},
        function(err: Error, response: request.RequestResponse) {
          err ? reject(err) : resolve(response.body);
        });
  });
}

// initConfig sets unset values in the configuration to the value retrieved from
// environment variables, metadata, or the default value specified in
// defaultConfig.
// Returns rejected promise if value that must be set cannot be initialized.
// Exported for testing purposes.
export async function initConfig(config: Config): Promise<ProfilerConfig> {
  config = common.util.normalizeArguments(null, config);

  const envConfig: any = {
    projectId: process.env.GCLOUD_PROJECT,
    serviceContext: {
      service: process.env.GAE_SERVICE,
      version: process.env.GAE_VERSION,
    }
  };

  if (process.env.GCLOUD_PROFILER_LOGLEVEL !== undefined) {
    let envLogLevel = parseInt(process.env.GCLOUD_PROFILER_LOGLEVEL || '', 10);
    if (envLogLevel !== NaN) {
      envConfig.logLevel = envLogLevel;
    }
  }

  let envSetConfig: Config = {};
  if (process.env.hasOwnProperty('GCLOUD_PROFILER_CONFIG')) {
    envSetConfig =
        require(path.resolve(process.env.GCLOUD_PROFILER_CONFIG)) as Config;
  }

  let normalizedConfig =
      extend(true, {}, defaultConfig, envSetConfig, envConfig, config);

  // fetch instance and zone from metadata if not specified and on GCE
  if (await onGCE()) {
    if (!normalizedConfig.instance) {
      normalizedConfig.instance = await getField('instance/name').catch((e) => {
        throw Error('failed to get instance from Compute Engine: ' + e);
      });
    }
    if (!normalizedConfig.zone) {
      let zone = await getField('instance/zone').catch((e) => {
        throw Error('failed to get zone from Compute Engine: ' + e);
      });
      normalizedConfig.zone = zone.substring(zone.lastIndexOf('/') + 1);
    }
  }

  if (normalizedConfig.projectId === undefined) {
    throw new Error('projectId must be specified in the configuration');
  }

  return normalizedConfig;
}

let profiler: Profiler|undefined = undefined;

/**
 * Starts the profiling agent and returns a promise.
 * If any error is encountered when profiling, the promise will be rejected.
 *
 * config - Config describing configuration for profiling.
 *
 * @example
 * profiler.start();
 *
 * @example
 * profiler.start(config);
 *
 */
export async function start(config: Config = {}): Promise<void> {
  const normalizedConfig = await initConfig(config);
  profiler = new Profiler(normalizedConfig);
  return profiler.start();
}

// If the module was --require'd from the command line, start the agent.
if (module.parent && module.parent.id === 'internal/preload') {
  start();
}
