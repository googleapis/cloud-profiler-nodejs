// Copyright 2018 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// +build integration,go1.7

package proftest

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"testing"
	"text/template"
	"time"

	"cloud.google.com/go/storage"
	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	container "google.golang.org/api/container/v1"
)

var (
	repo                = flag.String("repo", "https://github.com/googleapis/cloud-profiler-nodejs.git", "git repo to test")
	branch              = flag.String("branch", "", "git branch to test")
	commit              = flag.String("commit", "", "git commit to test")
	pr                  = flag.Int("pr", 0, "git pull request to test")
	runOnlyV8CanaryTest = flag.Bool("run_only_v8_canary_test", false, "if true test will be run only with the v8-canary build, otherwise, no tests will be run with v8 canary")
	binaryHost          = flag.String("binary_host", "", "host from which to download precompiled binaries; if no value is specified, binaries will be built from source.")

	runID             = strings.Replace(time.Now().Format("2006-01-02-15-04-05-0700"), ".", "-", -1)
	benchFinishString = "busybench finished profiling"
	errorString       = "failed to set up or run the benchmark"
)

const cloudScope = "https://www.googleapis.com/auth/cloud-platform"

const dockerfileTemplate = `FROM node:{{.NodeVersion}}-alpine
RUN apt-get update
RUN apt-get install git
RUN git clone {{.Repo}} && cd cloud-profiler-nodejs \
		&& git fetch origin {{if .PR}}pull/{{.PR}}/head{{else}}{{.Branch}}{{end}}:pull_branch \
		&& git checkout pull_branch && git reset --hard {{.Commit}} \
		&& npm run compile  && npm pack
ENV VERSION=$(node -e "console.log(require('./package.json').version);")
ENV PROFILER="$HOME/cloud-profiler-nodejs/google-cloud-profiler-$VERSION.tgz"
RUN cd testing/busybench-ts \
		&& npm install --fallback-to-build=false --profiler_binary_host_mirror={{.BinaryHost}} "$PROFILER" typescript gts \
		&& npm run compile \
		&& GCLOUD_PROFILER_LOGLEVEL=5 GAE_SERVICE={{.Service}} node --trace-warnings build/src/busybench.js 600
RUN echo {{.FinishString}}
`

const startupTemplate = `
#! /bin/bash

# Signal any unexpected error.
trap 'echo "{{.ErrorString}}"' ERR

(
# Shut down the VM in 5 minutes after this script exits
# to stop accounting the VM for billing and cores quota.
trap "sleep 300 && poweroff" EXIT

retry() {
  for i in {1..3}; do
    "${@}" && return 0
  done
  return 1
}

# Fail on any error
set -eo pipefail

# Display commands being run
set -x
# Install git
retry apt-get update >/dev/null
retry apt-get -y -q install git {{if eq .BinaryHost ""}}build-essential{{end}} >/dev/null

# Install desired version of Node.js
retry curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash >/dev/null
export NVM_DIR="$HOME/.nvm" >/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" >/dev/null

# nvm install writes to stderr and stdout on successful install, so some
# output will appear on successful installs. To reduce the amount of output, 
# while maintaining error messages printed when nvm install fails, output to
# stdout is redirected to /dev/null.
{{if .NVMMirror}}NVM_NODEJS_ORG_MIRROR={{.NVMMirror}}{{end}} retry nvm install {{.NodeVersion}} >/dev/null
npm -v
node -v
NODEDIR=$(dirname $(dirname $(which node)))

# Install agent
retry git clone {{.Repo}}
cd cloud-profiler-nodejs
retry git fetch origin {{if .PR}}pull/{{.PR}}/head{{else}}{{.Branch}}{{end}}:pull_branch
git checkout pull_branch
git reset --hard {{.Commit}}
{{if eq .BinaryHost ""}}
retry npm install --nodedir="$NODEDIR" --build-from-source=profiler >/dev/null
{{else}}
retry npm install --nodedir="$NODEDIR" --fallback-to-build=false --profiler_binary_host_mirror={{.BinaryHost}} >/dev/null
{{end}}

npm run compile 
npm pack --nodedir="$NODEDIR" >/dev/null
VERSION=$(node -e "console.log(require('./package.json').version);")
PROFILER="$HOME/cloud-profiler-nodejs/google-cloud-profiler-$VERSION.tgz"

TESTDIR="$HOME/test"
mkdir -p "$TESTDIR"
cp -r "testing/busybench" "$TESTDIR"
cd "$TESTDIR/busybench"

retry npm install node-pre-gyp
{{if eq .BinaryHost ""}}
retry npm install --nodedir="$NODEDIR" --build-from-source=profiler "$PROFILER" typescript gts >/dev/null
{{else}}
retry npm install --nodedir="$NODEDIR" --fallback-to-build=false --profiler_binary_host_mirror={{.BinaryHost}} "$PROFILER" typescript gts >/dev/null
{{end}}

npm run compile

# Run benchmark with agent
GCLOUD_PROFILER_LOGLEVEL=5 GAE_SERVICE={{.Service}} node --trace-warnings build/src/busybench.js 600

# Indicate to test that script has finished running
echo "{{.FinishString}}"

# Write output to serial port 2 with timestamp.
) 2>&1 | while read line; do echo "$(date): ${line}"; done >/dev/ttyS1
`

