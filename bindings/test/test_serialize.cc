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

#include <gtest/gtest.h>
#include "../serialize.h"

struct Tag {
  std::string key;
  std::string str;
  int64_t num;
  std::string unit;
};

struct SampleContents {
  std::vector<int64_t> vals;
  std::vector<Tag> tags;
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

  virtual std::string name() { return nodeName; }

  virtual std::string filename() { return nodeFilename; }

  virtual int64_t getFileID() { return nodeFileID; }

  virtual int64_t lineNumber() { return nodeLineNumber; }

  virtual int64_t columnNumber() { return nodeColumnNumber; }

  virtual std::vector<Sample> samples(const std::deque<uint64_t> &stack,
                                      Profile *p) {
    std::vector<Sample> samples;
    for (size_t i = 0; i < sampleValues.size(); i++) {
      SampleContents sc = sampleValues[i];
      std::vector<Label> labels;
      for (size_t j = 0; j < sc.tags.size(); j++) {
        Tag tag = sc.tags[j];
        labels.push_back(Label(p->stringID(tag.key), p->stringID(tag.str),
                               tag.num, p->stringID(tag.unit)));
      }
      std::vector<int64_t> vals = sc.vals;
      Sample s = Sample({stack.begin(), stack.end()}, vals, labels);
      samples.push_back(s);
    }
    return samples;
  }
};

TEST(Profile, ConstructorMinimalArgs) {
  Profile p = Profile("space", "bytes", 512 * 1024, 0);
  std::vector<std::string> wantStrings = {"", "bytes", "space"};
  std::vector<std::string> gotStrings = p.getStrings();
  ASSERT_EQ(wantStrings, gotStrings);
  ASSERT_EQ(0, p.stringID(""));
  ASSERT_EQ(1, p.stringID("bytes"));
  ASSERT_EQ(2, p.stringID("space"));

  ASSERT_EQ(0, p.getSampleType().size());
  ASSERT_EQ(0, p.getLocation().size());
  ASSERT_EQ(0, p.getSample().size());
  ASSERT_EQ(0, p.getMapping().size());
  ASSERT_EQ(0, p.getFunction().size());
  ASSERT_EQ(0, p.getCommentX().size());

  ASSERT_EQ(512 * 1024, p.getPeriod());
  ASSERT_EQ(0, p.getTimeNanos());
  ASSERT_EQ(0, p.getDurationNanos());
  ASSERT_EQ(0, p.getDefaultSampleTypeX());

  ValueType periodType = p.getPeriodType();
  ASSERT_EQ("space", gotStrings[periodType.typeX]);
  ASSERT_EQ("bytes", gotStrings[periodType.unitX]);

  ASSERT_EQ("", gotStrings[p.getDropFramesX()]);
  ASSERT_EQ("", gotStrings[p.getKeepFramesX()]);
}

TEST(Profile, ConstructorAllArgs) {
  Profile p =
      Profile("space", "bytes", 512 * 1024, 1234567890, 1e10, "drop", "keep");
  std::vector<std::string> wantStrings = {"", "bytes", "space", "drop", "keep"};
  std::vector<std::string> gotStrings = p.getStrings();
  ASSERT_EQ(wantStrings, gotStrings);
  ASSERT_EQ(0, p.stringID(""));
  ASSERT_EQ(1, p.stringID("bytes"));
  ASSERT_EQ(2, p.stringID("space"));

  ASSERT_EQ(0, p.getSampleType().size());
  ASSERT_EQ(0, p.getLocation().size());
  ASSERT_EQ(0, p.getSample().size());
  ASSERT_EQ(0, p.getMapping().size());
  ASSERT_EQ(0, p.getFunction().size());
  ASSERT_EQ(0, p.getCommentX().size());

  ASSERT_EQ(512 * 1024, p.getPeriod());
  ASSERT_EQ(1234567890, p.getTimeNanos());
  ASSERT_EQ(1e10, p.getDurationNanos());
  ASSERT_EQ(0, p.getDefaultSampleTypeX());

  ValueType periodType = p.getPeriodType();
  ASSERT_EQ("space", gotStrings[periodType.typeX]);
  ASSERT_EQ("bytes", gotStrings[periodType.unitX]);

  ASSERT_EQ("drop", gotStrings[p.getDropFramesX()]);
  ASSERT_EQ("keep", gotStrings[p.getKeepFramesX()]);
}

TEST(Profile, stringId) {
  Profile p = Profile("space", "bytes", 512 * 1024, 0);
  std::vector<std::string> wantStrings = {"", "bytes", "space"};
  ASSERT_EQ(wantStrings, p.getStrings());
  ASSERT_EQ(0, p.stringID(""));
  ASSERT_EQ(1, p.stringID("bytes"));
  ASSERT_EQ(2, p.stringID("space"));
}

