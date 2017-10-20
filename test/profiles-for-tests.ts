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

import {perftools} from '../src/profile';
import {TimeProfile, TimeProfileNode} from '../src/v8-types';

const leaf1: TimeProfileNode = {
  callUid: 5,
  scriptResourceName: 'script3',
  functionName: 'function5',
  lineNumber: 5,
  hitCount: 5,
  children: [],
};

const leaf2 = {
  callUid: 4,
  scriptResourceName: 'script3',
  functionName: 'function4',
  lineNumber: 10,
  hitCount: 2,
  children: [],
};

const leaf3 = {
  callUid: 3,
  scriptResourceName: 'script3',
  functionName: 'function3',
  lineNumber: 15,
  hitCount: 3,
  children: [],
};

const node1 = {
  callUid: 2,
  scriptResourceName: 'script2',
  functionName: 'function2',
  lineNumber: 20,
  hitCount: 7,
  children: [leaf1, leaf2],
};

const main = {
  callUid: 1,
  scriptResourceName: 'script1',
  functionName: 'main',
  lineNumber: 1,
  hitCount: 0,
  children: [node1, leaf3],
};

const root = {
  callUid: 0,
  scriptResourceName: 'root',
  functionName: 'root',
  lineNumber: 0,
  hitCount: 0,
  children: [main],
};

export const testProfileTree: TimeProfile = {
  startTime: 0,
  endTime: 10 * 1000 * 1000,
  topDownRoot: root,
};

const lines = [
  {functionId: 1, line: 1},
  {functionId: 2, line: 20},
  {functionId: 3, line: 15},
  {functionId: 4, line: 10},
  {functionId: 5, line: 5},
];

const functions = [
  new perftools.profiles.Function({id: 1, name: 5, systemName: 5, filename: 6}),
  new perftools.profiles.Function({id: 3, name: 7, systemName: 7, filename: 8}),
  new perftools.profiles.Function(
      {id: 2, name: 9, systemName: 9, filename: 10}),
  new perftools.profiles.Function(
      {id: 4, name: 11, systemName: 11, filename: 8}),
  new perftools.profiles.Function(
      {id: 5, name: 12, systemName: 12, filename: 8}),
];

const locations = [
  new perftools.profiles.Location({
    line: [lines[0]],
    id: 1,
  }),
  new perftools.profiles.Location({
    line: [lines[2]],
    id: 3,
  }),
  new perftools.profiles.Location({
    line: [lines[1]],
    id: 2,
  }),
  new perftools.profiles.Location({
    line: [lines[3]],
    id: 4,
  }),
  new perftools.profiles.Location({
    line: [lines[4]],
    id: 5,
  }),
];

export const testProfile: perftools.profiles.IProfile = {
  sampleType: [
    new perftools.profiles.ValueType({type: 1, unit: 2}),
    new perftools.profiles.ValueType({type: 3, unit: 4}),
  ],
  sample: [
    new perftools.profiles.Sample(
        {locationId: [3, 1], value: [3, 3000], label: []}),
    new perftools.profiles.Sample(
        {locationId: [2, 1], value: [7, 7000], label: []}),
    new perftools.profiles.Sample(
        {locationId: [4, 2, 1], value: [2, 2000], label: []}),
    new perftools.profiles.Sample(
        {locationId: [5, 2, 1], value: [5, 5000], label: []}),

  ],
  location: locations,
  function: functions,
  stringTable: [
    '', 'samples', 'count', 'time', 'microseconds', 'main', 'script1',
    'function3', 'script3', 'function2', 'script2', 'function4', 'function5'
  ],
  timeNanos: 0,
  durationNanos: 10 * 1000 * 1000 * 1000,
  periodType: new perftools.profiles.ValueType({type: 3, unit: 4}),
  period: 1000,
};

// testProfile is encoded then decoded again, to convert numbers to longs
// in decodedTestProfile.
const encodedProfile = perftools.profiles.Profile.encode(testProfile).finish();
export const base64TestProfile = 'H4sIAAAAAAAAA0XQsUrEQBCA4cvujLvZC9wQBLcMARH' +
    'snFOfwfJqK481woLZHJdcb+lj+Aa2PoKlpY/gYzh7cKT7+JmZYhzYgpQDqwnq0ild1Fp/XWQ' +
    'qofm9r53TkK1+VtmYje9XrbVFm7cLkW7zhZVIiRSdi0AE5EQoQsJr2SD02JyJNBlvGitSVPq' +
    'ycSKgpV8eG1Llq8bygs247Xev3cgYhkOaGKbYd1z1MeyHsQtDeh4Z+m1MMhn2cTfdcPlySGG' +
    'KQ1qf2npufGo8t9uZdw+Lzdv358fl4/ElT3/mH3wE538iAQAA';
export const decodedTestProfile =
    perftools.profiles.Profile.decode(encodedProfile);
