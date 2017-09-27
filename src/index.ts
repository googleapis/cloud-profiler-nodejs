'use strict';

import {ProfileAgentConfig} from './config';

/**
 * Start the profiling agent
 * Currently unimplemented
 *
 * config - ProfileAgentConfig descripting configuration for profiling.
 *
 * @example
 * profiler.start();
 */
function start(config: ProfileAgentConfig) {
  throw new Error('start() is unimplemented');
}

module.exports = {
  start: start
};

// If the module was --require'd from the command line, start the agent.
if (module.parent && module.parent.id === 'internal/preload') {
  module.exports.start();
}

export default {};
