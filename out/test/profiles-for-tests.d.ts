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
import { SourceMapGenerator } from 'source-map';
import { perftools } from '../../proto/profile';
import { TimeProfile } from '../src/v8-types';
export declare const v8TimeProfile: TimeProfile;
export declare const timeProfile: perftools.profiles.IProfile;
export declare const decodedTimeProfile: Readonly<perftools.profiles.Profile>;
export declare const v8HeapProfile: Readonly<{
    name: string;
    scriptName: string;
    scriptId: number;
    lineNumber: number;
    columnNumber: number;
    allocations: never[];
    children: {
        name: string;
        scriptName: string;
        scriptId: number;
        lineNumber: number;
        columnNumber: number;
        allocations: {
            count: number;
            sizeBytes: number;
        }[];
        children: {
            name: string;
            scriptName: string;
            scriptId: number;
            lineNumber: number;
            columnNumber: number;
            allocations: never[];
            children: {
                name: string;
                scriptName: string;
                scriptId: number;
                lineNumber: number;
                columnNumber: number;
                allocations: {
                    count: number;
                    sizeBytes: number;
                }[];
                children: never[];
            }[];
        }[];
    }[];
}>;
export declare const heapProfile: perftools.profiles.IProfile;
export declare const decodedHeapProfile: Readonly<perftools.profiles.Profile>;
export declare const heapProfileWithExternal: perftools.profiles.IProfile;
export declare const decodedHeapProfileWithExternal: Readonly<perftools.profiles.Profile>;
export declare const v8AnonymousFunctionHeapProfile: Readonly<{
    name: string;
    scriptName: string;
    scriptId: number;
    lineNumber: number;
    columnNumber: number;
    allocations: never[];
    children: {
        scriptName: string;
        scriptId: number;
        lineNumber: number;
        columnNumber: number;
        allocations: {
            count: number;
            sizeBytes: number;
        }[];
        children: never[];
    }[];
}>;
export declare const anonymousFunctionHeapProfile: perftools.profiles.IProfile;
export declare const v8AnonymousFunctionTimeProfile: TimeProfile;
export declare const anonymousFunctionTimeProfile: perftools.profiles.IProfile;
export declare const v8HeapWithPathProfile: Readonly<{
    name: string;
    scriptName: string;
    scriptId: number;
    lineNumber: number;
    columnNumber: number;
    allocations: never[];
    children: {
        name: string;
        scriptName: string;
        scriptId: number;
        lineNumber: number;
        columnNumber: number;
        allocations: never[];
        children: {
            name: string;
            scriptName: string;
            scriptId: number;
            lineNumber: number;
            columnNumber: number;
            allocations: {
                count: number;
                sizeBytes: number;
            }[];
            children: never[];
        }[];
    }[];
}>;
export declare const heapProfileIncludePath: perftools.profiles.IProfile;
export declare const decodedHeapProfileIncludePath: Readonly<perftools.profiles.Profile>;
export declare const heapProfileExcludePath: perftools.profiles.IProfile;
export declare const decodedHeapProfileExcludePath: Readonly<perftools.profiles.Profile>;
export declare const mapDirPath: string;
export declare const mapFoo: SourceMapGenerator;
export declare const mapBaz: SourceMapGenerator;
export declare const v8HeapGeneratedProfile: Readonly<{
    name: string;
    scriptName: string;
    scriptId: number;
    lineNumber: number;
    columnNumber: number;
    allocations: never[];
    children: {
        name: string;
        scriptName: string;
        scriptId: number;
        lineNumber: number;
        columnNumber: number;
        allocations: never[];
        children: ({
            name: string;
            scriptName: string;
            scriptId: number;
            lineNumber: number;
            columnNumber: number;
            allocations: {
                count: number;
                sizeBytes: number;
            }[];
            children: never[];
        } | {
            name: string;
            scriptName: string;
            scriptId: number;
            lineNumber: number;
            columnNumber: number;
            allocations: never[];
            children: {
                name: string;
                scriptName: string;
                scriptId: number;
                lineNumber: number;
                columnNumber: number;
                allocations: {
                    count: number;
                    sizeBytes: number;
                }[];
                children: never[];
            }[];
        })[];
    }[];
}>;
export declare const heapSourceProfile: perftools.profiles.IProfile;
export declare const timeGeneratedProfileRoot: Readonly<{
    name: string;
    scriptName: string;
    scriptId: number;
    lineNumber: number;
    columnNumber: number;
    hitCount: number;
    children: {
        name: string;
        scriptName: string;
        scriptId: number;
        lineNumber: number;
        columnNumber: number;
        hitCount: number;
        children: {
            name: string;
            scriptName: string;
            scriptId: number;
            lineNumber: number;
            columnNumber: number;
            children: {
                name: string;
                scriptName: string;
                scriptId: number;
                lineNumber: number;
                columnNumber: number;
                hitCount: number;
                children: never[];
            }[];
        }[];
    }[];
}>;
export declare const v8TimeGeneratedProfile: TimeProfile;
export declare const timeSourceProfile: perftools.profiles.IProfile;
