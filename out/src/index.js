"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const delay_1 = require("delay");
const extend = require("extend");
const fs = require("fs");
const gcpMetadata = require("gcp-metadata");
const pprof_1 = require("pprof");
const semver = require("semver");
const config_1 = require("./config");
const logger_1 = require("./logger");
const profiler_1 = require("./profiler");
const pjson = require('../../package.json');
const serviceRegex = /^[a-z]([-a-z0-9_.]{0,253}[a-z0-9])?$/;
/**
 * @return value of metadata field.
 * Throws error if there is a problem accessing metadata API.
 */
function getMetadataInstanceField(field) {
    return __awaiter(this, void 0, void 0, function* () {
        return gcpMetadata.instance(field);
    });
}
function hasService(config) {
    return (config.serviceContext !== undefined &&
        typeof config.serviceContext.service === 'string');
}
/**
 * Sets unset values in the configuration to the value retrieved from
 * environment variables or specified in defaultConfig.
 * Throws error if value that must be set cannot be initialized.
 */
function initConfigLocal(config) {
    const envConfig = {
        projectId: process.env.GCLOUD_PROJECT,
        serviceContext: {
            service: process.env.GAE_SERVICE || process.env.K_SERVICE,
            version: process.env.GAE_VERSION || process.env.K_REVISION,
        },
    };
    if (process.env.GCLOUD_PROFILER_LOGLEVEL !== undefined) {
        const envLogLevel = Number(process.env.GCLOUD_PROFILER_LOGLEVEL);
        if (!isNaN(envLogLevel)) {
            envConfig.logLevel = envLogLevel;
        }
    }
    let envSetConfig = {};
    const configPath = process.env.GCLOUD_PROFILER_CONFIG;
    if (configPath) {
        let envSetConfigBuf;
        try {
            envSetConfigBuf = fs.readFileSync(configPath);
        }
        catch (e) {
            throw Error(`Could not read GCLOUD_PROFILER_CONFIG ${configPath}: ${e}`);
        }
        try {
            envSetConfig = JSON.parse(envSetConfigBuf.toString());
        }
        catch (e) {
            throw Error(`Could not parse GCLOUD_PROFILER_CONFIG ${configPath}: ${e}`);
        }
    }
    const mergedUserConfigs = extend(true, {}, envSetConfig, envConfig, config);
    if (Array.isArray(mergedUserConfigs.sourceMapSearchPath) &&
        mergedUserConfigs.sourceMapSearchPath.length === 0 &&
        !mergedUserConfigs.disableSourceMaps) {
        throw new Error('serviceMapSearchPath is an empty array. Use disableSourceMaps to' +
            ' disable source map support instead.');
    }
    const mergedConfig = extend(true, {}, config_1.defaultConfig, mergedUserConfigs);
    if (!hasService(mergedConfig)) {
        throw new Error('Service must be specified in the configuration');
    }
    if (!serviceRegex.test(mergedConfig.serviceContext.service)) {
        throw new Error(`Service ${mergedConfig.serviceContext.service} does not match regular expression "${serviceRegex.toString()}"`);
    }
    return mergedConfig;
}
/**
 * Sets unset values in the configuration which can be retrieved from GCP
 * metadata.
 */
function initConfigMetadata(config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!config.zone || !config.instance) {
            const [instance, zone] = (yield Promise.all([
                getMetadataInstanceField('name'),
                getMetadataInstanceField('zone'),
            ]).catch((err) => {
                // ignore errors, which will occur when not on GCE.
            })) || [undefined, undefined];
            if (!config.zone && zone) {
                config.zone = zone.substring(zone.lastIndexOf('/') + 1);
            }
            if (!config.instance && instance) {
                config.instance = instance;
            }
        }
        return config;
    });
}
/**
 * Returns true if the version passed in satifised version requirements
 * specified in the profiler's package.json.
 *
 * Exported for testing.
 */
