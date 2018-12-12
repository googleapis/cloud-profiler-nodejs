#!/bin/bash
# Copyright 2018 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Fail on any error.
set -e pipefail

# Display commands
set -x

case $KOKORO_JOB_TYPE in
  CONTINUOUS_GITHUB)
    BUILD_TYPE=continuous
    ;;
  PRESUBMIT_GITHUB)
    BUILD_TYPE=presubmit
    ;;
  RELEASE)
    BUILD_TYPE=release
    ;;
  *)
    echo "Unknown build type: ${KOKORO_JOB_TYPE}"
    exit 1
    ;;
esac

cd $(dirname $0)/..
base_dir=$(pwd)

export GCS_LOCATION="cloud-profiler-nodejs-artifacts/nodejs/kokoro/${BUILD_TYPE}/${KOKORO_BUILD_NUMBER}"
INTEGRATION_TEST="${base_dir}/testing/integration_test.sh"
chmod 755 "${INTEGRATION_TEST}"
sh "${INTEGRATION_TEST}"

