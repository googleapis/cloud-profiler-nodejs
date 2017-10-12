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
import {getIndexOrAdd} from '../util';
import {WallProfile, WallProfileNode} from '../v8-types';
// A stack of function UIDs.
type Stack = Array<number>;

// Converts v8 Profile into profile with profile format used by Stackdriver
// Profiler.
export function serializeWallProfile(
    prof: WallProfile, sampleInterval: number) {
  let samples: Array<perftools.profiles.Sample> = [];
  let locations: Array<perftools.profiles.Location> = [];
  let functions: Array<perftools.profiles.Function> = [];
  let locationMap: Map<number, perftools.profiles.Location> = new Map();
  let functionMap: Map<number, perftools.profiles.Function> = new Map();
  let strings = [''];

  let sampleValueType = getSampleValueType();
  let timeValueType = getTimeValueType();

  serializeNode(prof.topDownRoot, []);

  return {
    sampleType: [sampleValueType, timeValueType],
    sample: samples,
    location: locations,
    function: functions,
    stringTable: strings,
    // opt drop_frames
    // opt keep_frames
    timeNanos: 1000 * 1000 * prof.endTime,                         // Nanos
    durationNanos: 1000 * 1000 * (prof.endTime - prof.startTime),  // Nanos

    periodType: timeValueType,
    period: sampleInterval
  };

  /* Adds samples from a node and it's children to the fields tracking
   * profile serialization.
   *
   * node - the node which is serialized
   * stack - the stack trace to the current node.
   */
  function serializeNode(node: WallProfileNode, stack: Stack) {
    let location = getLocation(node);
    // TODO: deal with location.id being a Long.
    stack.unshift(location.id as number);  // leaf is first in the stack
    if (node.hitCount > 0) {
      const sample = new perftools.profiles.Sample({
        locationId: stack.slice(0),
        value: [node.hitCount, node.hitCount * sampleInterval]
      });
      samples.push(sample);
    }
    for (let child of node.children) {
      serializeNode(child, stack);
    }
    stack.shift();  // remove leaf from stack
  }

  function getLocation(node: WallProfileNode): perftools.profiles.Location {
    const id = node.callUid;
    if (locationMap.has(id)) {
      return locationMap.get(id) as perftools.profiles.Location;
    }
    const location =
        new perftools.profiles.Location({id: id, line: [getLine(node)]});
    locations.push(location);
    locationMap.set(id, location);
    return location;
  }

  function getLine(node: WallProfileNode): perftools.profiles.Line {
    return new perftools.profiles.Line(
        {functionId: getFunction(node).id, line: node.lineNumber});
  }

  function getFunction(node: WallProfileNode): perftools.profiles.Function {
    const id = node.callUid;
    if (functionMap.has(id)) {
      // Map.get returns possibly undefined, but we know it is defined.
      // TODO: figure out how to avoid the cast.
      return functionMap.get(id) as perftools.profiles.Function;
    }
    const name = getIndexOrAdd(node.functionName || '(anonymous)', strings);
    const f = new perftools.profiles.Function({
      id: id,
      name: name,
      systemName: name,
      filename: getIndexOrAdd(node.scriptResourceName || '(unknown)', strings)
      // start_line
    });
    functions.push(f);
    functionMap.set(id, f);
    return f;
  }

  function getSampleValueType(): perftools.profiles.ValueType {
    return new perftools.profiles.ValueType({
      type: getIndexOrAdd('samples', strings),
      unit: getIndexOrAdd('count', strings)
    });
  }

  function getTimeValueType(): perftools.profiles.ValueType {
    return new perftools.profiles.ValueType({
      type: getIndexOrAdd('time', strings),
      unit: getIndexOrAdd('microseconds', strings)
    });
  }
}
