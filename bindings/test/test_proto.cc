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
#include "../proto.h"

TEST(proto, encodeVarint) {
  typedef struct {
    uint64_t input;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {1, {static_cast<char>(0x1)}},
      {300, {static_cast<char>(0xAC), static_cast<char>(0x2)}},
      {1024, {static_cast<char>(0x80), static_cast<char>(0x08)}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeVarint(tc[i].input, &actual);
    ASSERT_EQ(tc[i].expected, actual)
        << "encoding " << tc[i].input << " as varint"
        << "\n";
  }
}

TEST(proto, encodeLength) {
  typedef struct {
    int tag;
    int len;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {4, 10, {static_cast<char>(0x22), static_cast<char>(0xA)}},
      {15,
       570,
       {static_cast<char>(0x7A), static_cast<char>(0xBA),
        static_cast<char>(0x4)}},
      {100,
       12,
       {static_cast<char>(0xA2), static_cast<char>(0x6),
        static_cast<char>(0xC)}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeLength(tc[i].tag, tc[i].len, &actual);
    ASSERT_EQ(tc[i].expected, actual)
        << "encoding tag " << tc[i].tag << " and length " << tc[i].len << "\n";
  }
}

TEST(proto, encodeUint64) {
  typedef struct {
    int tag;
    uint64_t val;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {8, 70, {static_cast<char>(0x40), static_cast<char>(0x46)}},
      {25,
       5050,
       {static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0xBA), static_cast<char>(0x27)}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeUint64(tc[i].tag, tc[i].val, &actual);
    ASSERT_EQ(tc[i].expected, actual)
        << "encoding tag " << tc[i].tag << " and value " << tc[i].val << "\n";
  }
}

TEST(proto, encodeUint64Opt) {
  typedef struct {
    int tag;
    uint64_t val;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {8, 70, {static_cast<char>(0x40), static_cast<char>(0x46)}},
      {25,
       5050,
       {static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0xBA), static_cast<char>(0x27)}},
      {153, 0, {}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeUint64Opt(tc[i].tag, tc[i].val, &actual);
    ASSERT_EQ(tc[i].expected, actual)
        << "encoding tag " << tc[i].tag << " and value " << tc[i].val << "\n";
  }
}

TEST(proto, encodeUint64s) {
  typedef struct {
    int tag;
    std::vector<uint64_t> vals;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {8, {70}, {static_cast<char>(0x40), static_cast<char>(0x46)}},
      {25,
       {5050, 70},
       {static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0xBA), static_cast<char>(0x27),
        static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0x46)}},
      {4,
       {70, 71, 72},
       {static_cast<char>(0x22), static_cast<char>(0x3),
        static_cast<char>(0x46), static_cast<char>(0x47),
        static_cast<char>(0x48)}},
      {25,
       {5050, 70, 71, 72},
       {static_cast<char>(0xCA), static_cast<char>(0x1), static_cast<char>(0x5),
        static_cast<char>(0xBA), static_cast<char>(0x27),
        static_cast<char>(0x46), static_cast<char>(0x47),
        static_cast<char>(0x48)}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeUint64s(tc[i].tag, tc[i].vals, &actual);
    ASSERT_EQ(tc[i].expected, actual);
  }
}

TEST(proto, encodeInt64) {
  typedef struct {
    int tag;
    int64_t val;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {8, 0, {static_cast<char>(0x40), static_cast<char>(0x0)}},
      {8, 70, {static_cast<char>(0x40), static_cast<char>(0x46)}},
      {25,
       5050,
       {static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0xBA), static_cast<char>(0x27)}},
      {8,
       -1,
       {static_cast<char>(0x40), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0x1)}},
      {25,
       -79,
       {static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0xB1), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0x1)}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeUint64(tc[i].tag, tc[i].val, &actual);
    ASSERT_EQ(tc[i].expected, actual)
        << "encoding tag " << tc[i].tag << " and value " << tc[i].val << "\n";
  }
}

