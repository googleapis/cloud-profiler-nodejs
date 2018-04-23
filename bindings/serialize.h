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

#ifndef BINDINGS_SERIALIZE_H_
#define BINDINGS_SERIALIZE_H_

#include <cstdint>
#include <deque>
#include <memory>
#include <unordered_map>
#include "proto.h"

// Corresponds to ValueType defined in third_party/proto/profile.proto.
class ValueType : public ProtoField {
 public:
  int64_t typeX;  // Index into string table.
  int64_t unitX;  // Index into string table.
  ValueType(int64_t typeX = 0, int64_t unitX = 0);
  int64_t getTypeX() const;
  int64_t getUnitX() const;
  virtual void encode(std::vector<char>* buffer) const;
};

// Corresponds to Label defined in third_party/proto/profile.proto.
class Label : public ProtoField {
 private:
  int64_t keyX;  // Index into string table.
  int64_t strX;  // Index into string table.
  int64_t num;
  int64_t unitX;  // Index into string table.

 public:
  Label(int64_t keyX = 0, int64_t strX = 0, int64_t num = 0, int64_t unitX = 0);
  int64_t getKeyX() const;
  int64_t getStrX() const;
  int64_t getNum() const;
  int64_t getUnitX() const;
  virtual void encode(std::vector<char>* buffer) const;
};

// Corresponds to Mapping defined in third_party/proto/profile.proto.
class Mapping : public ProtoField {
 private:
  uint64_t id;
  uint64_t start;
  uint64_t limit;
  uint64_t offset;
  uint64_t fileX;     // Index into string table.
  uint64_t buildIDX;  // Index into string table.
  bool hasFunctions;
  bool hasFilenames;
  bool hasLineNumbers;
  bool hasInlineFrames;

 public:
  Mapping(uint64_t id, uint64_t start, uint64_t limit, uint64_t offset,
          uint64_t fileX, uint64_t buildIDX, bool hasFunctions,
          bool hasFilenames, bool hasLineNumbers, bool hasInlineFrames);
  uint64_t getID() const;
  uint64_t getStart() const;
  uint64_t getLimit() const;
  uint64_t getOffset() const;
  uint64_t getFileX() const;
  uint64_t getBuildIDX() const;
  bool getHasFunctions() const;
  bool getHasFilenames() const;
  bool getHasLineNumbers() const;
  bool getHasInlineFrames() const;

  virtual void encode(std::vector<char>* buffer) const;
};

// Corresponds to Line defined in third_party/proto/profile.proto.
class Line : public ProtoField {
 private:
  uint64_t functionID;
  int64_t line;

 public:
  Line(uint64_t functionID, int64_t line);
  uint64_t getFunctionID() const;
  int64_t getLine() const;
  virtual void encode(std::vector<char>* buffer) const;
};

// Corresponds to Function defined in third_party/proto/profile.proto.
class ProfileFunction : public ProtoField {
 private:
  uint64_t id;
  int64_t nameX;        // Index into string table.
  int64_t systemNameX;  // Index into string table.
  int64_t filenameX;    // Index into string table.
  int64_t startLine;

 public:
  ProfileFunction(uint64_t id, int64_t nameX, int64_t systemNameX,
                  int64_t filenameX, int64_t startLine);
  uint64_t getID() const;
  int64_t getNameX() const;
  int64_t getSystemNameX() const;
  int64_t getFilenameX() const;
  int64_t getStartLine() const;
  virtual void encode(std::vector<char>* buffer) const;
};

// Corresponds to Location defined in third_party/proto/profile.proto.
class ProfileLocation : public ProtoField {
 private:
  uint64_t id;
  uint64_t mappingID;
  uint64_t address;
  std::vector<Line> line;
  bool isFolded;

 public:
  // disallow copying
  ProfileLocation(const ProfileLocation&) = delete;

  // allow moving
  ProfileLocation(ProfileLocation&&);

  ProfileLocation(uint64_t id, uint64_t mappingID, uint64_t address,
                  std::vector<Line> line, bool isFolded);

  uint64_t getID() const;
  uint64_t getMappingID() const;
  uint64_t getAddress() const;
  const std::vector<Line>& getLine() const;
  bool getIsFolded() const;

  virtual void encode(std::vector<char>* buffer) const;
};

// Corresponds to Sample defined in third_party/proto/profile.proto.
class Sample : public ProtoField {
 private:
  std::vector<uint64_t> locationID;
  std::vector<int64_t> value;
  std::vector<Label> label;