type profileSummary struct {
	profileType  string
	functionName string
}

type nodeGCETestCase struct {
	InstanceConfig
	name         string
	nodeVersion  string
	nvmMirror    string
	wantProfiles []profileSummary
}

type nodeGKETestCase struct {
	GKETestRunner
	ClusterConfig
	service     string
	nodeVersion string
}

func (ktc *nodeGKETestCase) initializeDockerfile(template *template.Template) error {
	var buf bytes.Buffer
	err := template.Execute(&buf,
		struct {
			Service      string
			NodeVersion  string
			Repo         string
			PR           int
			Branch       string
			Commit       string
			FinishString string
			BinaryHost   string
		}{
			Service:      ktc.service,
			NodeVersion:  ktc.nodeVersion,
			Repo:         *repo,
			PR:           *pr,
			Branch:       *branch,
			Commit:       *commit,
			FinishString: benchFinishString,
			BinaryHost:   *binaryHost,
		})
	if err != nil {
		return fmt.Errorf("failed to render startup script for %s: %v", ktc.service, err)
	}
	ktc.GKETestRunner.Dockerfile = buf.String()
	return nil
}

func (tc *nodeGCETestCase) initializeStartUpScript(template *template.Template) error {
	var buf bytes.Buffer
	err := template.Execute(&buf,
		struct {
			Service      string
			NodeVersion  string
			NVMMirror    string
			Repo         string
			PR           int
			Branch       string
			Commit       string
			FinishString string
			ErrorString  string
			BinaryHost   string
		}{
			Service:      tc.name,
			NodeVersion:  tc.nodeVersion,
			NVMMirror:    tc.nvmMirror,
			Repo:         *repo,
			PR:           *pr,
			Branch:       *branch,
			Commit:       *commit,
			FinishString: benchFinishString,
			ErrorString:  errorString,
			BinaryHost:   *binaryHost,
		})
	if err != nil {
		return fmt.Errorf("failed to render startup script for %s: %v", tc.name, err)
	}
	tc.StartupScript = buf.String()
	return nil
}

func tokenFromFile(file string) (*oauth2.Token, error) {
	f, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	tok := &oauth2.Token{}
	err = json.NewDecoder(f).Decode(tok)
	return tok, err
}

