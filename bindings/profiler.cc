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

#include <memory>
#include "nan.h"
#include "v8-profiler.h"

using namespace v8;

// Sampling Heap Profiler

Local<Value> TranslateAllocationProfile(AllocationProfile::Node* node) {
  Local<Object> js_node = Nan::New<Object>();
  js_node->Set(Nan::New<String>("name").ToLocalChecked(), node->name);
  js_node->Set(Nan::New<String>("scriptName").ToLocalChecked(),
               node->script_name);
  js_node->Set(Nan::New<String>("scriptId").ToLocalChecked(),
               Nan::New<Integer>(node->script_id));
  js_node->Set(Nan::New<String>("lineNumber").ToLocalChecked(),
               Nan::New<Integer>(node->line_number));
  js_node->Set(Nan::New<String>("columnNumber").ToLocalChecked(),
               Nan::New<Integer>(node->column_number));
  Local<Array> children = Nan::New<Array>(node->children.size());
  for (size_t i = 0; i < node->children.size(); i++) {
    children->Set(i, TranslateAllocationProfile(node->children[i]));
  }
  js_node->Set(Nan::New<String>("children").ToLocalChecked(), children);
  Local<Array> allocations = Nan::New<Array>(node->allocations.size());
  for (size_t i = 0; i < node->allocations.size(); i++) {
    AllocationProfile::Allocation alloc = node->allocations[i];
    Local<Object> js_alloc = Nan::New<Object>();
    js_alloc->Set(Nan::New<String>("sizeBytes").ToLocalChecked(),
                  Nan::New<Number>(alloc.size));
    js_alloc->Set(Nan::New<String>("count").ToLocalChecked(),
                  Nan::New<Number>(alloc.count));
    allocations->Set(i, js_alloc);
  }
  js_node->Set(Nan::New<String>("allocations").ToLocalChecked(), allocations);
  return js_node;
}

// startSampingHeapProfiler(samplingInterval: number, stackDepth: number)
NAN_METHOD(StartSamplingHeapProfiler) {
  if (info.Length() == 2) {
    if (!info[0]->IsUint32()) {
      return Nan::ThrowTypeError("First argument type must be uint32.");
    }
    if (!info[1]->IsNumber()) {
      return Nan::ThrowTypeError("First argument type must be Integer.");
    }

#if NODE_MODULE_VERSION > NODE_8_0_MODULE_VERSION
    uint64_t sample_interval = info[0].As<Integer>()->Value();
    int stack_depth = info[1].As<Integer>()->Value();
#else
    uint64_t sample_interval = info[0].As<Integer>()->Uint32Value();
    int stack_depth = info[1].As<Integer>()->IntegerValue();
#endif

    info.GetIsolate()->GetHeapProfiler()->StartSamplingHeapProfiler(
        sample_interval, stack_depth);
  } else {
    info.GetIsolate()->GetHeapProfiler()->StartSamplingHeapProfiler();
  }
}

// stopSampingHeapProfiler()
NAN_METHOD(StopSamplingHeapProfiler) {
  info.GetIsolate()->GetHeapProfiler()->StopSamplingHeapProfiler();
}

// getAllocationProfile(): AllocationProfileNode
NAN_METHOD(GetAllocationProfile) {
  std::unique_ptr<v8::AllocationProfile> profile(
      info.GetIsolate()->GetHeapProfiler()->GetAllocationProfile());
  AllocationProfile::Node* root = profile->GetRootNode();
  info.GetReturnValue().Set(TranslateAllocationProfile(root));
}

// Time profiler

#if NODE_MODULE_VERSION > NODE_8_0_MODULE_VERSION
// This profiler exists for the lifetime of the program. Not calling
// CpuProfiler::Dispose() is intentional.
CpuProfiler* cpuProfiler = CpuProfiler::New(v8::Isolate::GetCurrent());
#else
CpuProfiler* cpuProfiler = v8::Isolate::GetCurrent()->GetCpuProfiler();
#endif

