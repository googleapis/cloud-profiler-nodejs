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

#ifndef BINDINGS_SERIALIZE_V8_H_
#define BINDINGS_SERIALIZE_V8_H_
#include <cstdint>
#include <memory>
#include "v8-profiler.h"

// Returns a buffer with the input v8::AllocationProfile profile in
// the profile.proto format.
std::unique_ptr<std::vector<char>> serializeHeapProfile(
    std::unique_ptr<v8::AllocationProfile> profile, int64_t intervalBytes,
    int64_t startTimeNanos);

// Returns a buffer with the input v8::CpuProfile profile in the profile.proto
// format.
std::unique_ptr<std::vector<char>> serializeTimeProfile(
    v8::CpuProfile *profile, int64_t samplingIntervalMicros,
    int64_t startTimeNanos);

#endif
