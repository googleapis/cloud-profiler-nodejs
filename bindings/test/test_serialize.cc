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

#include <gtest/gtest.h>
#include "../serialize.h"

struct ExpectedLabel {
  std::string key;
  std::string str;
  int64_t num;
  std::string unit;
};

struct SampleContents {
  std::vector<int64_t> vals;
  std::vector<ExpectedLabel> tags;
};

class TestNode : public Node {
 private:
  std::string nodeName;
  std::string nodeFilename;
  int64_t nodeFileID;
  int64_t nodeLineNumber;
  int64_t nodeColumnNumber;
  std::vector<SampleContents> sampleValues;

 public:
  TestNode(std::string name, std::string filename, int64_t fileID,
           int64_t lineNumber, int64_t columnNumber,
           std::vector<SampleContents> sampleValues)
      : nodeName(name),
        nodeFilename(filename),
        nodeFileID(fileID),
        nodeLineNumber(lineNumber),
        nodeColumnNumber(columnNumber),
        sampleValues(sampleValues){};

  virtual std::string name() const override { return nodeName; }

  virtual std::string filename() const override { return nodeFilename; }

  virtual int64_t getFileID() const override { return nodeFileID; }

  virtual int64_t lineNumber() const override { return nodeLineNumber; }

  virtual int64_t columnNumber() const override { return nodeColumnNumber; }

  virtual std::vector<Sample> samples(const std::deque<uint64_t>& stack,
                                      Profile* p) const override {
    std::vector<Sample> samples;
    for (size_t i = 0; i < sampleValues.size(); i++) {
      SampleContents sc = sampleValues[i];
      std::vector<Label> labels;
      for (size_t j = 0; j < sc.tags.size(); j++) {
        ExpectedLabel tag = sc.tags[j];
        labels.push_back(Label(p->stringID(tag.key), p->stringID(tag.str),
                               tag.num, p->stringID(tag.unit)));
      }
      std::vector<int64_t> vals = sc.vals;
      Sample s({stack.begin(), stack.end()}, vals, labels);
      samples.push_back(std::move(s));
    }
    return samples;
  }
};

struct ExpectedLine {
  uint64_t functionID;
  int64_t line;
};

struct ExpectedLocation {
  uint64_t id;
  uint64_t mappingID;
  uint64_t address;
  std::vector<ExpectedLine> line;
  bool isFolded;
};

struct ExpectedSample {
  std::vector<uint64_t> locationID;
  std::vector<int64_t> value;
  std::vector<ExpectedLabel> label;
};

struct ExpectedMapping {
  uint64_t id;
  uint64_t start;
  uint64_t limit;
  uint64_t offset;
  std::string file;
  std::string buildID;
  bool hasFunctions;
  bool hasFilenames;
  bool hasLineNumbers;
  bool hasInlineFrames;
};

struct ExpectedFunction {
  uint64_t id;
  std::string name;
  std::string systemName;
  std::string filename;
  int64_t startLine;
};

struct ExpectedProfile {
  std::vector<std::tuple<std::string, std::string>> sampleType;
  std::vector<ExpectedLocation> location;
  std::vector<ExpectedSample> sample;
  std::vector<ExpectedMapping> mapping;
  std::vector<ExpectedFunction> function;
  std::vector<std::string> strings;
  std::vector<std::string> comment;
  int64_t period;
  int64_t timeNanos;
  int64_t durationNanos;
  int64_t defaultSampleTypeX;
  std::tuple<std::string, std::string> periodType;
  std::string dropFrames;
  std::string keepFrames;
};