Local<Value> TranslateTimeProfileNode(const CpuProfileNode* node,
                                      bool hasDetailedLines) {
  Local<Object> js_node = Nan::New<Object>();
  js_node->Set(Nan::New<String>("name").ToLocalChecked(),
               node->GetFunctionName());
  js_node->Set(Nan::New<String>("scriptName").ToLocalChecked(),
               node->GetScriptResourceName());
  js_node->Set(Nan::New<String>("scriptId").ToLocalChecked(),
               Nan::New<Integer>(node->GetScriptId()));
  js_node->Set(Nan::New<String>("lineNumber").ToLocalChecked(),
               Nan::New<Integer>(node->GetLineNumber()));
  js_node->Set(Nan::New<String>("columnNumber").ToLocalChecked(),
               Nan::New<Integer>(node->GetColumnNumber()));
  js_node->Set(Nan::New<String>("hitCount").ToLocalChecked(),
               Nan::New<Integer>(node->GetHitCount()));
  int32_t count = node->GetChildrenCount();

  unsigned int index = 0;
  Local<Array> children;

  // Add nodes corresponding to lines within the node's function.
  unsigned int hitLineCount = node->GetHitLineCount();
  std::vector<CpuProfileNode::LineTick> entries(hitLineCount);
  if (hasDetailedLines && node->GetLineTicks(&entries[0], hitLineCount)) {
    children = Nan::New<Array>(count + entries.size());
    js_node->Set(Nan::New<String>("hitCount").ToLocalChecked(),
                 Nan::New<Integer>(0));
    for (const CpuProfileNode::LineTick entry : entries) {
      Local<Object> js_node_hit = Nan::New<Object>();
      js_node_hit->Set(Nan::New<String>("name").ToLocalChecked(),
                       Nan::New<String>("").ToLocalChecked());
      js_node_hit->Set(Nan::New<String>("scriptName").ToLocalChecked(),
                       node->GetScriptResourceName());
      js_node_hit->Set(Nan::New<String>("scriptId").ToLocalChecked(),
                       Nan::New<Integer>(node->GetScriptId()));
      js_node_hit->Set(Nan::New<String>("lineNumber").ToLocalChecked(),
                       Nan::New<Integer>(entry.line));
      js_node_hit->Set(Nan::New<String>("columnNumber").ToLocalChecked(),
                       Nan::New<Integer>(0));
      js_node_hit->Set(Nan::New<String>("hitCount").ToLocalChecked(),
                       Nan::New<Integer>(entry.hit_count));
      js_node_hit->Set(Nan::New<String>("children").ToLocalChecked(),
                       Nan::New<Array>(0));
      children->Set(index++, js_node_hit);
    }
  } else {
    children = Nan::New<Array>(count);
  }

  // Add nodes corresponding to functions called by the node's function.
  for (int32_t i = 0; i < count; i++) {
    children->Set(index++,
                  TranslateTimeProfileNode(node->GetChild(i), hasDetailedLines));
  }

  js_node->Set(Nan::New<String>("children").ToLocalChecked(), children);
  return js_node;
}

Local<Value> TranslateTimeProfile(const CpuProfile* profile, bool hasDetailedLines) {
  Local<Object> js_profile = Nan::New<Object>();
  js_profile->Set(Nan::New<String>("title").ToLocalChecked(),
                  profile->GetTitle());
  js_profile->Set(
      Nan::New<String>("topDownRoot").ToLocalChecked(),
      TranslateTimeProfileNode(profile->GetTopDownRoot(), hasDetailedLines));
  js_profile->Set(Nan::New<String>("startTime").ToLocalChecked(),
                  Nan::New<Number>(profile->GetStartTime()));
  js_profile->Set(Nan::New<String>("endTime").ToLocalChecked(),
                  Nan::New<Number>(profile->GetEndTime()));
  return js_profile;
}

