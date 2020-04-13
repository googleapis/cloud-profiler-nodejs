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
Object.defineProperty(exports, "__esModule", { value: true });
const consoleLogLevel = require("console-log-level");
const config_1 = require("./config");
const pjson = require('../../package.json');
const LEVEL_NAMES = [
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
];
function logLevelToName(level) {
    if (level === undefined) {
        level = config_1.defaultConfig.logLevel;
    }
    else if (level < 0) {
        level = 0;
    }
    else if (level > 4) {
        level = 4;
    }
    return LEVEL_NAMES[level];
}
function createLogger(level) {
    return consoleLogLevel({
        stderr: true,
        prefix: pjson.name,
        level: logLevelToName(level),
    });
}
exports.createLogger = createLogger;
//# sourceMappingURL=logger.js.map