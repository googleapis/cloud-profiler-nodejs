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

// This is modeled after
// https://github.com/google/pprof/blob/master/profile/proto.go

#include "proto.h"
#include <algorithm>

void encodeVarint(uint64_t x, std::vector<char>* buffer) {
  while (x >= 128) {
    uint64_t a = (x & 0xFF);
    uint64_t y = a | 0x80;
    buffer->push_back(static_cast<char>(y));
    x >>= 7;
  }
  buffer->push_back(static_cast<char>(x));
}

void encodeLength(int tag, int len, std::vector<char>* buffer) {
  encodeVarint(static_cast<uint64_t>(tag) << 3 | 2, buffer);
  encodeVarint(static_cast<uint64_t>(len), buffer);
}

template <typename T>
void encodeInteger(int tag, T x, std::vector<char>* buffer) {
  encodeVarint(static_cast<uint64_t>(tag) << 3, buffer);
  encodeVarint(x, buffer);
}

template <typename T>
void encodeIntegers(int tag, const std::vector<T>& x,
                    std::vector<char>* buffer) {
  if (x.size() > 2) {
    // Use packed encoding:
    // https://developers.google.com/protocol-buffers/docs/encoding#packed
    int n1 = buffer->size();
    for (size_t i = 0; i < x.size(); i++) {
      encodeVarint(x[i], buffer);
    }
    int n2 = buffer->size();
    encodeLength(tag, n2 - n1, buffer);
    std::rotate(buffer->begin() + n1, buffer->begin() + n2, buffer->end());
    return;
  }
  for (size_t i = 0; i < x.size(); i++) {
    encodeInteger<T>(tag, x[i], buffer);
  }
}

template <typename T>
void encodeIntegerOpt(int tag, T x, std::vector<char>* buffer) {
  if (x == 0) {
    return;
  }
  encodeInteger<T>(tag, x, buffer);
}

void encodeUint64(int tag, uint64_t x, std::vector<char>* buffer) {
  encodeInteger<uint64_t>(tag, x, buffer);
}

void encodeUint64s(int tag, const std::vector<uint64_t>& x,
                   std::vector<char>* buffer) {
  encodeIntegers<uint64_t>(tag, x, buffer);
}

void encodeUint64Opt(int tag, uint64_t x, std::vector<char>* buffer) {
  encodeIntegerOpt<uint64_t>(tag, x, buffer);
}

void encodeInt64(int tag, int64_t x, std::vector<char>* buffer) {
  encodeInteger<int64_t>(tag, x, buffer);
}

void encodeInt64s(int tag, const std::vector<int64_t>& x,
                  std::vector<char>* buffer) {
  encodeIntegers<int64_t>(tag, x, buffer);
}

void encodeInt64Opt(int tag, int64_t x, std::vector<char>* buffer) {
  encodeIntegerOpt<int64_t>(tag, x, buffer);
}

void encodeString(int tag, const std::string& x, std::vector<char>* buffer) {
  encodeLength(tag, x.length(), buffer);
  buffer->insert(buffer->end(), x.begin(), x.end());
}

void encodeStrings(int tag, const std::vector<std::string>& x,
                   std::vector<char>* buffer) {
  for (size_t i = 0; i < x.size(); i++) {
    encodeString(tag, x[i], buffer);
  }
}

void encodeBool(int tag, bool x, std::vector<char>* buffer) {
  encodeUint64(tag, x ? 1 : 0, buffer);
}

void encodeBoolOpt(int tag, bool x, std::vector<char>* buffer) {
  if (x) {
    encodeUint64(tag, 1, buffer);
  }
}

void encodeMessage(int tag, const ProtoField& m, std::vector<char>* buffer) {
  int n1 = buffer->size();
  m.encode(buffer);
  int n2 = buffer->size();
  encodeLength(tag, n2 - n1, buffer);
  std::rotate(buffer->begin() + n1, buffer->begin() + n2, buffer->end());
}
