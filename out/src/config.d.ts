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
import { GoogleAuthOptions } from '@google-cloud/common';
export interface Config extends GoogleAuthOptions {
    projectId?: string;
    logLevel?: number;
    serviceContext?: {
        service?: string;
        version?: string;
    };
    instance?: string;
    zone?: string;
    disableTime?: boolean;
    disableHeap?: boolean;
    timeIntervalMicros?: number;
    heapIntervalBytes?: number;
    heapMaxStackDepth?: number;
    ignoreHeapSamplesPath?: string;
    backoffMultiplier?: number;
    initialBackoffMillis?: number;
    backoffCapMillis?: number;
    serverBackoffCapMillis?: number;
    baseApiUrl?: string;
    localProfilingPeriodMillis?: number;
    localLogPeriodMillis?: number;
    localTimeDurationMillis?: number;
    sourceMapSearchPath?: string[];
    disableSourceMaps?: boolean;
}
export interface ProfilerConfig extends GoogleAuthOptions {
    projectId?: string;
    logLevel: number;
    serviceContext: {
        service: string;
        version?: string;
    };
    instance?: string;
    zone?: string;
    disableTime: boolean;
    disableHeap: boolean;
    timeIntervalMicros: number;
    heapIntervalBytes: number;
    heapMaxStackDepth: number;
    ignoreHeapSamplesPath: string;
    initialBackoffMillis: number;
    backoffCapMillis: number;
    backoffMultiplier: number;
    serverBackoffCapMillis: number;
    baseApiUrl: string;
    localProfilingPeriodMillis: number;
    localLogPeriodMillis: number;
    localTimeDurationMillis: number;
    sourceMapSearchPath: string[];
    disableSourceMaps: boolean;
}
export declare const defaultConfig: {
    logLevel: number;
    serviceContext: {};
    disableHeap: boolean;
    disableTime: boolean;
    timeIntervalMicros: number;
    heapIntervalBytes: number;
    heapMaxStackDepth: number;
    ignoreHeapSamplesPath: string;
    initialBackoffMillis: number;
    backoffCapMillis: number;
    backoffMultiplier: number;
    baseApiUrl: string;
    serverBackoffCapMillis: number;
    localProfilingPeriodMillis: number;
    localLogPeriodMillis: number;
    localTimeDurationMillis: number;
    sourceMapSearchPath: string[];
    disableSourceMaps: boolean;
};