 public:
  // disallow copying
  Sample(const Sample&) = delete;

  // allow moving
  Sample(Sample&&);

  Sample(std::vector<uint64_t> locationID, std::vector<int64_t> value,
         std::vector<Label> label);
  const std::vector<uint64_t>& getLocationID() const;
  const std::vector<int64_t>& getValue() const;
  const std::vector<Label>& getLabel() const;
  virtual void encode(std::vector<char>* buffer) const;
};

class Node;

typedef std::tuple<int64_t, int64_t, int64_t, std::string> LocationKey;
struct locationKeyHash : public std::unary_function<LocationKey, size_t> {
  size_t operator()(const LocationKey& key) const {
    result_type const h1(std::hash<int64_t>{}(std::get<0>(key)));
    result_type const h2(std::hash<int64_t>{}(std::get<1>(key)));
    result_type const h3(std::hash<int64_t>{}(std::get<2>(key)));
    result_type const h4(std::hash<std::string>{}(std::get<3>(key)));
    return h4 ^ (h3 << 1) ^ (h2 << 2) ^ (h1 << 4);
  }
};

typedef std::tuple<int64_t, std::string> FunctionKey;
struct functionKeyHash : public std::unary_function<FunctionKey, size_t> {
  size_t operator()(const FunctionKey& key) const {
    result_type const h1(std::hash<int64_t>{}(std::get<0>(key)));
    result_type const h2(std::hash<std::string>{}(std::get<1>(key)));
    return h2 ^ (h1 << 1);
  }
};

// Corresponds to Profile defined in third_party/proto/profile.proto.
class Profile : public ProtoField {
 private:
  std::vector<ValueType> sampleType;
  std::vector<ProfileLocation> location;
  std::vector<Sample> sample;
  std::vector<Mapping> mapping;
  std::vector<ProfileFunction> function;
  std::vector<std::string> strings;
  std::vector<int64_t> commentX;  // Indices into string table.
  std::unordered_map<FunctionKey, int64_t, functionKeyHash> functionIDMap;
  std::unordered_map<LocationKey, int64_t, locationKeyHash> locationIDMap;
  std::unordered_map<std::string, int64_t> stringIDMap;
  int64_t period;
  int64_t timeNanos;
  int64_t durationNanos;
  int64_t defaultSampleTypeX;
  ValueType periodType;
  int64_t dropFramesX;  // Index into string table.
  int64_t keepFramesX;  // Index into string table.

 public:
  // disallow copying
  Profile(const Profile&) = delete;

  Profile(std::string periodType, std::string periodUnit, int64_t period,
          int64_t timeNanos = 0, int64_t durationNanos = 0,
          std::string dropFrames = "", std::string keepFramesX = "");

  void addSampleType(std::string type, std::string unit);

  // adds samples associated with the node to the profile, and pushes the
  // node's location ID to the front of the stack.
  void addSample(const Node& node, std::deque<uint64_t>* stack);
  uint64_t locationID(const Node& node);
  Line line(const Node& node);
  int64_t functionID(const Node& node);
  int64_t stringID(std::string s);

  const std::vector<ValueType>& getSampleType() const;
  const std::vector<ProfileLocation>& getLocation() const;
  const std::vector<Sample>& getSample() const;
  const std::vector<Mapping>& getMapping() const;
  const std::vector<ProfileFunction>& getFunction() const;
  const std::vector<std::string>& getStrings() const;
  const std::vector<int64_t>& getCommentX() const;
  int64_t getPeriod() const;
  int64_t getTimeNanos() const;
  int64_t getDurationNanos() const;
  int64_t getDefaultSampleTypeX() const;
  const ValueType& getPeriodType() const;
  int64_t getDropFramesX() const;
  int64_t getKeepFramesX() const;

  virtual void encode(std::vector<char>* buffer) const;
};

// Abstract class describing a node structure which can be used to add a sample
// to a profile.
class Node {
 public:
  virtual std::string name() const = 0;
  virtual std::string filename() const = 0;
  virtual int64_t getFileID() const = 0;
  virtual int64_t lineNumber() const = 0;
  virtual int64_t columnNumber() const = 0;
  virtual std::vector<Sample> samples(const std::deque<uint64_t>& stack,
                                      Profile* profile) const = 0;
};

#endif
