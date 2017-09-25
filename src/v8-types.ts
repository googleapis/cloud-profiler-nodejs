
export interface CpuProfile {
  /** Time in nanoseconds at which profile was stopped. */
  endTime: number;
  topDownRoot: CpuProfileNode;
  /** Time in nanoseconds at which profile was started. */
  startTime: number;
}

export interface CpuProfileNode {
  callUid: number;
  scriptResourceName?: string;
  functionName?: string;
  lineNumber: number;
  hitCount: number;
  children: Array<CpuProfileNode>;
}

export interface AllocationProfileNode {
  name: string;
  scriptName: string;
  line: number;
  allocations: Array<Allocation>;
  children: Array<AllocationProfileNode>;
}

export interface Allocation {
  count: number;
  size: number;
}
