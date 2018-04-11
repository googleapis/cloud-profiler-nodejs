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

#include "serialize-v8.h"
#include "serialize.h"

using namespace v8;

class HeapNode : public Node {
 private:
  AllocationProfile::Node *node;

 public:
  HeapNode(AllocationProfile::Node *node) { this->node = node; }

  virtual std::string name() const override { return *String::Utf8Value(node->name); }

  virtual std::string filename() const override {
    return *String::Utf8Value(node->script_name);
  }

  virtual int64_t getFileID() const override { return node->script_id; }

  virtual int64_t lineNumber() const override { return node->line_number; }

  virtual int64_t columnNumber() const override { return node->column_number; }

  virtual std::vector<Sample> samples(const std::deque<uint64_t> &stack,
                                      Profile *p) const override {
    std::vector<Sample> samples;
    for (size_t i = 0; i < node->allocations.size(); i++) {
      AllocationProfile::Allocation allocation = node->allocations[i];
      std::vector<Label> labels = {Label(
          p->stringID("allocation"), 0, allocation.size, p->stringID("bytes"))};
      std::vector<int64_t> vals = {
          allocation.count,
          static_cast<int64_t>(allocation.size * allocation.count)};
      Sample s = Sample({stack.begin(), stack.end()}, vals, labels);
      samples.push_back(s);
    }
    return samples;
  }
};

class TimeNode : public Node {
 private:
  const CpuProfileNode *node;
  int samplingIntervalMicros;

 public:
  TimeNode(const CpuProfileNode *node, int samplingIntervalMicros) {
    this->node = node;
    this->samplingIntervalMicros = samplingIntervalMicros;
  }

  virtual std::string name() const override {
    return *String::Utf8Value(node->GetFunctionName());
  }

  virtual std::string filename() const override {
    return *String::Utf8Value(node->GetScriptResourceName());
  }

  virtual int64_t getFileID() const override { return node->GetScriptId(); }

  virtual int64_t lineNumber() const override { return node->GetLineNumber(); }

  virtual int64_t columnNumber() const override {
    return node->GetColumnNumber();
  }

  virtual std::vector<Sample> samples(const std::deque<uint64_t> &stack,
                              Profile *p) const override {
    std::vector<Sample> samples;
    int64_t hitCount = node->GetHitCount();
    std::vector<int64_t> vals = {hitCount, hitCount * samplingIntervalMicros};
    Sample s = Sample({stack.begin(), stack.end()}, vals, std::vector<Label>());
    samples.push_back(s);
    return samples;
  }
};

struct TimeEntry {
  const CpuProfileNode *node;

  // number of entries which would need to be removed from the stack after
  // processing the node if the node were a leaf node.
  int popCount;
};

std::unique_ptr<std::vector<char>> serializeTimeProfile(
    CpuProfile *profile, int64_t samplingIntervalMicros,
    int64_t startTimeNanos) {
  int64_t durationNanos =
      (profile->GetEndTime() - profile->GetStartTime()) * 1000;

  Profile p = Profile("wall", "microseconds", samplingIntervalMicros,
                      startTimeNanos, durationNanos);
  p.addSampleType("sample", "count");
  p.addSampleType("wall", "microseconds");

  // Add root to entries
  const CpuProfileNode *root = profile->GetTopDownRoot();
  std::deque<TimeEntry> entries;
  int32_t count = root->GetChildrenCount();
  for (int32_t i = 0; i < count; i++) {
    TimeEntry child = {root->GetChild(i), 1};
    entries.push_back(child);
  }

  // Iterate over profile tree and serialize
  std::deque<uint64_t> stack;
  while (entries.size() > 0) {
    TimeEntry entry = entries.front();
    entries.pop_front();

    std::unique_ptr<Node> node(
        new TimeNode(entry.node, samplingIntervalMicros));
    p.addSample(node, &stack);
    int32_t count = entry.node->GetChildrenCount();
    if (count == 0) {
      for (int i = 0; i < entry.popCount; i++) {
        stack.pop_front();
      }
      continue;
    }
    for (int32_t i = 0; i < count; i++) {
      int popCount = 1;
      if (i == 0) {
        popCount += entry.popCount;
      }
      entries.push_front({entry.node->GetChild(i), popCount});
    }
  }

  // serialize profile
  std::vector<char> *b = new std::vector<char>();
  p.encode(b);
  return std::unique_ptr<std::vector<char>>(b);
}

struct HeapEntry {
  AllocationProfile::Node *node;

  // number of entries which would need to be removed from the stack after
  // processing the node if the node were a leaf node.
  int popCount;
};

std::unique_ptr<std::vector<char>> serializeHeapProfile(
    std::unique_ptr<AllocationProfile> profile, int64_t intervalBytes,
    int64_t startTimeNanos) {
  Profile p = Profile("space", "bytes", intervalBytes, startTimeNanos);
  p.addSampleType("objects", "count");
  p.addSampleType("space", "bytes");

  // Add root to entries
  AllocationProfile::Node *root = profile->GetRootNode();
  std::deque<HeapEntry> entries;
  for (size_t i = 0; i < root->children.size(); i++) {
    HeapEntry entry = {root->children[i], 1};
    entries.push_front(entry);
  }

  // Iterate over profile tree and serialize
  std::deque<uint64_t> stack;
  while (entries.size() > 0) {
    HeapEntry entry = entries.front();
    entries.pop_front();

    std::unique_ptr<Node> node(new HeapNode(entry.node));
    p.addSample(node, &stack);
    int32_t count = entry.node->children.size();
    if (count == 0) {
      for (int i = 0; i < entry.popCount; i++) {
        stack.pop_front();
      }
      continue;
    }
    for (int32_t i = 0; i < count; i++) {
      int popCount = 1;
      if (i == 0) {
        popCount += entry.popCount;
      }
      HeapEntry child = {entry.node->children[i], popCount};
      entries.push_front(child);
    }
  }

  // serialize profile
  std::vector<char> *b = new std::vector<char>();
  p.encode(b);
  return std::unique_ptr<std::vector<char>>(b);
}
