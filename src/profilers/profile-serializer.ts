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

import {perftools} from '../profile';
import {TimeProfile, TimeProfileNode} from '../v8-types';

// A stack of function IDs.
type Stack = Array<number>;
interface Entry {
  node: TimeProfileNode;
  stack: Stack;
}

/**
 * Converts v8 Profile into into a profile proto
 * (https://github.com/google/pprof/blob/master/proto/profile.proto).
 *
 * @param prof - profile to be converted.
 * @param intervalMicros - average time (microseconds) between samples.
 */
export function serializeTimeProfile(
    prof: TimeProfile, intervalMicros: number) {
  const samples: Array<perftools.profiles.Sample> = [];
  const locations: Array<perftools.profiles.Location> = [];
  const functions: Array<perftools.profiles.Function> = [];
  const locationMap: Map<number, perftools.profiles.Location> = new Map();
  const functionMap: Map<number, perftools.profiles.Function> = new Map();
  const strings = [''];
  const stringsMap = new Map<string, number>();

  const sampleValueType = createSampleValueType();
  const timeValueType = createTimeValueType();

  serializeNode(prof.topDownRoot);

  return {
    sampleType: [sampleValueType, timeValueType],
    sample: samples,
    location: locations,
    function: functions,
    stringTable: strings,
    timeNanos: 1000 * 1000 * prof.endTime,
    durationNanos: 1000 * 1000 * (prof.endTime - prof.startTime),
    periodType: timeValueType,
    period: intervalMicros
  };

  /**
   * Adds samples from a node and it's children to the fields tracking
   * profile serialization.
   *
   * @param node - the node which is serialized
   * @param stack - the stack trace to the current node.
   */
  function serializeNode(root: TimeProfileNode) {
    // Skip root node in serialized profile, start with it's children.
    const entries: Entry[] = root.children.map((n) => ({node: n, stack: []}));
    while (entries.length > 0) {
      let entry = entries.pop();
      if (entry !== undefined) {
        const node = entry.node;
        const stack = entry.stack;
        const location = getLocation(node);
        stack.unshift(location.id as number);
        if (node.hitCount > 0) {
          const sample = new perftools.profiles.Sample({
            locationId: stack,
            value: [node.hitCount, node.hitCount * intervalMicros]
          });
          samples.push(sample);
        }
        for (let child of node.children) {
          entries.push({node: child, stack: stack.slice(0)});
        }
      }
    }
  }

  function getLocation(node: TimeProfileNode): perftools.profiles.Location {
    const id = node.callUid;
    let location = locationMap.get(id);
    if (location !== undefined) {
      return location;
    }
    location = new perftools.profiles.Location({id: id, line: [getLine(node)]});
    locations.push(location);
    locationMap.set(id, location);
    return location;
  }

  function getLine(node: TimeProfileNode): perftools.profiles.Line {
    return new perftools.profiles.Line(
        {functionId: getFunction(node).id, line: node.lineNumber});
  }

  function getFunction(node: TimeProfileNode): perftools.profiles.Function {
    const id = node.callUid;
    let f = functionMap.get(id);
    if (f !== undefined) {
      return f;
    }
    const name = getIndexOrAdd(node.functionName || '(anonymous)');
    f = new perftools.profiles.Function({
      id: id,
      name: name,
      systemName: name,
      filename: getIndexOrAdd(node.scriptResourceName || '(unknown)')
    });
    functions.push(f);
    functionMap.set(id, f);
    return f;
  }

  function createSampleValueType(): perftools.profiles.ValueType {
    return new perftools.profiles.ValueType(
        {type: getIndexOrAdd('samples'), unit: getIndexOrAdd('count')});
  }

  function createTimeValueType(): perftools.profiles.ValueType {
    return new perftools.profiles.ValueType(
        {type: getIndexOrAdd('time'), unit: getIndexOrAdd('microseconds')});
  }

  function getIndexOrAdd(str: string): number {
    let loc = stringsMap.get(str);
    if (loc !== undefined) {
      return loc;
    }
    loc = strings.length;
    stringsMap.set(str, loc);
    strings.push(str);
    return loc;
  }
}
