'use strict'

import { Config } from './config'

/**
* Start the profiling agent
* Currently unimplemented
*
* @param {object=} config - Profiler configuration
*
* @example
* profiler.start();
*/
function start(projectConfig: Config) {
  console.log("UNIMPLEMENTED");
}

module.exports = {
  start: start 
};

// If the module was --require'd from the command line, start the agent
if (module.parent && module.parent.id === 'internal/preload') {
  module.exports.start();
}

export default {};
