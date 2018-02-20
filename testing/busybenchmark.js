let durationSeconds = 600;
const startTime = Date.now();

function benchmark() {
  var buffer = new Buffer(10000);
  for (var k = 0; k < 1e4; k++) {
    buffer.fill(0);
  }
  if (Date.now() - startTime < 1000 * durationSeconds) {
    setImmediate(benchmark);
  }
}

if (process.argv.length > 2) {
  durationSeconds = process.argv[2];
}

benchmark();