void assertExpectedProfile(const Profile& p, ExpectedProfile e) {
  std::vector<std::string> profileStrings = p.getStrings();
  ASSERT_EQ(e.strings, profileStrings);

  const std::vector<ValueType>& sampleType = p.getSampleType();
  ASSERT_EQ(e.sampleType.size(), sampleType.size());
  for (size_t i = 0; i < sampleType.size(); i++) {
    std::tuple<std::string, std::string> expValueType = e.sampleType[i];
    ASSERT_EQ(std::get<0>(expValueType),
              profileStrings[sampleType[i].getTypeX()]);
    ASSERT_EQ(std::get<1>(expValueType),
              profileStrings[sampleType[i].getUnitX()]);
  }

  const std::vector<ProfileLocation>& locations = p.getLocation();
  ASSERT_EQ(e.location.size(), locations.size());
  for (size_t i = 0; i < locations.size(); i++) {
    ExpectedLocation expLocation = e.location[i];
    ASSERT_EQ(expLocation.id, locations[i].getID());
    ASSERT_EQ(expLocation.mappingID, locations[i].getMappingID());
    ASSERT_EQ(expLocation.address, locations[i].getAddress());
    ASSERT_EQ(expLocation.isFolded, locations[i].getIsFolded());
  }

  const std::vector<Sample>& samples = p.getSample();
  ASSERT_EQ(e.sample.size(), samples.size());
  for (size_t i = 0; i < samples.size(); i++) {
    ExpectedSample expSample = e.sample[i];
    ASSERT_EQ(expSample.locationID, samples[i].getLocationID());
    ASSERT_EQ(expSample.value, samples[i].getValue());

    const std::vector<Label>& labels = samples[i].getLabel();
    ASSERT_EQ(expSample.label.size(), labels.size());
    for (size_t j = 0; j < labels.size(); j++) {
      ExpectedLabel expLabel = expSample.label[i];
      ASSERT_EQ(expLabel.key, profileStrings[labels[j].getKeyX()])
          << "key for label " << j << "for sample " << i;
      ASSERT_EQ(expLabel.str, profileStrings[labels[j].getStrX()])
          << "str for label " << j << "for sample " << i;
      ASSERT_EQ(expLabel.num, labels[j].getNum())
          << "num for label " << j << "for sample " << i;
      ASSERT_EQ(expLabel.unit, profileStrings[labels[j].getUnitX()])
          << "unit for label " << j << "for sample " << i;
    }
  }

  const std::vector<Mapping>& mappings = p.getMapping();
  ASSERT_EQ(e.mapping.size(), mappings.size());
  for (size_t i = 0; i < mappings.size(); i++) {
    ExpectedMapping expMapping = e.mapping[i];
    ASSERT_EQ(expMapping.id, mappings[i].getID());
    ASSERT_EQ(expMapping.start, mappings[i].getStart());
    ASSERT_EQ(expMapping.limit, mappings[i].getLimit());
    ASSERT_EQ(expMapping.offset, mappings[i].getOffset());
    ASSERT_EQ(expMapping.file, profileStrings[mappings[i].getFileX()]);
    ASSERT_EQ(expMapping.buildID, profileStrings[mappings[i].getBuildIDX()]);
    ASSERT_EQ(expMapping.hasFunctions, mappings[i].getHasFunctions());
    ASSERT_EQ(expMapping.hasFilenames, mappings[i].getHasFilenames());
    ASSERT_EQ(expMapping.hasLineNumbers, mappings[i].getHasLineNumbers());
    ASSERT_EQ(expMapping.hasInlineFrames, mappings[i].getHasInlineFrames());
  }

  const std::vector<ProfileFunction>& functions = p.getFunction();
  ASSERT_EQ(e.function.size(), functions.size());
  for (size_t i = 0; i < mappings.size(); i++) {
    ExpectedFunction expFunction = e.function[i];
    ASSERT_EQ(expFunction.id, functions[i].getID());
    ASSERT_EQ(expFunction.name, profileStrings[functions[i].getNameX()]);
    ASSERT_EQ(expFunction.systemName,
              profileStrings[functions[i].getSystemNameX()]);
    ASSERT_EQ(expFunction.filename,
              profileStrings[functions[i].getFilenameX()]);
    ASSERT_EQ(expFunction.startLine, functions[i].getStartLine());
  }

  const std::vector<int64_t>& comments = p.getCommentX();
  ASSERT_EQ(e.comment.size(), comments.size());
  for (size_t i = 0; i < comments.size(); i++) {
    ASSERT_EQ(e.comment[i], profileStrings[comments[i]]);
  }

  ASSERT_EQ(e.timeNanos, p.getTimeNanos());
  ASSERT_EQ(e.durationNanos, p.getDurationNanos());
  ASSERT_EQ(e.defaultSampleTypeX, p.getDefaultSampleTypeX());

  const ValueType& periodType = p.getPeriodType();
  ASSERT_EQ(std::get<0>(e.periodType), profileStrings[periodType.getTypeX()]);
  ASSERT_EQ(std::get<1>(e.periodType), profileStrings[periodType.getUnitX()]);

  ASSERT_EQ(e.dropFrames, profileStrings[p.getDropFramesX()]);
  ASSERT_EQ(e.keepFrames, profileStrings[p.getKeepFramesX()]);
}

