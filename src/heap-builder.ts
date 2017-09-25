/**
 * Copyright 2015 Google Inc. All Rights Reserved.
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

'use strict';

import {AllocationProfileNode} from './v8-types';
import {perftools} from './profile';

// A stack of function UIDs.
// TODO: duplicated in builder.ts
type Stack = Array<number>;


// TODO: pass this value explicitly when starting the profiler
const SAMPLE_PERIOD = 512 * 1024;

let strings = [ '' ];
let samples: Array<perftools.profiles.Sample> = [];

let locationIds = [ 'dummy' ];
let locations: Array<perftools.profiles.Location> = [];
let locationMap: Map<number, perftools.profiles.Location>;

let functionIds = [ 'dummy' ];
let functions: Array<perftools.profiles.Function> = [];
let functionMap: Map<number, perftools.profiles.Function>;

function getIndexOrAdd<T>(element: T, lst: Array<T>) {
  let index = lst.indexOf(element);
  if (index !== -1) {
    return index;
  }
  index = lst.push(element);
  return index - 1;
}

function getStringIndex(str: string) { return getIndexOrAdd(str, strings); }

function getFunction(stackNode: AllocationProfileNode) {
  let unique = JSON.stringify(stackNode);
  let id = getIndexOrAdd(unique, functionIds);
  if (functionMap.has(id)) {
    return functionMap.get(id);
  }
  let f = new perftools.profiles.Function({
    id : id,
    name : getStringIndex(stackNode.name || '(anonymous)'),
    systemName : getStringIndex('callUID-' + id),
    filename : getStringIndex(stackNode.scriptName)
    // start_line
  });
  functions.push(f);
  functionMap.set(id,f);
  return f;
}

function getLine(stackNode: AllocationProfileNode) {
  return new perftools.profiles.Line(
      {functionId : (getFunction(stackNode) as perftools.profiles.Function).id, line : stackNode.lineNumber});
}

function getLocation(stackNode: AllocationProfileNode) {
  let unique = JSON.stringify(stackNode);
  let id = getIndexOrAdd(unique, locationIds);
  if (locationMap.has(id)) {
    return locationMap.get(id);
  }
  let location = new perftools.profiles.Location({
    id : id,
    // mapping_id: getMapping(node).id,
    line : [ getLine(stackNode) ]
  });
  locations.push(location);
  locationMap.set(id, location);
  return location;
}

let countValue =
    new perftools.profiles.ValueType({type: getStringIndex('objects'), unit: getStringIndex('count')});
let bytesValue =
    new perftools.profiles.ValueType({type: getStringIndex('space'), unit: getStringIndex('bytes')});

function serializeNode(node: AllocationProfileNode, stack: Stack) {
  // TODO: get rid of the cast.
  let location = getLocation(node) as perftools.profiles.Location;
  // TODO: get rid of the cast
  stack.unshift(location.id as number); // leaf is first in the stack
  for (let i in node.allocations) {
    let alloc = node.allocations[i];
    let sample = new perftools.profiles.Sample({
      locationId : stack,
      value : [ alloc.count, alloc.count * alloc.size ]
      // label?
    });
    samples.push(sample);
  }
  node.children.forEach(function(child) { serializeNode(child, stack); });
  stack.shift();
}

export function serialize(prof: AllocationProfileNode, startTimeNanos: number, endTimeNanos: number): perftools.profiles.IProfile{
  samples = [];
  locations = [];
  functions = [];
  locationMap = new Map();
  functionMap = new Map();
  strings = strings.slice(0, 5);
  locationIds = locationIds.slice(0, 1);
  functionIds = functionIds.slice(0, 1);
  serializeNode(prof, []);
  return {
    sampleType : [ countValue, bytesValue ],
    sample : samples,
    // mapping: mappings,
    location : locations, 'function' : functions,
    stringTable : strings,
    // opt drop_frames
    // opt keep_frames
    timeNanos : startTimeNanos,                    // Nanos
    durationNanos : endTimeNanos - startTimeNanos, // Nanos

    periodType : bytesValue,
    period : SAMPLE_PERIOD
  };
}
