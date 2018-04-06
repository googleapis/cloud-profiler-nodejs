/**
 * Copyright 2018 Google Inc. All Rights Reserved.
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

void ValueType::encode(std::vector<char> *b) const {
  encodeInt64Opt(1, typeX, b);
  encodeInt64Opt(2, unitX, b);
}

int64_t ValueType::getTypeX() { return typeX; }

int64_t ValueType::getUnitX() { return unitX; }

Label::Label(int64_t keyX, int64_t strX, int64_t num, int64_t unitX)
    : keyX(keyX), strX(strX), num(num), unitX(unitX) {}

int64_t Label::getKeyX() { return keyX; }

int64_t Label::getStrX() { return strX; }

int64_t Label::getNum() { return num; }

int64_t Label::getUnitX() { return unitX; }

void Label::encode(std::vector<char> *b) const {
  encodeInt64Opt(1, keyX, b);
  encodeInt64Opt(2, strX, b);
  encodeInt64Opt(3, num, b);
  encodeInt64Opt(4, unitX, b);
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

uint64_t Mapping::getID() { return id; }
uint64_t Mapping::getStart() { return start; }
uint64_t Mapping::getLimit() { return limit; }
uint64_t Mapping::getOffset() { return offset; }
uint64_t Mapping::getFileX() { return fileX; }
uint64_t Mapping::getBuildIDX() { return buildIDX; }
bool Mapping::getHasFunctions() { return hasFunctions; }
bool Mapping::getHasFilenames() { return hasFilenames; }
bool Mapping::getHasLineNumbers() { return hasLineNumbers; }
bool Mapping::getHasInlineFrames() { return hasInlineFrames; }

void Mapping::encode(std::vector<char> *b) const {
  encodeUint64Opt(1, id, b);
  encodeUint64Opt(2, start, b);
  encodeUint64Opt(3, limit, b);
  encodeUint64Opt(4, offset, b);
  encodeInt64Opt(5, fileX, b);
  encodeInt64Opt(6, buildIDX, b);
  encodeBoolOpt(7, hasFunctions, b);
  encodeBoolOpt(8, hasFilenames, b);
  encodeBoolOpt(9, hasLineNumbers, b);
  encodeBoolOpt(10, hasInlineFrames, b);
}

Line::Line(uint64_t functionID, int64_t line)
    : functionID(functionID), line(line) {}

uint64_t Line::getFunctionID() { return functionID; }

int64_t Line::getLine() { return line; }

void Line::encode(std::vector<char> *b) const {
  encodeUint64Opt(1, functionID, b);
  encodeInt64Opt(2, line, b);
}

ProfileFunction::ProfileFunction(uint64_t id, int64_t nameX,
                                 int64_t systemNameX, int64_t filenameX,
                                 int64_t startLine)
    : id(id),
      nameX(nameX),
      systemNameX(systemNameX),
      filenameX(filenameX),
      startLine(startLine) {}

uint64_t ProfileFunction::getID() { return id; }
int64_t ProfileFunction::getNameX() { return nameX; }
int64_t ProfileFunction::getSystemNameX() { return systemNameX; }
int64_t ProfileFunction::getFilenameX() { return filenameX; }
int64_t ProfileFunction::getStartLine() { return startLine; }

void ProfileFunction::encode(std::vector<char> *b) const {
  encodeUint64Opt(1, id, b);
  encodeInt64Opt(2, nameX, b);
  encodeInt64Opt(3, systemNameX, b);
  encodeInt64Opt(4, filenameX, b);
  encodeInt64Opt(5, startLine, b);
}

ProfileLocation::ProfileLocation(uint64_t id, uint64_t mappingID,
                                 uint64_t address, std::vector<Line> line,
                                 bool isFolded)
    : id(id),
      mappingID(mappingID),
      address(address),
      line(line),
      isFolded(isFolded) {}

uint64_t ProfileLocation::getID() { return id; }

uint64_t ProfileLocation::getMappingID() { return mappingID; }

uint64_t ProfileLocation::getAddress() { return address; }

std::vector<Line> ProfileLocation::getLine() { return line; }

bool ProfileLocation::getIsFolded() { return isFolded; }

void ProfileLocation::encode(std::vector<char> *b) const {
  encodeUint64Opt(1, id, b);
  encodeInt64Opt(2, mappingID, b);
  encodeInt64Opt(3, address, b);
  encodeRepeatedMessage<Line>(4, line, b);
  encodeBoolOpt(5, isFolded, b);
}

Sample::Sample(std::vector<uint64_t> locationID, std::vector<int64_t> value,
               std::vector<Label> label)
    : locationID(locationID), value(value), label(label) {}

std::vector<uint64_t> Sample::getLocationID() { return locationID; }

std::vector<int64_t> Sample::getValue() { return value; }

std::vector<Label> Sample::getLabel() { return label; }

void Sample::encode(std::vector<char> *b) const {
  encodeUint64s(1, locationID, b);
  encodeInt64s(2, value, b);
  encodeRepeatedMessage<Label>(3, label, b);
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

void Profile::addSample(std::unique_ptr<Node> &node,
                        std::deque<uint64_t> *stack) {
  uint64_t loc = locationID(node);
  stack->push_front(loc);
  std::vector<Sample> nodeSamples = node->samples(*stack, this);
  sample.insert(sample.end(), nodeSamples.begin(), nodeSamples.end());
}

uint64_t Profile::locationID(std::unique_ptr<Node> &node) {
  LocationKey key(node->getFileID(), node->lineNumber(), node->columnNumber(),
                  node->name());
  auto ids = locationIDMap.find(key);
  if (ids != locationIDMap.end()) {
    return ids->second;
  }
  uint64_t id = location.size() + 1;
  std::vector<Line> lines;
  lines.push_back(line(node));
  ProfileLocation l = ProfileLocation(id, 0, 0, lines, false);
  location.push_back(l);
  locationIDMap.insert(locationIDMap.begin(),
                       std::pair<LocationKey, int64_t>(key, id));
  return id;
}

Line Profile::line(std::unique_ptr<Node> &node) {
  return Line(functionID(node), node->lineNumber());
}

int64_t Profile::functionID(std::unique_ptr<Node> &node) {
  std::string name = node->name();
  FunctionKey key(node->getFileID(), name);
  auto ids = functionIDMap.find(key);
  if (ids != functionIDMap.end()) {
    return ids->second;
  }
  int64_t nameX = stringID(name);
  int64_t filenameX = stringID(node->filename());
  int64_t id = function.size() + 1;
  ProfileFunction f =
      ProfileFunction(id, nameX, nameX, filenameX, node->lineNumber());
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

std::vector<ValueType> Profile::getSampleType() { return sampleType; }

std::vector<ProfileLocation> Profile::getLocation() { return location; }

std::vector<Sample> Profile::getSample() { return sample; }

std::vector<Mapping> Profile::getMapping() { return mapping; }

std::vector<ProfileFunction> Profile::getFunction() { return function; }

std::vector<std::string> Profile::getStrings() { return strings; }

std::vector<int64_t> Profile::getCommentX() { return commentX; }

int64_t Profile::getPeriod() { return period; }

int64_t Profile::getTimeNanos() { return timeNanos; }

int64_t Profile::getDurationNanos() { return durationNanos; }

int64_t Profile::getDefaultSampleTypeX() { return defaultSampleTypeX; }

ValueType Profile::getPeriodType() { return periodType; }

int64_t Profile::getDropFramesX() { return dropFramesX; }

int64_t Profile::getKeepFramesX() { return keepFramesX; }

void Profile::encode(std::vector<char> *b) const {
  encodeRepeatedMessage<ValueType>(1, sampleType, b);
  encodeRepeatedMessage<Sample>(2, sample, b);
  encodeRepeatedMessage<Mapping>(3, mapping, b);
  encodeRepeatedMessage<ProfileLocation>(4, location, b);
  encodeRepeatedMessage<ProfileFunction>(5, function, b);
  encodeStrings(6, strings, b);
  encodeInt64Opt(7, dropFramesX, b);
  encodeInt64Opt(8, keepFramesX, b);
  encodeInt64Opt(9, timeNanos, b);
  encodeInt64Opt(10, durationNanos, b);
  if (periodType.typeX != 0 || periodType.unitX != 0) {
    encodeMessage(11, periodType, b);
  }
  encodeInt64Opt(12, period, b);
  encodeInt64s(13, commentX, b);
  encodeInt64(14, defaultSampleTypeX, b);
}