TEST(Profile, stringId) {
  Profile p("space", "bytes", 512 * 1024, 0);
  std::vector<std::string> wantStrings = {"", "bytes", "space"};
  ASSERT_EQ(wantStrings, p.getStrings());
  ASSERT_EQ(0, p.stringID(""));
  ASSERT_EQ(1, p.stringID("bytes"));
  ASSERT_EQ(2, p.stringID("space"));
  ASSERT_EQ(3, p.stringID("new value"));
  wantStrings.push_back("new value");
  ASSERT_EQ(wantStrings, p.getStrings());
}

TEST(Profile, ConstructorMinimalArgs) {
  Profile p("space", "bytes", 512 * 1024, 0);
  ExpectedProfile e = {};
  e.strings = {"", "bytes", "space"};
  e.period = 0;
  e.periodType = std::tuple<std::string, std::string>("space", "bytes");
  e.timeNanos = 0;
  e.durationNanos = 0;
  e.defaultSampleTypeX = 0;
  e.dropFrames = "";
  e.keepFrames = "";
  assertExpectedProfile(p, e);
}

TEST(Profile, ConstructorAllArgs) {
  Profile p("space", "bytes", 512 * 1024, 1234567890, 1e10, "drop", "keep");
  ExpectedProfile e = {};
  e.strings = {"", "bytes", "space", "drop", "keep"};
  e.period = 512 * 1024;
  e.periodType = std::tuple<std::string, std::string>("space", "bytes");
  e.timeNanos = 1234567890;
  e.durationNanos = 1e10;
  e.defaultSampleTypeX = 0;
  e.dropFrames = "drop";
  e.keepFrames = "keep";
  assertExpectedProfile(p, e);
}

TEST(Profile, addSampleOnce) {
  Profile p("time", "ms", 100, 0);

  int64_t fileID = 500;
  int64_t lineNumber = 400;
  int64_t columnNumber = 300;
  std::vector<SampleContents> sampleValues;
  sampleValues.push_back({{50, 200}, {}});
  TestNode node("name", "filename", fileID, lineNumber, columnNumber,
                sampleValues);

  std::deque<uint64_t> stack = {};
  p.addSample(node, &stack);

  ExpectedProfile e = {};
  e.strings = {"", "ms", "time", "name", "filename"};
  e.location = {{
      1,           // id
      0,           // mappingID,
      0,           // address.
      {{1, 400}},  // line
      false,       // isFolded
  }};
  e.sample = {{
      {1},        // locationID
      {50, 200},  // value
      {},         // label
  }};
  e.function = {{
      1,           // id
      "name",      // name
      "name",      // systemName
      "filename",  // file
      1,
  }};
  e.period = 100;
  e.periodType = std::tuple<std::string, std::string>("time", "ms");
  e.timeNanos = 0;
  e.durationNanos = 0;
  e.defaultSampleTypeX = 0;
  e.dropFrames = "";
  e.keepFrames = "";

  assertExpectedProfile(p, e);
}

TEST(Profile, addSampleTwice) {
  Profile p("time", "ms", 100, 0);

  int64_t fileID = 500;
  int64_t lineNumber = 400;
  int64_t columnNumber = 300;
  std::vector<SampleContents> sampleValues;
  sampleValues.push_back({{50, 200}, {}});
  TestNode node("name", "filename", fileID, lineNumber, columnNumber,
                sampleValues);

  std::deque<uint64_t> stack1 = {};
  std::deque<uint64_t> stack2 = {};
  p.addSample(node, &stack1);
  p.addSample(node, &stack2);

  ExpectedProfile e = {};
  e.strings = {"", "ms", "time", "name", "filename"};
  e.location = {{
      1,           // id
      0,           // mappingID,
      0,           // address.
      {{1, 400}},  // line
      false,       // isFolded
  }};
  e.sample = {{
                  {1},        // locationID
                  {50, 200},  // value
                  {},         // label
              },
              {
                  {1},        // locationID
                  {50, 200},  // value
                  {},         // label
              }};
  e.function = {{
      1,           // id
      "name",      // name
      "name",      // systemName
      "filename",  // file
      1,
  }};
  e.period = 100;
  e.periodType = std::tuple<std::string, std::string>("time", "ms");
  e.timeNanos = 0;
  e.durationNanos = 0;
  e.defaultSampleTypeX = 0;
  e.dropFrames = "";
  e.keepFrames = "";

  assertExpectedProfile(p, e);
}