TEST(proto, encodeInt64Opt) {
  typedef struct {
    int tag;
    int64_t val;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {8, 70, {static_cast<char>(0x40), static_cast<char>(0x46)}},
      {25,
       5050,
       {static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0xBA), static_cast<char>(0x27)}},
      {8,
       -1,
       {static_cast<char>(0x40), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0x1)}},
      {25,
       -79,
       {static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0xB1), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0x1)}},
      {15, 0, {}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeInt64Opt(tc[i].tag, tc[i].val, &actual);
    ASSERT_EQ(tc[i].expected, actual)
        << "encoding tag " << tc[i].tag << " and value " << tc[i].val << "\n";
  }
}

TEST(proto, encodeInt64s) {
  typedef struct {
    int tag;
    std::vector<int64_t> vals;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {8,
       {-1},
       {static_cast<char>(0x40), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0x1)}},
      {25,
       {5050, 70},
       {static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0xBA), static_cast<char>(0x27),
        static_cast<char>(0xC8), static_cast<char>(0x1),
        static_cast<char>(0x46)}},
      {4,
       {70, 71, 72},
       {static_cast<char>(0x22), static_cast<char>(0x3),
        static_cast<char>(0x46), static_cast<char>(0x47),
        static_cast<char>(0x48)}},
      {25,
       {-79, 70, 71, 72},
       {static_cast<char>(0xCA), static_cast<char>(0x1), static_cast<char>(0xD),
        static_cast<char>(0xB1), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0xFF),
        static_cast<char>(0xFF), static_cast<char>(0x1),
        static_cast<char>(0x46), static_cast<char>(0x47),
        static_cast<char>(0x48)}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeInt64s(tc[i].tag, tc[i].vals, &actual);
    ASSERT_EQ(tc[i].expected, actual);
  }
}

TEST(proto, encodeBool) {
  typedef struct {
    int tag;
    bool val;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {15, true, {static_cast<char>(0x78), static_cast<char>(0x1)}},
      {4, false, {static_cast<char>(0x20), static_cast<char>(0x0)}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeBool(tc[i].tag, tc[i].val, &actual);
    ASSERT_EQ(tc[i].expected, actual)
        << "encoding tag " << tc[i].tag << " and value " << tc[i].val << "\n";
  }
}

TEST(proto, encodeBoolOpt) {
  typedef struct {
    int tag;
    bool val;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {15, true, {static_cast<char>(0x78), static_cast<char>(0x1)}},
      {4, false, {}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeBoolOpt(tc[i].tag, tc[i].val, &actual);
    ASSERT_EQ(tc[i].expected, actual)
        << "encoding tag " << tc[i].tag << " and value " << tc[i].val << "\n";
  }
}

TEST(proto, encodeString) {
  typedef struct {
    int tag;
    std::string val;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {15, "", {static_cast<char>(0x7A), static_cast<char>(0x0)}},
      {4,
       "this string",
       {static_cast<char>(0x22), static_cast<char>(0xB), 't', 'h', 'i', 's',
        ' ', 's', 't', 'r', 'i', 'n', 'g'}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeString(tc[i].tag, tc[i].val, &actual);
    ASSERT_EQ(tc[i].expected, actual) << "encoding tag " << tc[i].tag
                                      << " and value \"" << tc[i].val << "\"\n";
  }
}

TEST(proto, encodeStrings) {
  typedef struct {
    int tag;
    std::vector<std::string> vals;
    std::vector<char> expected;
  } testcase;
  std::vector<testcase> tc = {
      {1, {}, {}},
      {15, {""}, {static_cast<char>(0x7A), static_cast<char>(0x0)}},
      {15,
       {"", "a"},
       {static_cast<char>(0x7A), static_cast<char>(0x0),
        static_cast<char>(0x7A), static_cast<char>(0x1), 'a'}},
      {4,
       {"this string", "a", "ab"},
       {static_cast<char>(0x22),
        static_cast<char>(0xB),
        't',
        'h',
        'i',
        's',
        ' ',
        's',
        't',
        'r',
        'i',
        'n',
        'g',
        static_cast<char>(0x22),
        static_cast<char>(0x1),
        'a',
        static_cast<char>(0x22),
        static_cast<char>(0x2),
        'a',
        'b'}},
  };
  for (size_t i = 0; i < tc.size(); i++) {
    std::vector<char> actual;
    encodeStrings(tc[i].tag, tc[i].vals, &actual);
    ASSERT_EQ(tc[i].expected, actual);
  }
}
