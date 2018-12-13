#!/bin/bash

# Fail on any error.
set -eo pipefail

# Display commands being run.
set -x

INTEGRATION_TEST=$(dirname $0)/integration_test.sh
chmod 755 "${INTEGRATION_TEST}"
sh "${INTEGRATION_TEST}"