TEST(ValueType, encode) {
  ValueType v = ValueType(10,  // typeX
                          20   // unitX
  );
  std::vector<char> expected = {
      static_cast<char>(0x8), static_cast<char>(10),   // typeX
      static_cast<char>(0x10), static_cast<char>(20),  // unitX
  };
  std::vector<char> actual;
  v.encode(&actual);
  ASSERT_EQ(expected, actual);
}

TEST(Label, encode) {
  Label l = Label(5,  // keyX
                  6,  // strX
                  7,  // num
                  8   // unitX
  );
  std::vector<char> expected = {
      static_cast<char>(0x8),  static_cast<char>(5),  // keyX
      static_cast<char>(0x10), static_cast<char>(6),  // strX
      static_cast<char>(0x18), static_cast<char>(7),  // num
      static_cast<char>(0x20), static_cast<char>(8),  // unitX
  };
  std::vector<char> actual;
  l.encode(&actual);
  ASSERT_EQ(expected, actual);
}

TEST(Mapping, encode) {
  Mapping m = Mapping(3,     // id
                      6,     // start
                      9,     // limit
                      12,    // offset
                      15,    // fileX
                      18,    // buildIDX
                      true,  // hasFunctions
                      true,  // hasFilenames
                      true,  // hasLineNumbers
                      true   // hasInlineFrames
  );
  std::vector<char> expected = {
      static_cast<char>(0x8),  static_cast<char>(3),   // id
      static_cast<char>(0x10), static_cast<char>(6),   // start
      static_cast<char>(0x18), static_cast<char>(9),   // limit
      static_cast<char>(0x20), static_cast<char>(12),  // offset
      static_cast<char>(0x28), static_cast<char>(15),  // fileX
      static_cast<char>(0x30), static_cast<char>(18),  // buildIDX
      static_cast<char>(0x38), static_cast<char>(1),   // hasFunctions
      static_cast<char>(0x40), static_cast<char>(1),   // hasFilenames
      static_cast<char>(0x48), static_cast<char>(1),   // hasLineNumbers
      static_cast<char>(0x50), static_cast<char>(1),   // hasInlineFrames
  };

  std::vector<char> actual;
  m.encode(&actual);
  ASSERT_EQ(expected, actual);
}

TEST(Line, encode) {
  Line line = Line(50,  // function id
                   60   // line number
  );
  std::vector<char> expected = {
      static_cast<char>(0x8), static_cast<char>(50),   // function id
      static_cast<char>(0x10), static_cast<char>(60),  // line number
  };

  std::vector<char> actual;
  line.encode(&actual);
  ASSERT_EQ(expected, actual);
}

TEST(ProfileFunction, encode) {
  ProfileFunction f(20,  // id
                    15,  // nameX
                    10,  // systemNameX
                    5,   // filenameX
                    50   // start line
  );
  std::vector<char> expected = {
      static_cast<char>(0x8),  static_cast<char>(20),  // id
      static_cast<char>(0x10), static_cast<char>(15),  // nameX
      static_cast<char>(0x18), static_cast<char>(10),  // systemNameX
      static_cast<char>(0x20), static_cast<char>(5),   // filenameX
      static_cast<char>(0x28), static_cast<char>(50),  // start line
  };

  std::vector<char> actual;
  f.encode(&actual);
  ASSERT_EQ(expected, actual);
}

TEST(ProfileLocation, encode) {
  ProfileLocation l(30,              // id
                    27,              // mappingId
                    29,              // address
                    {Line(6, 570)},  // line
                    false            // isFolded
  );
  std::vector<char> expected = {
      static_cast<char>(0x8),
      static_cast<char>(30),  // id
      static_cast<char>(0x10),
      static_cast<char>(27),  // mappingId
      static_cast<char>(0x18),
      static_cast<char>(29),  // address

      // line
      static_cast<char>(0x22),
      static_cast<char>(0x5),  // line length
      static_cast<char>(0x8),
      static_cast<char>(6),  // line's function id
      // line's line number
      static_cast<char>(0x10),
      static_cast<char>(0xBA),
      static_cast<char>(0x4),
  };

  std::vector<char> actual;
  l.encode(&actual);
  ASSERT_EQ(expected, actual);
}