// startProfiling(runName: string, includeLineInfo?: boolean)
NAN_METHOD(StartProfiling) {
  if (info.Length() != 2) {
    return Nan::ThrowTypeError("StartProfling must have two arguments.");
  }
  if (!info[0]->IsString()) {
    return Nan::ThrowTypeError("First argument type must be a string.");
  }
  if (!info[1]->IsBoolean()) {
    return Nan::ThrowTypeError("First argument type must be a boolean.");
  }

  Local<String> name =
      Nan::MaybeLocal<String>(info[0].As<String>()).ToLocalChecked();
  bool includeLineInfo =
      Nan::MaybeLocal<Boolean>(info[1].As<Boolean>()).ToLocalChecked()->Value();

// Sample counts and timestamps are not used, so we do not need to record
// samples.
#if NODE_MODULE_VERSION > NODE_10_0_MODULE_VERSION
  if (includeLineInfo) {
    cpuProfiler->StartProfiling(name, CpuProfilingMode::kCallerLineNumbers,
                                false);
  } else {
    cpuProfiler->StartProfiling(name, false);
  }
#else
  cpuProfiler->StartProfiling(name, false);
#endif
}

// stopProfiling(runName: string, includedLineInfo?: boolean): TimeProfile
NAN_METHOD(StopProfiling) {
  if (info.Length() != 2) {
    return Nan::ThrowTypeError("StopProfling must have two arguments.");
  }
  if (!info[0]->IsString()) {
    return Nan::ThrowTypeError("First argument type must be a string.");
  }
  if (!info[1]->IsBoolean()) {
    return Nan::ThrowTypeError("First argument type must be a boolean.");
  }
  Local<String> name =
      Nan::MaybeLocal<String>(info[0].As<String>()).ToLocalChecked();
  bool includedLineInfo =
      Nan::MaybeLocal<Boolean>(info[1].As<Boolean>()).ToLocalChecked()->Value();

  CpuProfile* profile = cpuProfiler->StopProfiling(name);
  Local<Value> translated_profile =
      TranslateTimeProfile(profile, includedLineInfo);
  profile->Delete();
  info.GetReturnValue().Set(translated_profile);
}

// setSamplingInterval(intervalMicros: number)
NAN_METHOD(SetSamplingInterval) {
#if NODE_MODULE_VERSION > NODE_8_0_MODULE_VERSION
  int us = info[0].As<Integer>()->Value();
#else
  int us = info[0].As<Integer>()->IntegerValue();
#endif
  cpuProfiler->SetSamplingInterval(us);
}

NAN_MODULE_INIT(InitAll) {
  Local<Object> timeProfiler = Nan::New<Object>();
  Nan::Set(timeProfiler, Nan::New("startProfiling").ToLocalChecked(),
           Nan::GetFunction(Nan::New<FunctionTemplate>(StartProfiling))
               .ToLocalChecked());
  Nan::Set(timeProfiler, Nan::New("stopProfiling").ToLocalChecked(),
           Nan::GetFunction(Nan::New<FunctionTemplate>(StopProfiling))
               .ToLocalChecked());
  Nan::Set(timeProfiler, Nan::New("setSamplingInterval").ToLocalChecked(),
           Nan::GetFunction(Nan::New<FunctionTemplate>(SetSamplingInterval))
               .ToLocalChecked());
  target->Set(Nan::New<String>("timeProfiler").ToLocalChecked(), timeProfiler);

  Local<Object> heapProfiler = Nan::New<Object>();
  Nan::Set(
      heapProfiler, Nan::New("startSamplingHeapProfiler").ToLocalChecked(),
      Nan::GetFunction(Nan::New<FunctionTemplate>(StartSamplingHeapProfiler))
          .ToLocalChecked());
  Nan::Set(
      heapProfiler, Nan::New("stopSamplingHeapProfiler").ToLocalChecked(),
      Nan::GetFunction(Nan::New<FunctionTemplate>(StopSamplingHeapProfiler))
          .ToLocalChecked());
  Nan::Set(heapProfiler, Nan::New("getAllocationProfile").ToLocalChecked(),
           Nan::GetFunction(Nan::New<FunctionTemplate>(GetAllocationProfile))
               .ToLocalChecked());
  target->Set(Nan::New<String>("heapProfiler").ToLocalChecked(), heapProfiler);
}

NODE_MODULE(google_cloud_profiler, InitAll);
