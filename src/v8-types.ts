
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
