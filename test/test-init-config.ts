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

import * as assert from 'assert';
import * as nock from 'nock';
import * as request from 'request';
import {initConfig} from '../src/index';

nock.disableNetConnect();
const metadataAPI = 'http://metadata.google.internal/computeMetadata/v1';

describe('initConfig', () => {
  let processLogLevel: string|undefined;
  let processCloudProject: string|undefined;
  let processService: string|undefined;
  let processVersion: string|undefined;
  let processConfig: string|undefined;

  before(() => {
    processLogLevel = process.env.GCLOUD_PROFILER_LOGLEVEL;
    processCloudProject = process.env.GCLOUD_PROJECT;
    processService = process.env.GAE_SERVICE;
    processVersion = process.env.GAE_VERSION;
    processConfig = process.env.GCLOUD_PROFILER_CONFIG;
  });

  beforeEach(() => {
    delete process.env.GCLOUD_PROFILER_LOGLEVEL;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GAE_SERVICE;
    delete process.env.GAE_VERSION;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  after(() => {
    process.env.GCLOUD_PROFILER_LOGLEVEL = processLogLevel;
    process.env.GCLOUD_PROJECT = processCloudProject;
    process.env.GAE_SERVICE = processService;
    process.env.GAE_VERSION = processVersion;
    process.env.GCLOUD_PROFILER_CONFIG = processConfig;
  });

  it('should not modify specified fields when not on GCE', async () => {
    let metadata = nock(metadataAPI)
                       .get('/')
                       .reply(500)
                       .get('/instance/name')
                       .reply(500)
                       .get('/instance/zone')
                       .reply(500)
                       .get('/project/project-id')
                       .reply(500);
    const config = {
      logLevel: 2,
      serviceContext: {version: 'fake-version', service: 'fake-service'},
      disableHeap: true,
      disableCpu: true,
      instance: 'instance',
      zone: 'zone',
      projectId: 'fake-projectId'
    };
    let initializedConfig = await initConfig(config);
    assert.deepEqual(initializedConfig, config);
  });

  it('should not modify specified fields when on GCE', async () => {
    let metadata = nock(metadataAPI)
                       .get('/')
                       .reply(200)
                       .get('/instance/name')
                       .reply(200, 'gce-instance')
                       .get('/instance/zone')
                       .reply(200, 'projects/123456789012/zones/gce-zone')
                       .get('/project/project-id')
                       .reply(200, 'gce-projectId');
    const config = {
      logLevel: 2,
      serviceContext: {version: 'fake-version', service: 'fake-service'},
      disableHeap: true,
      disableCpu: true,
      instance: 'instance',
      zone: 'zone',
      projectId: 'fake-projectId'
    };
    let initializedConfig = await initConfig(config);
    assert.deepEqual(initializedConfig, config);
  });

  it('should get zone and instancefrom GCE', async () => {
    let metadata = nock(metadataAPI)
                       .get('/')
                       .reply(200)
                       .get('/instance/name')
                       .reply(200, 'gce-instance')
                       .get('/instance/zone')
                       .reply(200, 'projects/123456789012/zones/gce-zone')
                       .get('/project/project-id')
                       .reply(200, 'gce-projectId');
    const config = {
      projectId: 'projectId',
      logLevel: 2,
      serviceContext: {version: '', service: 'fake-service'},
      disableHeap: true,
      disableCpu: true,
    };
    const expConfig = {
      logLevel: 2,
      serviceContext: {version: '', service: 'fake-service'},
      disableHeap: true,
      disableCpu: true,
      instance: 'gce-instance',
      zone: 'gce-zone',
      projectId: 'projectId',
    };
    let initializedConfig = await initConfig(config);
    assert.deepEqual(initializedConfig, expConfig);
  });

  it('should not reject when not on GCE and no zone and instance found',
     async () => {
       let metadata = nock(metadataAPI);
       const config = {
         projectId: 'fake-projectId',
         serviceContext: {service: 'fake-service'}
       };
       const expConfig = {
         logLevel: 1,
         serviceContext: {version: '', service: 'fake-service'},
         disableHeap: false,
         disableCpu: false,
         instance: '',
         zone: '',
         projectId: 'fake-projectId'
       };
       let initializedConfig = await initConfig(config);
       assert.deepEqual(initializedConfig, expConfig);
     });

  it('should reject when no service specified', () => {
    let metadata = nock(metadataAPI);
    const config = {
      logLevel: 2,
      serviceContext: {version: ''},
      disableHeap: true,
      disableCpu: true,
    };
    return initConfig(config)
        .then(initializedConfig => {
          assert.fail('expected error because no service in config');
        })
        .catch((e: Error) => {
          assert.equal(
              e.message, 'service must be specified in the configuration');
        });
  });

  it('should get {{projectId}} when no projectId given', async () => {
    let metadata = nock(metadataAPI)
                       .get('/')
                       .reply(200)
                       .get('/instance/name')
                       .reply(200, 'gce-instance')
                       .get('/instance/zone')
                       .reply(200, 'projects/123456789012/zones/gce-zone')
                       .get('/project/project-id')
                       .reply(200, 'gce-projectId');
    const config = {
      logLevel: 2,
      serviceContext: {version: '', service: 'fake-service'},
      disableHeap: true,
      disableCpu: true,
      instance: 'instance',
      zone: 'zone'
    };
    const expConfig = {
      projectId: '{{projectId}}',
      logLevel: 2,
      serviceContext: {version: '', service: 'fake-service'},
      disableHeap: true,
      disableCpu: true,
      instance: 'instance',
      zone: 'zone'
    };
    let initializedConfig = await initConfig(config);
    assert.deepEqual(initializedConfig, expConfig);
  });

  it('should get values from from environment variable when not specified in config or environment variables',
     async () => {
       process.env.GCLOUD_PROJECT = 'process-projectId';
       process.env.GCLOUD_PROFILER_LOGLEVEL = '4';
       process.env.GAE_SERVICE = 'process-service';
       process.env.GAE_VERSION = 'process-version';
       process.env.GCLOUD_PROFILER_CONFIG = './test/testdata/test-config.json';

       let metadata = nock(metadataAPI)
                          .get('/')
                          .reply(200)
                          .get('/instance/name')
                          .reply(200, 'gce-instance')
                          .get('/instance/zone')
                          .reply(200, 'projects/123456789012/zones/gce-zone')
                          .get('/project/project-id')
                          .reply(200, 'gce-projectId');
       const config = {};
       const expConfig = {
         projectId: 'process-projectId',
         logLevel: 4,
         serviceContext:
             {version: 'process-version', service: 'process-service'},
         disableHeap: true,
         disableCpu: true,
         instance: 'envConfig-instance',
         zone: 'envConfig-zone'
       };
       let initializedConfig = await initConfig(config);
       assert.deepEqual(initializedConfig, expConfig);
     });

  it('should not get values from from environment variable when values specified in config',
     async () => {
       process.env.GCLOUD_PROJECT = 'process-projectId';
       process.env.GCLOUD_PROFILER_LOGLEVEL = '4';
       process.env.GAE_SERVICE = 'process-service';
       process.env.GAE_VERSION = 'process-version';
       process.env.GCLOUD_PROFILER_CONFIG = './test/testdata/test-config.json';

       let metadata = nock(metadataAPI)
                          .get('/')
                          .reply(200)
                          .get('/instance/name')
                          .reply(200, 'gce-instance')
                          .get('/instance/zone')
                          .reply(200, 'projects/123456789012/zones/gce-zone')
                          .get('/project/project-id')
                          .reply(200, 'gce-projectId');
       const config = {
         projectId: 'config-projectId',
         logLevel: 1,
         serviceContext: {version: 'config-version', service: 'config-service'},
         disableHeap: false,
         disableCpu: false,
         instance: 'instance',
         zone: 'zone'
       };
       let initializedConfig = await initConfig(config);
       assert.deepEqual(initializedConfig, config);
     });

  it('should get values from from environment config when not specified in config or other environment variables',
     async () => {
       process.env.GCLOUD_PROFILER_CONFIG = './test/testdata/test-config.json';

       const expConfig = {
         logLevel: 3,
         serviceContext:
             {version: 'envConfig-version', service: 'envConfig-service'},
         disableHeap: true,
         disableCpu: true,
         instance: 'envConfig-instance',
         zone: 'envConfig-zone',
         projectId: 'envConfig-fake-projectId'
       };

       let metadata = nock(metadataAPI)
                          .get('/')
                          .reply(200)
                          .get('/instance/name')
                          .reply(200, 'gce-instance')
                          .get('/instance/zone')
                          .reply(200, 'projects/123456789012/zones/gce-zone')
                          .get('/project/project-id')
                          .reply(200, 'gce-projectId');
       const config = {};
       let initializedConfig = await initConfig(config);
       assert.deepEqual(initializedConfig, expConfig);
     });
});
