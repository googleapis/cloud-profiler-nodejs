{
  "targets" : [
    {
      "target_name" : "time_profiler",
      "sources" : [
        "bindings/time-profiler.cc", "bindings/serialize.cc",
        "bindings/proto.cc", "bindings/proto.h", "bindings/serialize.h",
        "bindings/serialize-v8.cc", "bindings/serialize-v8.cc"
      ],
      "include_dirs" : ["<!(node -e \"require('nan')\")"]
    },
    {
      "target_name" : "sampling_heap_profiler",
      "sources" : [
        "bindings/sampling-heap-profiler.cc", "bindings/serialize.cc",
        "bindings/proto.cc", "bindings/proto.h", "bindings/serialize.h",
        "bindings/serialize-v8.cc", "bindings/serialize-v8.cc"
      ],
      "include_dirs" : ["<!(node -e \"require('nan')\")"]
    },
    {
      "target_name" : "statistics",
      "sources" : ["bindings/statistics.cc"],
      "include_dirs" : ["<!(node -e \"require('nan')\")"]
    },
  ]
}
