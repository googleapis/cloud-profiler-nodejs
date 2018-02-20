const startTime = Date.now();

function benchmark(durationSeconds) {
  var buffer = new Buffer(1e4);
  for (var k = 0; k < 1e4; k++) {
    buffer.fill(0);
  }
  if (Date.now() - startTime < 1000 * durationSeconds) {
    setImmediate(() => benchmark(durationSeconds));
  }
}

const durationSeconds = process.argv.length > 2 ? process.argv[2] : 600; 
benchmark(durationSeconds);
