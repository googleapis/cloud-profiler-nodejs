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
  int64_t getTypeX();
  int64_t getUnitX();
  virtual void encode(std::vector<char>* b) const;
};

// Corresponds to Label defined in third_party/proto/profile.proto.
class Label : public ProtoField {
 private:
  int64_t keyX;  // Index into string table.
  int64_t strX;  // Index into string table.
  int64_t num;
  int64_t unitX;  // Index into string table.

 public:
  int64_t getKeyX();
  int64_t getStrX();
  int64_t getNum();
  int64_t getUnitX();
  Label(int64_t keyX = 0, int64_t strX = 0, int64_t num = 0, int64_t unitX = 0);
  virtual void encode(std::vector<char>* b) const;
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
  uint64_t getID();
  uint64_t getStart();
  uint64_t getLimit();
  uint64_t getOffset();
  uint64_t getFileX();
  uint64_t getBuildIDX();
  bool getHasFunctions();
  bool getHasFilenames();
  bool getHasLineNumbers();
  bool getHasInlineFrames();

  virtual void encode(std::vector<char>* b) const;
};

// Corresponds to Line defined in third_party/proto/profile.proto.
class Line : public ProtoField {
 private:
  uint64_t functionID;
  int64_t line;

 public:
  Line(uint64_t functionID, int64_t line);
  uint64_t getFunctionID();
  int64_t getLine();
  virtual void encode(std::vector<char>* b) const;
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
  uint64_t getID();
  int64_t getNameX();
  int64_t getSystemNameX();
  int64_t getFilenameX();
  int64_t getStartLine();
  virtual void encode(std::vector<char>* b) const;
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
  ProfileLocation(uint64_t id, uint64_t mappingID, uint64_t address,
                  std::vector<Line> line, bool isFolded);

  uint64_t getID();
  uint64_t getMappingID();
  uint64_t getAddress();
  std::vector<Line> getLine();
  bool getIsFolded();

  virtual void encode(std::vector<char>* b) const;
};

// Corresponds to Sample defined in third_party/proto/profile.proto.
class Sample : public ProtoField {
 private:
  std::vector<uint64_t> locationID;
  std::vector<int64_t> value;
  std::vector<Label> label;

 public:
  Sample(std::vector<uint64_t> locationID, std::vector<int64_t> value,
         std::vector<Label> label);
  std::vector<uint64_t> getLocationID();
  std::vector<int64_t> getValue();
  std::vector<Label> getLabel();
  virtual void encode(std::vector<char>* b) const;
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
  Profile(std::string periodType, std::string periodUnit, int64_t period,
          int64_t timeNanos = 0, int64_t durationNanos = 0,
          std::string dropFrames = "", std::string keepFramesX = "");

  void addSampleType(std::string type, std::string unit);

  // adds samples associated with the node to the profile, and pushes the
  // node's location ID to the front of the stack.
  void addSample(std::unique_ptr<Node>& node, std::deque<uint64_t>* stack);
  uint64_t locationID(std::unique_ptr<Node>& node);
  Line line(std::unique_ptr<Node>& node);
  int64_t functionID(std::unique_ptr<Node>& node);
  int64_t stringID(std::string s);

  std::vector<ValueType> getSampleType();
  std::vector<ProfileLocation> getLocation();
  std::vector<Sample> getSample();
  std::vector<Mapping> getMapping();
  std::vector<ProfileFunction> getFunction();
  std::vector<std::string> getStrings();
  std::vector<int64_t> getCommentX();
  int64_t getPeriod();
  int64_t getTimeNanos();
  int64_t getDurationNanos();
  int64_t getDefaultSampleTypeX();
  ValueType getPeriodType();
  int64_t getDropFramesX();
  int64_t getKeepFramesX();

  virtual void encode(std::vector<char>* b) const;
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
                                      Profile* p) const = 0;
};

#endif
