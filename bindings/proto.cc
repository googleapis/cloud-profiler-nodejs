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

// This is modeled after
// https://github.com/google/pprof/blob/master/profile/proto.go

#include "proto.h"
#include <algorithm>

void encodeVarint(uint64_t x, std::vector<char> *b) {
  while (x >= 128) {
    uint64_t a = (x & 0xFF);
    uint64_t y = a | 0x80;
    b->push_back(static_cast<char>(y));
    x >>= 7;
  }
  b->push_back(static_cast<char>(x));
}

void encodeLength(int tag, int len, std::vector<char> *b) {
  encodeVarint(static_cast<uint64_t>(tag) << 3 | 2, b);
  encodeVarint(static_cast<uint64_t>(len), b);
}

template <typename T>
void encodeInteger(int tag, T x, std::vector<char> *b) {
  encodeVarint(static_cast<uint64_t>(tag) << 3, b);
  encodeVarint(x, b);
}

template <typename T>
void encodeIntegers(int tag, const std::vector<T> &x, std::vector<char> *b) {
  if (x.size() > 2) {
    // Use packed encoding:
    // https://developers.google.com/protocol-buffers/docs/encoding#packed
    int n1 = b->size();
    for (size_t i = 0; i < x.size(); i++) {
      encodeVarint(x[i], b);
    }
    int n2 = b->size();
    encodeLength(tag, n2 - n1, b);
    std::rotate(b->begin() + n1, b->begin() + n2, b->end());
    return;
  }
  for (size_t i = 0; i < x.size(); i++) {
    encodeInteger<T>(tag, x[i], b);
  }
}

template <typename T>
void encodeIntegerOpt(int tag, T x, std::vector<char> *b) {
  if (x == 0) {
    return;
  }
  encodeUint64(tag, x, b);
}

void encodeUint64(int tag, uint64_t x, std::vector<char> *b) {
  encodeInteger<uint64_t>(tag, x, b);
}

void encodeUint64s(int tag, const std::vector<uint64_t> &x,
                   std::vector<char> *b) {
  encodeIntegers<uint64_t>(tag, x, b);
}

void encodeUint64Opt(int tag, uint64_t x, std::vector<char> *b) {
  encodeIntegerOpt<uint64_t>(tag, x, b);
}

void encodeInt64(int tag, int64_t x, std::vector<char> *b) {
  encodeInteger<int64_t>(tag, x, b);
}

void encodeInt64s(int tag, const std::vector<int64_t> &x,
                  std::vector<char> *b) {
  encodeIntegers<int64_t>(tag, x, b);
}

void encodeInt64Opt(int tag, int64_t x, std::vector<char> *b) {
  encodeIntegerOpt<int64_t>(tag, x, b);
}

void encodeString(int tag, const std::string &x, std::vector<char> *b) {
  encodeLength(tag, x.length(), b);
  b->insert(b->end(), x.begin(), x.end());
}

void encodeStrings(int tag, const std::vector<std::string> &x,
                   std::vector<char> *b) {
  for (size_t i = 0; i < x.size(); i++) {
    encodeString(tag, x[i], b);
  }
}

void encodeBool(int tag, bool x, std::vector<char> *b) {
  encodeUint64(tag, x ? 1 : 0, b);
}

void encodeBoolOpt(int tag, bool x, std::vector<char> *b) {
  if (x) {
    encodeUint64(tag, 1, b);
  }
}

void encodeMessage(int tag, const ProtoField &m, std::vector<char> *b) {
  int n1 = b->size();
  m.encode(b);
  int n2 = b->size();
  encodeLength(tag, n2 - n1, b);
  std::rotate(b->begin() + n1, b->begin() + n2, b->end());
}
