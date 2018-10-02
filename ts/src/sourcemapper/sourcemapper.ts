/**
 * Copyright 2016 Google Inc. All Rights Reserved.
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

import * as fs from 'fs';
import * as path from 'path';
import * as sourceMap from 'source-map';
import * as util from 'util';

import * as scanner from '../../third_party/cloud-debug-nodejs/scanner';

const pify = require('pify');
const pLimit = require('p-limit');
const readFile = pify(fs.readFile);

const CONCURRENCY = 10;
const MAP_EXT = '.map';

export interface MapInfoCompiled {
  mapFile: string;
  mapConsumer: sourceMap.RawSourceMap;
}

export interface GeneratedLocation {
  file: string;
  name?: string;
  line: number;
  column: number;
}

export interface SourceLocation {
  file?: string;
  name?: string;
  line?: number;
  column?: number;
}

/**
 * @param {!Map} infoMap The map that maps input source files to
 *  SourceMapConsumer objects that are used to calculate mapping information
 * @param {string} mapPath The path to the sourcemap file to process.  The
 *  path should be relative to the process's current working directory
 * @private
 */
async function processSourcemap(
    infoMap: Map<string, MapInfoCompiled>, mapPath: string) {
  // this handles the case when the path is undefined, null, or
  // the empty string
  if (!mapPath || !mapPath.endsWith(MAP_EXT)) {
    throw new Error(`The path ${mapPath} does not specify a sourcemap file`);
  }
  mapPath = path.normalize(mapPath);

  let contents;
  try {
    contents = await readFile(mapPath, 'utf8');
  } catch (e) {
    throw new Error('Could not read sourcemap file ' + mapPath + ': ' + e);
  }

  let consumer: sourceMap.RawSourceMap;
  try {
    // TODO: Determine how to reconsile the type conflict where `consumer`
    //       is constructed as a SourceMapConsumer but is used as a
    //       RawSourceMap.
    // TODO: Resolve the cast of `contents as any` (This is needed because the
    //       type is expected to be of `RawSourceMap` but the existing
    //       working code uses a string.)
    consumer = new sourceMap.SourceMapConsumer(
                   contents as {} as sourceMap.RawSourceMap) as {} as
        sourceMap.RawSourceMap;
  } catch (e) {
    throw new Error(
        'An error occurred while reading the ' +
        'sourcemap file ' + mapPath + ': ' + e);
  }

  /*
   * If the sourcemap file defines a "file" attribute, use it as
   * the output file where the path is relative to the directory
   * containing the map file.  Otherwise, use the name of the output
   * file (with the .map extension removed) as the output file.
   */
  const outputBase =
      consumer.file ? consumer.file : path.basename(mapPath, MAP_EXT);
  const parentDir = path.dirname(mapPath);
  const outputPath = path.normalize(path.join(parentDir, outputBase));

  infoMap.set(outputPath, {mapFile: mapPath, mapConsumer: consumer});
}

export class SourceMapper {
  infoMap: Map<string, MapInfoCompiled>;

  /**
   * @param {Array.<string>} sourcemapPaths An array of paths to .map sourcemap
   *  files that should be processed.  The paths should be relative to the
   *  current process's current working directory
   * @param {Logger} logger A logger that reports errors that occurred while
   *  processing the given sourcemap files
   * @constructor
   */
  constructor() {
    this.infoMap = new Map();
  }

  /**
   * Used to get the information about the transpiled file from a given input
   * source file provided there isn't any ambiguity with associating the input
   * path to exactly one output transpiled file.
   *
   * @param inputPath The (possibly relative) path to the original source file.
   * @return The `MapInfoCompiled` object that describes the transpiled file
   *  associated with the specified input path.  `null` is returned if either
   *  zero files are associated with the input path or if more than one file
   *  could possibly be associated with the given input path.
   */
  private getMappingInfo(inputPath: string): MapInfoCompiled|null {
    if (this.infoMap.has(path.normalize(inputPath))) {
      return this.infoMap.get(inputPath) as MapInfoCompiled;
    }

    return null;
  }

  /**
   * Used to determine if the source file specified by the given path has
   * a .map file and an output file associated with it.
   *
   * If there is no such mapping, it could be because the input file is not
   * the input to a transpilation process or it is the input to a transpilation
   * process but its corresponding .map file was not given to the constructor
   * of this mapper.
   *
   * @param {string} inputPath The path to an input file that could
   *  possibly be the input to a transpilation process.  The path should be
   *  relative to the process's current working directory.
   */
  hasMappingInfo(inputPath: string): boolean {
    return this.getMappingInfo(inputPath) !== null;
  }

  /**
   * @param {string} inputPath The path to an input file that could possibly
   *  be the input to a transpilation process.  The path should be relative to
   *  the process's current working directory
   * @param {number} The line number in the input file where the line number is
   *   zero-based.
   * @param {number} (Optional) The column number in the line of the file
   *   specified where the column number is zero-based.
   * @return {Object} The object returned has a "file" attribute for the
   *   path of the output file associated with the given input file (where the
   *   path is relative to the process's current working directory),
   *   a "line" attribute of the line number in the output file associated with
   *   the given line number for the input file, and an optional "column" number
   *   of the column number of the output file associated with the given file
   *   and line information.
   *
   *   If the given input file does not have mapping information associated
   *   with it then the input location is returned.
   */
  mappingInfo(location: GeneratedLocation): SourceLocation {
    const inputPath = path.normalize(location.file);
    const entry = this.getMappingInfo(inputPath);
    if (entry === null) {
      return location;
    }

    const generatedPos = {line: location.line, column: location.column};

    // TODO: Determine how to remove the explicit cast here.
    const consumer: sourceMap.SourceMapConsumer =
        entry.mapConsumer as {} as sourceMap.SourceMapConsumer;

    const pos = consumer.originalPositionFor(generatedPos);
    if (pos.source === null) {
      return location;
    }
    return {
      file: pos.source,
      line: pos.line || undefined,
      name: pos.name || location.name,
      // TODO: The `sourceMap.Position` type definition has a `column`
      //       attribute and not a `col` attribute.  Determine if the type
      //       definition or this code is correct.
      column: (pos as {} as {col: number}).col
    };
  }
}

export async function create(sourcemapPaths: string[]): Promise<SourceMapper> {
  const limit = pLimit(CONCURRENCY);
  const mapper = new SourceMapper();
  const promises = sourcemapPaths.map(
      path => limit(() => processSourcemap(mapper.infoMap, path)));
  try {
    await Promise.all(promises);
  } catch (err) {
    throw new Error(
        'An error occurred while processing the sourcemap files' + err);
  }
  return mapper;
}

export async function getMapFiles(shouldHash: boolean, baseDir: string) {
  const fileStats = await scanner.scan(false, baseDir, /.js.map$/);
  const mapFiles = fileStats.selectFiles(/.js.map$/, process.cwd());
  return mapFiles;
}
