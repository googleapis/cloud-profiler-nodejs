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

/**
 * A simple protocol buffer encoder.
 * The format is described at
 * https://developers.google.com/protocol-buffers/docs/encoding
 *
 * A protocol message must extend the abstract class ProtoField, so must
 * implement void encode(std::vector<char> &b), which encodes its receiver into
 * the given buffer.
 *
 * This is modeled after
 * https://github.com/google/pprof/blob/master/profile/proto.go
 */

#ifndef BINDINGS_PROTO_H_
#define BINDINGS_PROTO_H_

#include <cstdint>
#include <string>
#include <vector>

// Abstract class describing a class which can be encoded to protocol buffer
// format.
class ProtoField {
 public:
  // Writes the ProtoField in serialized protobuf format to buffer b.
  virtual void encode(std::vector<char> *b) const = 0;
};

// Encodes an integer as a varint and writes this encoding to buffer b.
// The format for a varint is described at
// https://developers.google.com/protocol-buffers/docs/encoding#varints
void encodeVarint(uint64_t x, std::vector<char> *b);

// Encodes length of a field associated with particular tag number and writes
// this encoding to buffer b.
void encodeLength(int tag, int len, std::vector<char> *b);

template <typename T>
void encodeIntegers(int tag, const std::vector<T> &x, std::vector<char> *b);
template <typename T>
void encodeInteger(int tag, T x, std::vector<char> *b);
template <typename T>
void encodeIntegerOpt(int tag, T x, std::vector<char> *b);

// Encodes an unsigned integer associated with the specified tag number,
// and writes this encoding to buffer b.
void encodeUint64(int tag, uint64_t x, std::vector<char> *b);

// Encodes an array of unsigned integers associated with the specified tag
// number, and writes this encoding to buffer b.
void encodeUint64s(int tag, const std::vector<uint64_t> &x,
                   std::vector<char> *b);

// Encodes an unsigned integer associated with the specified tag number,
// and writes this encoding to buffer b. If the unsign integer's value is 0,
// nothing will be written to buffer b.
void encodeUint64Opt(int tag, uint64_t x, std::vector<char> *b);

// Encodes an integer associated with the specified tag number, and writes this
// encoding to buffer b.
void encodeInt64(int tag, int64_t x, std::vector<char> *b);

// Encodes an array of integers associated with the specified tag number, and
// writes this encoding to buffer b.
void encodeInt64s(int tag, const std::vector<int64_t> &x, std::vector<char> *b);

// Encodes an integer associated with the specified tag number, and writes this
// encoding to buffer b. If the integer's value is 0, nothing will be written
// to buffer b.
void encodeInt64Opt(int tag, int64_t x, std::vector<char> *b);

// Encodes a string associated with the specified tag number, and writes this
// encoding to buffer b.
void encodeString(int tag, const std::string &x, std::vector<char> *b);

// Encodes a string array associated with the specified tag number, and writes
// this encoding to buffer b.
void encodeStrings(int tag, const std::vector<std::string> &x,
                   std::vector<char> *b);

// Encodes a boolean associated with the specified tag number, and writes this
// encoding to buffetemplate <typename T> void encodeIntegers<T>(int tag, const
// std::vector<T> &x, std::vector<char> *b)r b.
void encodeBool(int tag, bool x, std::vector<char> *b);

// Encodes a boolean associated with the specified tag number, and writes this
// encoding to buffer b if the boolean is true.
void encodeBoolOpt(int tag, bool x, std::vector<char> *b);

// Encodes a ProtoField as a message, writing this encoding to buffer b.
void encodeMessage(int tag, const ProtoField &m, std::vector<char> *b);

// Encodes a vector of ProtoFields as a message, writing this encoding to buffer
// b.
template <typename T>
void encodeRepeatedMessage(int tag, const std::vector<T> elems,
                           std::vector<char> *b) {
  for (size_t i = 0; i < elems.size(); i++) {
    encodeMessage(tag, elems[i], b);
  }
}

#endif