func TestAgentIntegration(t *testing.T) {
	projectID := os.Getenv("GCLOUD_TESTS_NODEJS_PROJECT_ID")
	if projectID == "" {
		t.Fatalf("Getenv(GCLOUD_TESTS_NODEJS_PROJECT_ID) got empty string")
	}

	zone := os.Getenv("GCLOUD_TESTS_NODEJS_ZONE")
	if zone == "" {
		t.Fatalf("Getenv(GCLOUD_TESTS_NODEJS_ZONE) got empty string")
	}

	bucket := os.Getenv("GCLOUD_TESTS_NODEJS_BUCKET")
	if bucket == "" {
		t.Fatalf("Getenv(GCLOUD_TESTS_NODEJS_BUCKET) got empty string")
	}

	tokenFile := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if projectID == "" {
		t.Fatalf("Getenv(GOOGLE_APPLICATION_CREDENTIALS) got empty string")
	}
	token, err := tokenFromFile(tokenFile)
	if err != nil {
		t.Fatal(err)
	}

	if *commit == "" {
		t.Fatal("commit flag is not set")
	}

	ctx := context.Background()

	client, err := google.DefaultClient(ctx, cloudScope)
	if err != nil {
		t.Fatalf("failed to get default client: %v", err)
	}

	containerService, err := container.New(client)
	if err != nil {
		t.Fatalf("failed to create container client: %v", err)
	}

	storageClient, err := storage.NewClient(ctx)
	if err != nil {
		t.Fatalf("storage.NewClient() error: %v", err)
	}

	gtc := nodeGKETestCase{
		GKETestRunner{
			TestRunner: TestRunner{
				Client: client,
			},
			ContainerService: containerService,
			StorageClient:    storageClient,
			Token:            token,
		},
		ClusterConfig{
			ProjectID:       projectID,
			Zone:            zone,
			ClusterName:     fmt.Sprintf("nodejs-%s", runID),
			PodName:         fmt.Sprintf("profiler-test-nodejs-pod-%s", runID),
			ImageSourceName: fmt.Sprintf("profiler-test-nodejs/%s/Dockerfile.zip", runID),
			ImageName:       fmt.Sprintf("%s/profiler-test-nodejs-%s", projectID, runID),
			Bucket:          bucket,
		},
		fmt.Sprintf("profiler-test-nodejs-gke-%s", runID),
		"10",
	}

	template, err := template.New("dockerfile").Parse(dockerfileTemplate)
	if err != nil {
		t.Fatalf("failed to parse startup script template: %v", err)
	}

	gtc.initializeDockerfile(template)

	timeoutCtx, cancel := context.WithTimeout(ctx, time.Minute*25)
	defer cancel()

	errs := gtc.GKETestRunner.RunTestOnGKE(timeoutCtx, &gtc.ClusterConfig, benchFinishString)
	for _, err := range errs {
		t.Error(err)
	}

	/*
		for _, wantProfile := range []profileSummary{{"WALL", "busyLoop"}, {"HEAP", "benchmark"}} {
			pr, err := gceTr.TestRunner.QueryProfiles(gtc.ProjectID, tc.name, startTime, endTime, wantProfile.profileType)
			if err != nil {
				t.Errorf("QueryProfiles(%s, %s, %s, %s, %s) got error: %v", tc.ProjectID, tc.name, startTime, endTime, wantProfile.profileType, err)
				continue
			}
			if err := pr.HasFunction(wantProfile.functionName); err != nil {
				t.Errorf("Function %s not found in profiles of type %s: %v", wantProfile.functionName, wantProfile.profileType, err)
			}
		}
	*/

}

