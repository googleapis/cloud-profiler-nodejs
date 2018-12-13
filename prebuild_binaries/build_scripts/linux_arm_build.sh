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

set -ex

[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 10
nvm use 10

arch_list=( ia32 x64 )
node_versions=( 6.0.0 8.0.0 10.0.0 11.0.0 )

cd $(dirname $0)
cd $(dirname $0)/../..
base_dir=$(pwd)

export ARTIFACTS_OUT=$base_dir/artifacts
mkdir -p "${ARTIFACTS_OUT}"

npm install

for version in ${node_versions[@]}
do
  # Cross compile for ARM on x64
  # Requires debian or ubuntu packages "g++-aarch64-linux-gnu" and "g++-arm-linux-gnueabihf".
  CC=arm-linux-gnueabihf-gcc CXX=arm-linux-gnueabihf-g++ \
    LD=arm-linux-gnueabihf-g++ ./node_modules/.bin/node-pre-gyp \
    configure rebuild package testpackage --target=$version --target_arch=arm \
    >/dev/null
  cp -r build/stage/* "${ARTIFACTS_OUT}"/

  CC=aarch64-linux-gnu-gcc CXX=aarch64-linux-gnu-g++ LD=aarch64-linux-gnu-g++ \
    ./node_modules/.bin/node-pre-gyp configure rebuild package testpackage \
    --target=$version --target_arch=arm64 >/dev/null
  cp -r build/stage/* "${ARTIFACTS_OUT}"/
done


rm -rf build || true
