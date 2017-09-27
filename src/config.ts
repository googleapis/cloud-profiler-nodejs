import {AuthenticationConfig, ServiceConfig} from '../third_party/types/common-types';

// ProfileAgentConfig is the configuration for the profiler.
export interface ProfileAgentConfig extends AuthenticationConfig {
  // Log levels: 0-disabled,1-error,2-warn,3-info,4-debug.
  logLevel?: number;

  // Specifies the service contect with which profiles from this application
  // will be associated.
  serviceContext?: {
    // The service name.
    service?: string;

    // The service version.
    version?: string;

    // Unique deployment identifier.
    minorVersion?: string;
  };

  // Configuration for heap profiling.
  heapProfilerConfig?: HeapProfilerConfig;

  // Configuration for cpu profiling.
  cpuProfilerConfig?: CpuProfilerConfig;

  instance?: string;
  zone?: string;
}

// HeapProfilerConfig is the configuration for the heap profiler.
export interface HeapProfilerConfig {
  // When disable is true, heap profiling will be disabled.
  disable?: boolean;

  // The maximum number of stack frames to be captured on each allocation.
  stackDepth?: number;

  // Sampling interval for Heap profiler, specified in number of bytes.
  samplingInterval?: number;
}

// CpuProfilerConfig is the configuration for the cpu profiler.
export interface CpuProfilerConfig {
  // When disable is true, cpu profiling will be disabled.
  disable?: boolean;

  // Sampling interval for CPU profiler, specified in number of microseconds.
  samplingInterval?: number;
}

export const defaultHeapProfilerConfig: HeapProfilerConfig = {
  disable: false,
  stackDepth: 32,
  samplingInterval: 1024 * 1024
};

export const defaultCpuProfilerConfig: CpuProfilerConfig = {
  disable: false,
  samplingInterval: 1000,
};

export const defaultAgentConfig: ProfileAgentConfig = {
  projectId: undefined,

  keyFilename: undefined,

  email: undefined,

  credentials: {
    client_email: undefined,
    private_key: undefined,
  },

  serviceContext: { 
    service: 'default',
    version: '',
    minorVersion: '',
  },

  logLevel: 1,

  heapProfilerConfig: defaultHeapProfilerConfig,

  cpuProfilerConfig: defaultCpuProfilerConfig
};