/*
func TestAgentIntegration(t *testing.T) {
	projectID := os.Getenv("GCLOUD_TESTS_NODEJS_PROJECT_ID")
	if projectID == "" {
		t.Fatalf("Getenv(GCLOUD_TESTS_NODEJS_PROJECT_ID) got empty string")
	}

	zone := os.Getenv("GCLOUD_TESTS_NODEJS_ZONE")
	if zone == "" {
		t.Fatalf("Getenv(GCLOUD_TESTS_NODEJS_ZONE) got empty string")
	}

	if *commit == "" {
		t.Fatal("commit flag is not set")
	}

	ctx := context.Background()

	client, err := google.DefaultClient(ctx, cloudScope)
	if err != nil {
		t.Fatalf("failed to get default client: %v", err)
	}

	computeService, err := compute.New(client)
	if err != nil {
		t.Fatalf("failed to initialize compute Service: %v", err)
	}

	template, err := template.New("startupScript").Parse(startupTemplate)
	if err != nil {
		t.Fatalf("failed to parse startup script template: %v", err)
	}

	gceTr := GCETestRunner{
		TestRunner: TestRunner{
			Client: client,
		},
		ComputeService: computeService,
	}

	testcases := []nodeGCETestCase{
		{
			InstanceConfig: InstanceConfig{
				ProjectID:   projectID,
				Zone:        zone,
				Name:        fmt.Sprintf("profiler-test-node6-%s", runID),
				MachineType: "n1-standard-1",
			},
			name:         fmt.Sprintf("profiler-test-node6-%s-gce", runID),
			wantProfiles: []profileSummary{{"WALL", "busyLoop"}, {"HEAP", "benchmark"}},
			nodeVersion:  "6",
		},
		{
			InstanceConfig: InstanceConfig{
				ProjectID:   projectID,
				Zone:        zone,
				Name:        fmt.Sprintf("profiler-test-node8-%s", runID),
				MachineType: "n1-standard-1",
			},
			name:         fmt.Sprintf("profiler-test-node8-%s-gce", runID),
			wantProfiles: []profileSummary{{"WALL", "busyLoop"}, {"HEAP", "benchmark"}},
			nodeVersion:  "8",
		},
		{
			InstanceConfig: InstanceConfig{
				ProjectID:   projectID,
				Zone:        zone,
				Name:        fmt.Sprintf("profiler-test-node10-%s", runID),
				MachineType: "n1-standard-1",
			},
			name:         fmt.Sprintf("profiler-test-node10-%s-gce", runID),
			wantProfiles: []profileSummary{{"WALL", "busyLoop"}, {"HEAP", "benchmark"}},
			nodeVersion:  "10",
		},
		{
			InstanceConfig: InstanceConfig{
				ProjectID:   projectID,
				Zone:        zone,
				Name:        fmt.Sprintf("profiler-test-node11-%s", runID),
				MachineType: "n1-standard-1",
			},
			name:         fmt.Sprintf("profiler-test-node11-%s-gce", runID),
			wantProfiles: []profileSummary{{"WALL", "busyLoop"}, {"HEAP", "benchmark"}},
			nodeVersion:  "11",
		},
	}
	if *runOnlyV8CanaryTest {
		testcases = []nodeGCETestCase{{
			InstanceConfig: InstanceConfig{
				ProjectID:   projectID,
				Zone:        zone,
				Name:        fmt.Sprintf("profiler-test-v8-canary-%s", runID),
				MachineType: "n1-standard-1",
			},
			name:         fmt.Sprintf("profiler-test-v8-canary-%s-gce", runID),
			wantProfiles: []profileSummary{{"WALL", "busyLoop"}, {"HEAP", "benchmark"}},
			nodeVersion:  "node", // install latest version of node
			nvmMirror:    "https://nodejs.org/download/v8-canary",
		}}
	}

	// Allow test cases to run in parallel.
	runtime.GOMAXPROCS(len(testcases))

	for _, tc := range testcases {
		tc := tc // capture range variable
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if err := tc.initializeStartUpScript(template); err != nil {
				t.Fatalf("failed to initialize startup script: %v", err)
			}

			gceTr.StartInstance(ctx, &tc.InstanceConfig)
			defer func() {
				if gceTr.DeleteInstance(ctx, &tc.InstanceConfig); err != nil {
					t.Fatal(err)
				}
			}()

			timeoutCtx, cancel := context.WithTimeout(ctx, time.Minute*25)
			defer cancel()
			if err := gceTr.PollForSerialOutput(timeoutCtx, &tc.InstanceConfig, benchFinishString, errorString); err != nil {
				t.Fatal(err)
			}

			timeNow := time.Now()
			endTime := timeNow.Format(time.RFC3339)
			startTime := timeNow.Add(-1 * time.Hour).Format(time.RFC3339)
			for _, wantProfile := range tc.wantProfiles {
				pr, err := gceTr.TestRunner.QueryProfiles(tc.ProjectID, tc.name, startTime, endTime, wantProfile.profileType)
				if err != nil {
					t.Errorf("QueryProfiles(%s, %s, %s, %s, %s) got error: %v", tc.ProjectID, tc.name, startTime, endTime, wantProfile.profileType, err)
					continue
				}
				if err := pr.HasFunction(wantProfile.functionName); err != nil {
					t.Errorf("Function %s not found in profiles of type %s: %v", wantProfile.functionName, wantProfile.profileType, err)
				}
			}
		})
	}
}
*/
