import * as assert from 'assert';
import * as nock from 'nock';
import * as request from 'request';
import {initConfig} from '../src/index';

nock.disableNetConnect();
const metadataAPI = 'http://metadata.google.internal/computeMetadata/v1';

describe('initConfig', function() {
  let processLogLevel: string|undefined;
  let processCloudProject: string|undefined;
  let processService: string|undefined;
  let processVersion: string|undefined;
  let processConfig: string|undefined;

  before(function() {
    processLogLevel = process.env.GCLOUD_PROFILER_LOGLEVEL;
    processCloudProject = process.env.GCLOUD_PROJECT;
    processService = process.env.GAE_SERVICE;
    processVersion = process.env.GAE_VERSION;
    processConfig = process.env.GCLOUD_PROFILER_CONFIG;
  });

  beforeEach(function() {
    delete process.env.GCLOUD_PROFILER_LOGLEVEL;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GAE_SERVICE;
    delete process.env.GAE_VERSION;
  });

  afterEach(function() {
    nock.cleanAll();
  });

  after(function() {
    process.env.GCLOUD_PROFILER_LOGLEVEL = processLogLevel;
    process.env.GCLOUD_PROJECT = processCloudProject;
    process.env.GAE_SERVICE = processService;
    process.env.GAE_VERSION = processVersion;
    process.env.GCLOUD_PROFILER_CONFIG = processConfig;
  });

  it('should not modify specified fields when not on GCE', function() {
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
    return initConfig(config)
        .then(initializedConfig => {
          assert.deepEqual(initializedConfig, config);
        })
        .catch((e) => {
          assert.fail(e);
        });
  });

  it('should not modify specified fields when on GCE', function() {
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
    return initConfig(config)
        .then(initializedConfig => {
          assert.deepEqual(initializedConfig, config);
        })
        .catch((e) => {
          assert.fail(e);
        });
  });

  it('should get zone and instancefrom GCE', function() {
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
    return initConfig(config)
        .then(initializedConfig => {
          console.log(initializedConfig);
          assert.deepEqual(initializedConfig, expConfig);
        })
        .catch((e) => {
          assert.fail(e);
        });
  });

  it('should not reject when not on GCE and no zone and instance found',
     function() {
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
       return initConfig(config)
           .then(initializedConfig => {
             assert.deepEqual(initializedConfig, expConfig);
           })
           .catch((e) => {
             assert.fail(e);
           });
     });
  it('should reject when on GCE and no instance and no instance metadata',
     function() {
       let metadata = nock(metadataAPI)
                          .get('/')
                          .reply(200)
                          .get('/instance/zone')
                          .reply(200, 'projects/123456789012/zones/gce-zone')
                          .get('/project/project-id')
                          .reply(200, 'gce-projectId');
       const config = {
         logLevel: 2,
         serviceContext: {version: '', service: 'fake-service'},
         disableHeap: true,
         disableCpu: true,
       };
       return initConfig(config)
           .then(initializedConfig => {
             console.log(initializedConfig);
             assert.fail('expected error because no instance in metadata');
           })
           .catch((e: Error) => {
             assert.ok(
                 e.message.startsWith(
                     'failed to get instance from Compute Engine: '),
                 'expected error message to begin with ' +
                     '\"failed to get instance from Compute Engine:\",' +
                     ' actual error message: ' +
                     '\"' + e.message + '\"');
           });
     });

  it('should reject when on GCE and no zone and no zone metadata', function() {
    let metadata = nock(metadataAPI)
                       .get('/')
                       .reply(200)
                       .get('/instance/name')
                       .reply(200, 'gce-instance')
                       .get('/project/project-id')
                       .reply(200, 'gce-projectId');
    const config = {
      logLevel: 2,
      serviceContext: {version: '', service: 'fake-service'},
      disableHeap: true,
      disableCpu: true,
    };
    return initConfig(config)
        .then(initializedConfig => {
          console.log(initializedConfig);
          assert.fail('expected error because no zone in metadata');
        })
        .catch((e: Error) => {
          assert.ok(
              e.message.startsWith('failed to get zone from Compute Engine: '),
              'expected error message to begin with ' +
                  '\"failed to get zone from Compute Engine:\",' +
                  ' actual error message: ' +
                  '\"' + e.message + '\"');
        });
  });

  it('should get {{projectId}} when no projectId given', function() {
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
    return initConfig(config).then(initializedConfig => {
      assert.deepEqual(initializedConfig, expConfig);
    });
  });

  it('should get values from from environment variable when not specified in config or environment variables',
     function() {
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
       return initConfig(config).then(initializedConfig => {
         assert.deepEqual(initializedConfig, expConfig);
       });
     });

  it('should not get values from from environment variable when values specified in config',
     function() {
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
       return initConfig(config).then(initializedConfig => {
         assert.deepEqual(initializedConfig, config);
       });
     });

  it('should get values from from environment config when not specified in config or other environment variables',
     function() {
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
       return initConfig(config).then(initializedConfig => {
         assert.deepEqual(initializedConfig, expConfig);
       });
     });
});