TEST(Sample, encode) {
  Sample s({1, 2, 3, 4},  // location id
           {50, 100},     // value

           // label
           {Label(5,  // key
                  6,  // strX
                  7,  // num
                  8   // unitX
                  )});

  std::vector<char> expected = {
      // location id
      static_cast<char>(0xA), static_cast<char>(4), static_cast<char>(1),
      static_cast<char>(2), static_cast<char>(3), static_cast<char>(4),

      // value
      static_cast<char>(0x10), static_cast<char>(50), static_cast<char>(0x10),
      static_cast<char>(100),

      // label
      static_cast<char>(0x1A),
      static_cast<char>(8),                           // length
      static_cast<char>(0x8), static_cast<char>(5),   // keyX
      static_cast<char>(0x10), static_cast<char>(6),  // strX
      static_cast<char>(0x18), static_cast<char>(7),  // num
      static_cast<char>(0x20), static_cast<char>(8),  // unitX
  };

  std::vector<char> actual;
  s.encode(&actual);
  ASSERT_EQ(expected, actual);
}

TEST(Profile, encode) {
  Profile p("time", "ms", 100, 25, 15);
  p.addSampleType("time", "ms");
  p.addSampleType("samples", "count");

  int64_t fileID = 80;
  int64_t lineNumber = 90;
  int64_t columnNumber = 100;
  std::vector<SampleContents> sampleValues;
  sampleValues.push_back({{50, 60}, {}});
  TestNode node("name", "filename", fileID, lineNumber, columnNumber,
                sampleValues);

  std::deque<uint64_t> stack = {};
  p.addSample(node, &stack);

  std::vector<char> expected = {
      // sample type
      static_cast<char>(0xA),
      static_cast<char>(0x4),
      static_cast<char>(0x8),
      static_cast<char>(0x2),
      static_cast<char>(0x10),
      static_cast<char>(0x1),
      static_cast<char>(0xA),
      static_cast<char>(0x4),
      static_cast<char>(0x8),
      static_cast<char>(0x3),
      static_cast<char>(0x10),
      static_cast<char>(0x4),

      // sample
      static_cast<char>(0x12),
      static_cast<char>(0x6),
      static_cast<char>(0x8),
      static_cast<char>(0x1),  // sample location id
      static_cast<char>(0x10),
      static_cast<char>(50),  // sample value
      static_cast<char>(0x10),
      static_cast<char>(60),  // sample value

      // profile location
      static_cast<char>(0x22),
      static_cast<char>(0x8),
      static_cast<char>(0x8),
      static_cast<char>(0x1),  // id
      // line
      static_cast<char>(0x22),
      static_cast<char>(0x4),
      static_cast<char>(0x8),
      static_cast<char>(0x1),  // line function id
      static_cast<char>(0x10),
      static_cast<char>(90),  // line line number

      // function
      static_cast<char>(0x2A),
      static_cast<char>(0xA),
      static_cast<char>(0x8),
      static_cast<char>(0x1),  // id
      static_cast<char>(0x10),
      static_cast<char>(0x5),  // name
      static_cast<char>(0x18),
      static_cast<char>(0x5),  // system name
      static_cast<char>(0x20),
      static_cast<char>(0x6),  // filename
      static_cast<char>(0x28),
      static_cast<char>(90),  // line

      // String table
      static_cast<char>(0x32),
      static_cast<char>(0x0),  // ""
      static_cast<char>(0x32),
      static_cast<char>(0x2),
      'm',
      's',
      static_cast<char>(0x32),
      static_cast<char>(0x4),
      't',
      'i',
      'm',
      'e',
      static_cast<char>(0x32),
      static_cast<char>(0x7),
      's',
      'a',
      'm',
      'p',
      'l',
      'e',
      's',
      static_cast<char>(0x32),
      static_cast<char>(0x5),
      'c',
      'o',
      'u',
      'n',
      't',
      static_cast<char>(0x32),
      static_cast<char>(0x4),
      'n',
      'a',
      'm',
      'e',
      static_cast<char>(0x32),
      static_cast<char>(0x8),
      'f',
      'i',
      'l',
      'e',
      'n',
      'a',
      'm',
      'e',

      static_cast<char>(0x48),
      static_cast<char>(25),  // time nanos
      static_cast<char>(0x50),
      static_cast<char>(15),  // duration nanos

      // period type
      static_cast<char>(0x5A),
      static_cast<char>(0x4),
      static_cast<char>(0x8),
      static_cast<char>(0x2),
      static_cast<char>(0x10),
      static_cast<char>(0x1),

      // period
      static_cast<char>(0x60),
      static_cast<char>(100),

      // default sample type
      static_cast<char>(0x70),
      static_cast<char>(0),

  };
  std::vector<char> actual;
  p.encode(&actual);
  ASSERT_EQ(expected, actual);
}