function nodeVersionOkay(version) {
    // Coerce version if possible, to remove any pre-release, alpha, beta, etc
    // tags.
    version = semver.coerce(version) || version;
    return semver.satisfies(version, pjson.engines.node);
}
exports.nodeVersionOkay = nodeVersionOkay;
/**
 * Initializes the config, and starts heap profiler if the heap profiler is
 * needed. Returns a profiler if creation is successful. Otherwise, returns
 * rejected promise.
 */
function createProfiler(config) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!nodeVersionOkay(process.version)) {
            throw new Error(`Could not start profiler: node version ${process.version}` +
                ` does not satisfies "${pjson.engines.node}"` +
                '\nSee https://github.com/GoogleCloudPlatform/cloud-profiler-nodejs#prerequisites' +
                ' for details.');
        }
        let profilerConfig = initConfigLocal(config);
        // Start the heap profiler if profiler config does not indicate heap profiling
        // is disabled. This must be done before any asynchronous calls are made so
        // all memory allocations made after start() is called can be captured.
        if (!profilerConfig.disableHeap) {
            pprof_1.heap.start(profilerConfig.heapIntervalBytes, profilerConfig.heapMaxStackDepth);
        }
        profilerConfig = yield initConfigMetadata(profilerConfig);
        return new profiler_1.Profiler(profilerConfig);
    });
}
exports.createProfiler = createProfiler;
/**
 * Starts the profiling agent and returns a promise.
 * If any error is encountered when configuring the profiler the promise will
 * be rejected. Resolves when profiling is started.
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
function start(config = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        let profiler;
        try {
            profiler = yield createProfiler(config);
        }
        catch (e) {
            logError(`${e}`, config);
            return;
        }
        profiler.start();
    });
}
exports.start = start;
function logError(msg, config) {
    // FIXME: do not create a new logger on each error.
    const logger = logger_1.createLogger(config.logLevel);
    logger.error(msg);
}
/**
 * For debugging purposes. Collects profiles and discards the collected
 * profiles.
 */
function startLocal(config = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        let profiler;
        try {
            profiler = yield createProfiler(config);
        }
        catch (e) {
            logError(`${e}`, config);
            return;
        }
        // Set up periodic logging.
        const logger = logger_1.createLogger(config.logLevel);
        let heapProfileCount = 0;
        let timeProfileCount = 0;
        let prevLogTime = Date.now();
        setInterval(() => {
            const curTime = Date.now();
            const { rss, heapTotal, heapUsed } = process.memoryUsage();
            logger.debug(new Date().toISOString(), 'rss', (rss / (1024 * 1024)).toFixed(3), 'MiB,', 'heap total', (heapTotal / (1024 * 1024)).toFixed(3), 'MiB,', 'heap used', (heapUsed / (1024 * 1024)).toFixed(3), 'MiB,', 'heap profile collection rate', ((heapProfileCount * 1000) / (curTime - prevLogTime)).toFixed(3), 'profiles/s,', 'time profile collection rate', ((timeProfileCount * 1000) / (curTime - prevLogTime)).toFixed(3), 'profiles/s');
            heapProfileCount = 0;
            timeProfileCount = 0;
            prevLogTime = curTime;
        }, profiler.config.localLogPeriodMillis);
        // Periodic profiling
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            if (!config.disableHeap) {
                const heap = yield profiler.profile({
                    name: 'Heap-Profile' + new Date(),
                    profileType: 'HEAP',
                });
                heapProfileCount++;
            }
            yield delay_1.default(profiler.config.localProfilingPeriodMillis / 2);
            if (!config.disableTime) {
                const wall = yield profiler.profile({
                    name: 'Time-Profile' + new Date(),
                    profileType: 'WALL',
                    duration: profiler.config.localTimeDurationMillis.toString() + 'ms',
                });
                timeProfileCount++;
            }
        }), profiler.config.localProfilingPeriodMillis);
    });
}
exports.startLocal = startLocal;
// If the module was --require'd from the command line, start the agent.
if (module.parent && module.parent.id === 'internal/preload') {
    start();
}
//# sourceMappingURL=index.js.map