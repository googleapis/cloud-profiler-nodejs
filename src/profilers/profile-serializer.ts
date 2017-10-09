import {perftools} from '../profile';
import {getIndexOrAdd} from '../util';
import {CpuProfile, CpuProfileNode} from '../v8-types';
// A stack of function UIDs.
type Stack = Array<number>;

// Helper class used to convert v8 profile into profile format used by
// Stackdriver Profiler.
class ProfileSerializer {
  private samples: Array<perftools.profiles.Sample>;
  private locations: Array<perftools.profiles.Location>;
  private functions: Array<perftools.profiles.Function>;
  private locationMap: Map<number, perftools.profiles.Location>;
  private functionMap: Map<number, perftools.profiles.Function>;
  private strings: string[];
  private samplingInterval: number;  // microseconds, defaults to 1000us

  constructor() {
    this.reset();
  }

  // Converts profile returned by v8 CPU profiler to profile with format used by
  // Stackdriver Profilers.
  serializeCpuProfile(prof: CpuProfile, sampleInterval: number):
      perftools.profiles.IProfile {
    this.reset();
    this.samplingInterval = sampleInterval;

    let sampleValueType = this.sampleValueType();
    let timeValueType = this.timeValueType();

    this.serializeNode(prof.topDownRoot, []);

    return {
      sampleType: [sampleValueType, timeValueType],
      sample: this.samples,
      location: this.locations,
      function: this.functions,
      stringTable: this.strings,
      // opt drop_frames
      // opt keep_frames
      timeNanos: 1000 * 1000 * prof.endTime,                         // Nanos
      durationNanos: 1000 * 1000 * (prof.endTime - prof.startTime),  // Nanos

      periodType: timeValueType,
      period: this.samplingInterval
    };
  }

  // clears fields used to build a profile.
  private reset() {
    this.samples = [];
    this.locations = [];
    this.functions = [];
    this.locationMap = new Map();
    this.functionMap = new Map<number, perftools.profiles.Function>();
    this.strings = [''];
    this.samplingInterval = 1000;
  }

  /* Adds samples from a node and it's children to the fields tracking
   * profile serialization.
   *
   * node - the node which is serialized
   * stack - the stack trace to the current node.
   */
  private serializeNode(node: CpuProfileNode, stack: Stack) {
    let that = this;
    let location = that.getLocation(node);
    // TODO: deal with location.id being a Long.
    stack.unshift(location.id as number);  // leaf is first in the stack
    if (node.hitCount > 0) {
      const sample = new perftools.profiles.Sample({
        locationId: stack.slice(0),
        value: [node.hitCount, node.hitCount * that.samplingInterval]
      });
      that.samples.push(sample);
    }
    node.children.forEach(function(child) {
      that.serializeNode(child, stack);
    });
    stack.shift();  // remove leaf from stack
  }

  private getLocation(node: CpuProfileNode): perftools.profiles.Location {
    const id = node.callUid;
    if (this.locationMap.has(id)) {
      return this.locationMap.get(id) as perftools.profiles.Location;
    }
    const location =
        new perftools.profiles.Location({id: id, line: [this.getLine(node)]});
    this.locations.push(location);
    this.locationMap.set(id, location);
    return location;
  }

  private getLine(node: CpuProfileNode): perftools.profiles.Line {
    return new perftools.profiles.Line(
        {functionId: this.getFunction(node).id, line: node.lineNumber});
  }

  private getFunction(node: CpuProfileNode): perftools.profiles.Function {
    const id = node.callUid;
    if (this.functionMap.has(id)) {
      // Map.get returns possibly undefined, but we know it is defined.
      // TODO: figure out how to avoid the cast.
      return this.functionMap.get(id) as perftools.profiles.Function;
    }
    const name =
        getIndexOrAdd(node.functionName || '(anonymous)', this.strings);
    const f = new perftools.profiles.Function({
      id: id,
      name: name,
      systemName: name,
      filename:
          getIndexOrAdd(node.scriptResourceName || '(unknown)', this.strings)
      // start_line
    });
    this.functions.push(f);
    this.functionMap.set(id, f);
    return f;
  }

  private sampleValueType(): perftools.profiles.ValueType {
    return new perftools.profiles.ValueType({
      type: getIndexOrAdd('samples', this.strings),
      unit: getIndexOrAdd('count', this.strings)
    });
  }

  private timeValueType(): perftools.profiles.ValueType {
    return new perftools.profiles.ValueType({
      type: getIndexOrAdd('time', this.strings),
      unit: getIndexOrAdd('microseconds', this.strings)
    });
  }
}

// Converts v8 Profile into profile with profile format used by Stackdriver
// Profiler.
export function serializeCpuProfile(prof: CpuProfile, sampleInterval: number) {
  let serializer = new ProfileSerializer();
  return serializer.serializeCpuProfile(prof, sampleInterval);
}
