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
import { ServiceObject } from '@google-cloud/common';
import { ProfilerConfig } from './config';
/**
 * Interface for deployment field of RequestProfile. Profiles with matching
 * deployments will be grouped together.
 * Used as body of request when creating profile using the profiler API.
 *
 * Public for testing.
 */
export interface Deployment {
    projectId?: string;
    target?: string;
    labels?: {
        zone?: string;
        version?: string;
        language: string;
    };
}
/**
 * Interface for body of response from profiler API when creating
 * profile and used as body of request to profiler API when
 * uploading a profile.
 *
 * Public for testing.
 */
export interface RequestProfile {
    name: string;
    profileType?: string;
    duration?: string;
    profileBytes?: string;
    deployment?: Deployment;
    labels?: {
        instance?: string;
    };
}
/**
 * @return if the backoff duration can be parsed, then the backoff duration in
 * ms, otherwise undefined.
 *
 * Public for testing.
 */
export declare function parseBackoffDuration(backoffMessage: string): number | undefined;
/**
 * Class which tracks how long to wait before the next retry and can be
 * used to get this backoff.
 */
export declare class Retryer {
    readonly initialBackoffMillis: number;
    readonly backoffCapMillis: number;
    readonly backoffMultiplier: number;
    private nextBackoffMillis;
    private random;
    constructor(initialBackoffMillis: number, backoffCapMillis: number, backoffMultiplier: number, random?: () => number);
    getBackoff(): number;
    reset(): void;
}
/**
 * Polls profiler server for instructions on behalf of a task and
 * collects and uploads profiles as requested.
 *
 * If heap profiling is enabled, the heap profiler must be enabled before heap
 * profiles can be collected.
 */
export declare class Profiler extends ServiceObject {
    private logger;
    private profileLabels;
    private deployment;
    private profileTypes;
    private retryer;
    private sourceMapper;
    config: ProfilerConfig;
    constructor(config: ProfilerConfig);
    /**
     * Starts an endless loop to poll profiler server for instructions, and
     * collects and uploads profiles as requested.
     * If there is a problem when collecting a profile or uploading a profile to
     * profiler server, this problem will be logged at the error level and
     * otherwise ignored.
     * If there is a problem polling profiler server for instructions
     * on the type of profile to be collected, this problem will be logged at the
     * error level and getting profile type will be retried.
     */
    start(): Promise<void>;
    /**
     * Endlessly polls the profiler server for instructions, and collects and
     * uploads profiles as requested.
     */
    runLoop(): Promise<void>;
    /**
     * Waits for profiler server to tell it to collect a profile, then collects
     * a profile and uploads it.
     *
     * @return time, in ms, to wait before asking profiler server again about
     * collecting another profile.
     */
    collectProfile(): Promise<number>;
    /**
     * Talks to profiler server, which hangs until server indicates
     * job should be profiled and then indicates what type of profile should
     * be collected.
     *
     * If any problem is encountered, an error will be thrown.
     *
     * @return a RequestProfile specifying which type of profile should be
     * collected and other information needed to collect and upload a profile of
     * the specified type.
     *
     * TODO (issue #28): right now, this call could hang for up to an hour when
     * this method is the only thing on the event loop, keeping the program open
     * even when all work is done. Should expose the ability to cancel the http
     * request made here, and then determine when to cancel this request.
     *
     * Public to allow for testing.
     */
    createProfile(): Promise<RequestProfile>;
    /**
     * Collects a profile of the type specified by the profileType field of prof.
     * If any problem is encountered, like a problem collecting or uploading the
     * profile, a message will be logged, and the error will otherwise be ignored.
     *
     * Public to allow for testing.
     */
    profileAndUpload(prof: RequestProfile): Promise<void>;
    /**
     * Collects a profile of the type specified by profileType field of prof.
     * If any problem is encountered, for example the profileType is not
     * recognized or profiling is disabled for the specified profileType, an
     * error will be thrown.
     *
     * Public to allow for testing.
     */
    profile(prof: RequestProfile): Promise<RequestProfile>;
    /**
     * Collects a time profile, converts profile to compressed, base64 encoded
     * string, and puts this string in profileBytes field of prof.
     *
     * Public to allow for testing.
     */
    writeTimeProfile(prof: RequestProfile): Promise<RequestProfile>;
    /**
     * Collects a heap profile, converts profile to compressed, base64 encoded
     * string, and adds profileBytes field to prof with this string.
     *
     * Public to allow for testing.
     */
    writeHeapProfile(prof: RequestProfile): Promise<RequestProfile>;
}
