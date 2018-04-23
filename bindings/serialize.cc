/**
 * Copyright 2018 Google LLC. All Rights Reserved.
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

#include "serialize.h"
#include "proto.h"

ValueType::ValueType(int64_t typeX, int64_t unitX)
    : typeX(typeX), unitX(unitX) {}

void ValueType::encode(std::vector<char>* buffer) const {
  encodeInt64Opt(1, typeX, buffer);
  encodeInt64Opt(2, unitX, buffer);
}

int64_t ValueType::getTypeX() const { return typeX; }

int64_t ValueType::getUnitX() const { return unitX; }

Label::Label(int64_t keyX, int64_t strX, int64_t num, int64_t unitX)
    : keyX(keyX), strX(strX), num(num), unitX(unitX) {}

int64_t Label::getKeyX() const { return keyX; }

int64_t Label::getStrX() const { return strX; }

int64_t Label::getNum() const { return num; }

int64_t Label::getUnitX() const { return unitX; }

void Label::encode(std::vector<char>* buffer) const {
  encodeInt64Opt(1, keyX, buffer);
  encodeInt64Opt(2, strX, buffer);
  encodeInt64Opt(3, num, buffer);
  encodeInt64Opt(4, unitX, buffer);
}

Mapping::Mapping(uint64_t id, uint64_t start, uint64_t limit, uint64_t offset,
                 uint64_t fileX, uint64_t buildIDX, bool hasFunctions,
                 bool hasFilenames, bool hasLineNumbers, bool hasInlineFrames)
    : id(id),
      start(start),
      limit(limit),
      offset(offset),
      fileX(fileX),
      buildIDX(buildIDX),
      hasFunctions(hasFunctions),
      hasFilenames(hasFilenames),
      hasLineNumbers(hasLineNumbers),
      hasInlineFrames(hasInlineFrames) {}

uint64_t Mapping::getID() const { return id; }
uint64_t Mapping::getStart() const { return start; }
uint64_t Mapping::getLimit() const { return limit; }
uint64_t Mapping::getOffset() const { return offset; }
uint64_t Mapping::getFileX() const { return fileX; }
uint64_t Mapping::getBuildIDX() const { return buildIDX; }
bool Mapping::getHasFunctions() const { return hasFunctions; }
bool Mapping::getHasFilenames() const { return hasFilenames; }
bool Mapping::getHasLineNumbers() const { return hasLineNumbers; }
bool Mapping::getHasInlineFrames() const { return hasInlineFrames; }

void Mapping::encode(std::vector<char>* buffer) const {
  encodeUint64Opt(1, id, buffer);
  encodeUint64Opt(2, start, buffer);
  encodeUint64Opt(3, limit, buffer);
  encodeUint64Opt(4, offset, buffer);
  encodeInt64Opt(5, fileX, buffer);
  encodeInt64Opt(6, buildIDX, buffer);
  encodeBoolOpt(7, hasFunctions, buffer);
  encodeBoolOpt(8, hasFilenames, buffer);
  encodeBoolOpt(9, hasLineNumbers, buffer);
  encodeBoolOpt(10, hasInlineFrames, buffer);
}

Line::Line(uint64_t functionID, int64_t line)
    : functionID(functionID), line(line) {}

uint64_t Line::getFunctionID() const { return functionID; }

int64_t Line::getLine() const { return line; }

void Line::encode(std::vector<char>* buffer) const {
  encodeUint64Opt(1, functionID, buffer);
  encodeInt64Opt(2, line, buffer);
}

ProfileFunction::ProfileFunction(uint64_t id, int64_t nameX,
                                 int64_t systemNameX, int64_t filenameX,
                                 int64_t startLine)
    : id(id),
      nameX(nameX),
      systemNameX(systemNameX),
      filenameX(filenameX),
      startLine(startLine) {}

uint64_t ProfileFunction::getID() const { return id; }
int64_t ProfileFunction::getNameX() const { return nameX; }
int64_t ProfileFunction::getSystemNameX() const { return systemNameX; }
int64_t ProfileFunction::getFilenameX() const { return filenameX; }
int64_t ProfileFunction::getStartLine() const { return startLine; }

void ProfileFunction::encode(std::vector<char>* buffer) const {
  encodeUint64Opt(1, id, buffer);
  encodeInt64Opt(2, nameX, buffer);
  encodeInt64Opt(3, systemNameX, buffer);
  encodeInt64Opt(4, filenameX, buffer);
  encodeInt64Opt(5, startLine, buffer);
}

ProfileLocation::ProfileLocation(uint64_t id, uint64_t mappingID,
                                 uint64_t address, std::vector<Line> line,
                                 bool isFolded)
    : id(id),
      mappingID(mappingID),
      address(address),
      line(line),
      isFolded(isFolded) {}

ProfileLocation::ProfileLocation(ProfileLocation&& l)
    : id(std::move(l.id)),
      mappingID(l.mappingID),
      address(std::move(l.address)),
      line(std::move(l.line)),
      isFolded(std::move(l.isFolded)) {}

uint64_t ProfileLocation::getID() const { return id; }

uint64_t ProfileLocation::getMappingID() const { return mappingID; }

uint64_t ProfileLocation::getAddress() const { return address; }

const std::vector<Line>& ProfileLocation::getLine() const { return line; }

bool ProfileLocation::getIsFolded() const { return isFolded; }

void ProfileLocation::encode(std::vector<char>* buffer) const {
  encodeUint64Opt(1, id, buffer);
  encodeInt64Opt(2, mappingID, buffer);
  encodeInt64Opt(3, address, buffer);
  encodeRepeatedMessage<Line>(4, line, buffer);
  encodeBoolOpt(5, isFolded, buffer);
}

Sample::Sample(std::vector<uint64_t> locationID, std::vector<int64_t> value,
               std::vector<Label> label)
    : locationID(locationID), value(value), label(label) {}

Sample::Sample(Sample&& s)
    : locationID(std::move(s.locationID)),
      value(std::move(s.value)),
      label(std::move(s.label)) {}

const std::vector<uint64_t>& Sample::getLocationID() const {
  return locationID;
}

const std::vector<int64_t>& Sample::getValue() const { return value; }

const std::vector<Label>& Sample::getLabel() const { return label; }

void Sample::encode(std::vector<char>* buffer) const {
  encodeUint64s(1, locationID, buffer);
  encodeInt64s(2, value, buffer);
  encodeRepeatedMessage<Label>(3, label, buffer);
}

Profile::Profile(std::string periodType, std::string periodUnit, int64_t period,
                 int64_t timeNanos, int64_t durationNanos,
                 std::string dropFrames, std::string keepFramesX)
    : period(period),
      timeNanos(timeNanos),
      durationNanos(durationNanos),
      defaultSampleTypeX(0) {
  // first index of strings must be ""
  stringID("");
  this->periodType = ValueType(stringID(periodType), stringID(periodUnit));
  this->dropFramesX = stringID(dropFrames);
  this->keepFramesX = stringID(keepFramesX);
}

void Profile::addSampleType(std::string type, std::string unit) {
  int64_t typeX = stringID(type);
  int64_t unitX = stringID(unit);
  sampleType.push_back(ValueType(typeX, unitX));
}

void Profile::addSample(const Node& node, std::deque<uint64_t>* stack) {
  uint64_t loc = locationID(node);
  stack->push_front(loc);
  std::vector<Sample> nodeSamples = node.samples(*stack, this);
  for (size_t i = 0; i < nodeSamples.size(); i++) {
    sample.push_back(std::move(nodeSamples[i]));
  }
}

uint64_t Profile::locationID(const Node& node) {
  LocationKey key(node.getFileID(), node.lineNumber(), node.columnNumber(),
                  node.name());
  auto ids = locationIDMap.find(key);
  if (ids != locationIDMap.end()) {
    return ids->second;
  }
  uint64_t id = location.size() + 1;
  std::vector<Line> lines;
  lines.push_back(line(node));
  ProfileLocation l(id, 0, 0, lines, false);
  location.push_back(std::move(l));
  locationIDMap.insert(locationIDMap.begin(),
                       std::pair<LocationKey, int64_t>(key, id));
  return id;
}

Line Profile::line(const Node& node) {
  return Line(functionID(node), node.lineNumber());
}

int64_t Profile::functionID(const Node& node) {
  std::string name = node.name();
  FunctionKey key(node.getFileID(), name);
  auto ids = functionIDMap.find(key);
  if (ids != functionIDMap.end()) {
    return ids->second;
  }
  int64_t nameX = stringID(name);
  int64_t filenameX = stringID(node.filename());
  int64_t id = function.size() + 1;
  ProfileFunction f =
      ProfileFunction(id, nameX, nameX, filenameX, node.lineNumber());
  function.push_back(f);
  functionIDMap.insert(functionIDMap.begin(),
                       std::pair<FunctionKey, int64_t>(key, id));
  return id;
}

int64_t Profile::stringID(std::string s) {
  auto pair = stringIDMap.find(s);
  if (pair != stringIDMap.end()) {
    return pair->second;
  }
  int64_t id = strings.size();
  stringIDMap.insert(stringIDMap.begin(),
                     std::pair<std::string, int64_t>(s, id));
  strings.push_back(s);
  return id;
}

const std::vector<ValueType>& Profile::getSampleType() const {
  return sampleType;
}

const std::vector<ProfileLocation>& Profile::getLocation() const {
  return location;
}

const std::vector<Sample>& Profile::getSample() const { return sample; }

const std::vector<Mapping>& Profile::getMapping() const { return mapping; }

const std::vector<ProfileFunction>& Profile::getFunction() const {
  return function;
}

const std::vector<std::string>& Profile::getStrings() const { return strings; }

const std::vector<int64_t>& Profile::getCommentX() const { return commentX; }

int64_t Profile::getPeriod() const { return period; }

int64_t Profile::getTimeNanos() const { return timeNanos; }

int64_t Profile::getDurationNanos() const { return durationNanos; }

int64_t Profile::getDefaultSampleTypeX() const { return defaultSampleTypeX; }

const ValueType& Profile::getPeriodType() const { return periodType; }

int64_t Profile::getDropFramesX() const { return dropFramesX; }

int64_t Profile::getKeepFramesX() const { return keepFramesX; }

void Profile::encode(std::vector<char>* buffer) const {
  encodeRepeatedMessage<ValueType>(1, sampleType, buffer);
  encodeRepeatedMessage<Sample>(2, sample, buffer);
  encodeRepeatedMessage<Mapping>(3, mapping, buffer);
  encodeRepeatedMessage<ProfileLocation>(4, location, buffer);
  encodeRepeatedMessage<ProfileFunction>(5, function, buffer);
  encodeStrings(6, strings, buffer);
  encodeInt64Opt(7, dropFramesX, buffer);
  encodeInt64Opt(8, keepFramesX, buffer);
  encodeInt64Opt(9, timeNanos, buffer);
  encodeInt64Opt(10, durationNanos, buffer);
  if (periodType.typeX != 0 || periodType.unitX != 0) {
    encodeMessage(11, periodType, buffer);
  }
  encodeInt64Opt(12, period, buffer);
  encodeInt64s(13, commentX, buffer);
  encodeInt64(14, defaultSampleTypeX, buffer);
}