TEST(Profile, addSampleOnce) {
  Profile p = Profile("space", "bytes", 512 * 1024, 0);

  int64_t fileID = 500;
  int64_t lineNumber = 400;
  int64_t columnNumber = 300;
  std::vector<SampleContents> sampleValues;
  sampleValues.push_back({{50, 200}, {}});
  std::unique_ptr<Node> node(new TestNode(
      "name", "filename", fileID, lineNumber, columnNumber, sampleValues));

  std::deque<uint64_t> stack = {};
  p.addSample(node, &stack);

  std::vector<std::string> wantStrings = {"", "bytes", "space", "name",
                                          "filename"};
  ASSERT_EQ(wantStrings, p.getStrings());
  std::vector<std::string> gotStrings = p.getStrings();
  ASSERT_EQ(wantStrings, gotStrings);
  ASSERT_EQ(0, p.stringID(""));
  ASSERT_EQ(1, p.stringID("bytes"));
  ASSERT_EQ(2, p.stringID("space"));

  ASSERT_EQ(0, p.getSampleType().size());

  std::vector<ProfileLocation> gotLocation = p.getLocation();
  ASSERT_EQ(1, gotLocation.size());
  ASSERT_EQ(1, gotLocation[0].getID());
  ASSERT_EQ(0, gotLocation[0].getMappingID());
  ASSERT_EQ(0, gotLocation[0].getAddress());
  ASSERT_EQ(false, gotLocation[0].getIsFolded());
  std::vector<Line> lines = gotLocation[0].getLine();
  for (size_t i; i < lines.size(); i++) {
    Line line = lines[i];
    ASSERT_EQ(1, line.getFunctionID());
    ASSERT_EQ(2, line.getLine());
  }

  std::vector<Sample> samples = p.getSample();
  ASSERT_EQ(1, p.getSample().size());
  Sample sample = samples[0];
  std::vector<uint64_t> expLocationId = {1};
  ASSERT_EQ(expLocationId, sample.getLocationID());
  std::vector<int64_t> expValue = {50, 200};
  ASSERT_EQ(expValue, sample.getValue());
  ASSERT_EQ(0, sample.getLabel().size());

  ASSERT_EQ(0, p.getMapping().size());

  std::vector<ProfileFunction> functions = p.getFunction();
  ASSERT_EQ(1, functions.size());
  ProfileFunction function = functions[0];
  ASSERT_EQ(1, function.getID());
  ASSERT_EQ("name", gotStrings[function.getNameX()]);
  ASSERT_EQ("name", gotStrings[function.getSystemNameX()]);
  ASSERT_EQ("filename", gotStrings[function.getFilenameX()]);
  ASSERT_EQ(lineNumber, function.getStartLine());

  ValueType periodType = p.getPeriodType();
  ASSERT_EQ("space", gotStrings[periodType.typeX]);
  ASSERT_EQ("bytes", gotStrings[periodType.unitX]);

  ASSERT_EQ("", gotStrings[p.getDropFramesX()]);
  ASSERT_EQ("", gotStrings[p.getKeepFramesX()]);
}

TEST(Profile, addSampleTwice) {
  Profile p = Profile("space", "bytes", 512 * 1024, 0);

  int64_t fileID = 500;
  int64_t lineNumber = 400;
  int64_t columnNumber = 300;
  std::vector<SampleContents> sampleValues;
  sampleValues.push_back({{50, 200}, {}});
  std::unique_ptr<Node> node(new TestNode(
      "name", "filename", fileID, lineNumber, columnNumber, sampleValues));

  std::deque<uint64_t> stack1 = {};
  std::deque<uint64_t> stack2 = {};
  p.addSample(node, &stack1);
  p.addSample(node, &stack2);

  std::vector<std::string> wantStrings = {"", "bytes", "space", "name",
                                          "filename"};
  ASSERT_EQ(wantStrings, p.getStrings());
  std::vector<std::string> gotStrings = p.getStrings();
  ASSERT_EQ(wantStrings, gotStrings);
  ASSERT_EQ(0, p.stringID(""));
  ASSERT_EQ(1, p.stringID("bytes"));
  ASSERT_EQ(2, p.stringID("space"));

  ASSERT_EQ(0, p.getSampleType().size());

  std::vector<ProfileLocation> gotLocation = p.getLocation();
  ASSERT_EQ(1, gotLocation.size());
  ASSERT_EQ(1, gotLocation[0].getID());
  ASSERT_EQ(0, gotLocation[0].getMappingID());
  ASSERT_EQ(0, gotLocation[0].getAddress());
  ASSERT_EQ(false, gotLocation[0].getIsFolded());
  std::vector<Line> lines = gotLocation[0].getLine();
  for (size_t i; i < lines.size(); i++) {
    Line line = lines[i];
    ASSERT_EQ(1, line.getFunctionID());
    ASSERT_EQ(2, line.getLine());
  }

  std::vector<Sample> samples = p.getSample();
  ASSERT_EQ(2, p.getSample().size());
  for (size_t i = 0; i < samples.size(); i++) {
    Sample sample = samples[i];
    std::vector<uint64_t> expLocationId = {1};
    ASSERT_EQ(expLocationId, sample.getLocationID());
    std::vector<int64_t> expValue = {50, 200};
    ASSERT_EQ(expValue, sample.getValue());
    ASSERT_EQ(0, sample.getLabel().size());
  }

  ASSERT_EQ(0, p.getMapping().size());

  std::vector<ProfileFunction> functions = p.getFunction();
  ASSERT_EQ(1, functions.size());
  ProfileFunction function = functions[0];
  ASSERT_EQ(1, function.getID());
  ASSERT_EQ("name", gotStrings[function.getNameX()]);
  ASSERT_EQ("name", gotStrings[function.getSystemNameX()]);
  ASSERT_EQ("filename", gotStrings[function.getFilenameX()]);
  ASSERT_EQ(lineNumber, function.getStartLine());

  ValueType periodType = p.getPeriodType();
  ASSERT_EQ("space", gotStrings[periodType.typeX]);
  ASSERT_EQ("bytes", gotStrings[periodType.unitX]);

  ASSERT_EQ("", gotStrings[p.getDropFramesX()]);
  ASSERT_EQ("", gotStrings[p.getKeepFramesX()]);
}