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
const profile_1 = require("../../../proto/profile");
/**
 * Used to build string table and access strings and their ids within the table
 * when serializing a profile.
 */
class StringTable {
    constructor() {
        this.strings = [];
        this.stringsMap = new Map();
        this.getIndexOrAdd('');
    }
    /**
     * @return index of str within the table. Also adds str to string table if
     * str is not in the table already.
     */
    getIndexOrAdd(str) {
        let idx = this.stringsMap.get(str);
        if (idx !== undefined) {
            return idx;
        }
        idx = this.strings.push(str) - 1;
        this.stringsMap.set(str, idx);
        return idx;
    }
}
/**
 * Takes v8 profile and populates sample, location, and function fields of
 * profile.proto.
 *
 * @param profile - profile.proto with empty sample, location, and function
 * fields.
 * @param root - root of v8 profile tree describing samples to be appended
 * to profile.
 * @param appendToSamples - function which converts entry to sample(s)  and
 * appends these to end of an array of samples.
 * @param stringTable - string table for the existing profile.
 */
function serialize(profile, root, appendToSamples, stringTable, ignoreSamplesPath) {
    const samples = [];
    const locations = [];
    const functions = [];
    const locationMap = new Map();
    const functionMap = new Map();
    const functionIdMap = new Map();
    const locationIdMap = new Map();
    const entries = root.children.map((n) => ({ node: n, stack: [] }));
    while (entries.length > 0) {
        const entry = entries.pop();
        const node = entry.node;
        if (ignoreSamplesPath && node.scriptName.indexOf(ignoreSamplesPath) > -1) {
            continue;
        }
        const stack = entry.stack;
        const location = getLocation(node);
        stack.unshift(location.id);
        appendToSamples(entry, samples);
        for (const child of node.children) {
            entries.push({ node: child, stack: stack.slice() });
        }
    }
    profile.sample = samples;
    profile.location = locations;
    profile.function = functions;
    profile.stringTable = stringTable.strings;
    function getLocation(node) {
        const keyStr = `${node.scriptId}:${node.lineNumber}:${node.columnNumber}:${node.name}`;
        let id = locationIdMap.get(keyStr);
        if (id !== undefined) {
            // id is index+1, since 0 is not valid id.
            return locations[id - 1];
        }
        id = locations.length + 1;
        locationIdMap.set(keyStr, id);
        const location = new profile_1.perftools.profiles.Location({ id, line: [getLine(node)] });
        locations.push(location);
        return location;
    }
    function getLine(node) {
        return new profile_1.perftools.profiles.Line({
            functionId: getFunction(node).id,
            line: node.lineNumber,
        });
    }
    function getFunction(node) {
        const keyStr = `${node.scriptId}:${node.name}`;
        let id = functionIdMap.get(keyStr);
        if (id !== undefined) {
            // id is index+1, since 0 is not valid id.
            return functions[id - 1];
        }
        id = functions.length + 1;
        functionIdMap.set(keyStr, id);
        const nameId = stringTable.getIndexOrAdd(node.name || '(anonymous)');
        const f = new profile_1.perftools.profiles.Function({
            id,
            name: nameId,
            systemName: nameId,
            filename: stringTable.getIndexOrAdd(node.scriptName)
        });
        functions.push(f);
        return f;
    }
}
/**
 * @return value type for sample counts (type:sample, units:count), and
 * adds strings used in this value type to the table.
 */
function createSampleCountValueType(table) {
    return new profile_1.perftools.profiles.ValueType({
        type: table.getIndexOrAdd('sample'),
        unit: table.getIndexOrAdd('count')
    });
}
/**
 * @return value type for time samples (type:wall, units:microseconds), and
 * adds strings used in this value type to the table.
 */
function createTimeValueType(table) {
    return new profile_1.perftools.profiles.ValueType({
        type: table.getIndexOrAdd('wall'),
        unit: table.getIndexOrAdd('microseconds')
    });
}
/**
 * @return value type for object counts (type:objects, units:count), and
 * adds strings used in this value type to the table.
 */
function createObjectCountValueType(table) {
    return new profile_1.perftools.profiles.ValueType({
        type: table.getIndexOrAdd('objects'),
        unit: table.getIndexOrAdd('count')
    });
}
/**
 * @return value type for memory allocations (type:space, units:bytes), and
 * adds strings used in this value type to the table.
 */
function createAllocationValueType(table) {
    return new profile_1.perftools.profiles.ValueType({ type: table.getIndexOrAdd('space'), unit: table.getIndexOrAdd('bytes') });
}
/**
 * Converts v8 time profile into into a profile proto.
 * (https://github.com/google/pprof/blob/master/proto/profile.proto)
 *
 * @param prof - profile to be converted.
 * @param intervalMicros - average time (microseconds) between samples.
 */
function serializeTimeProfile(prof, intervalMicros) {
    const appendTimeEntryToSamples = (entry, samples) => {
        if (entry.node.hitCount > 0) {
            const sample = new profile_1.perftools.profiles.Sample({
                locationId: entry.stack,
                value: [entry.node.hitCount, entry.node.hitCount * intervalMicros]
            });
            samples.push(sample);
        }
    };
    const stringTable = new StringTable();
    const sampleValueType = createSampleCountValueType(stringTable);
    const timeValueType = createTimeValueType(stringTable);
    const profile = {
        sampleType: [sampleValueType, timeValueType],
        timeNanos: Date.now() * 1000 * 1000,
        durationNanos: (prof.endTime - prof.startTime) * 1000,
        periodType: timeValueType,
        period: intervalMicros,
    };
    serialize(profile, prof.topDownRoot, appendTimeEntryToSamples, stringTable);
    return profile;
}
exports.serializeTimeProfile = serializeTimeProfile;
/**
 * Converts v8 heap profile into into a profile proto.
 * (https://github.com/google/pprof/blob/master/proto/profile.proto)
 *
 * @param prof - profile to be converted.
 * @param startTimeNanos - start time of profile, in nanoseconds (POSIX time).
 * @param durationsNanos - duration of the profile (wall clock time) in
 * nanoseconds.
 * @param intervalBytes - bytes allocated between samples.
 */
function serializeHeapProfile(prof, startTimeNanos, intervalBytes, ignoreSamplesPath) {
    const appendHeapEntryToSamples = (entry, samples) => {
        if (entry.node.allocations.length > 0) {
            for (const alloc of entry.node.allocations) {
                const sample = new profile_1.perftools.profiles.Sample({
                    locationId: entry.stack,
                    value: [alloc.count, alloc.sizeBytes * alloc.count]
                    // TODO: add tag for allocation size
                });
                samples.push(sample);
            }
        }
    };
    const stringTable = new StringTable();
    const sampleValueType = createObjectCountValueType(stringTable);
    const allocationValueType = createAllocationValueType(stringTable);
    const profile = {
        sampleType: [sampleValueType, allocationValueType],
        timeNanos: startTimeNanos,
        periodType: allocationValueType,
        period: intervalBytes,
    };
    serialize(profile, prof, appendHeapEntryToSamples, stringTable, ignoreSamplesPath);
    return profile;
}
exports.serializeHeapProfile = serializeHeapProfile;
//# sourceMappingURL=profile-serializer.js.map