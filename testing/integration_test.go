/**
 * Copyright 2017 Google Inc. All Rights Reserved.
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

package testing

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"testing"
	"text/template"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/oauth2/google"
	compute "google.golang.org/api/compute/v1"
	"google.golang.org/api/googleapi"
)

var (
	commit = flag.String("commit", "", "git commit to test")
	runID  = time.Now().Unix()
)

const (
	cloudScope        = "https://www.googleapis.com/auth/cloud-platform"
	monitorWriteScope = "https://www.googleapis.com/auth/monitoring.write"
	// benchFinishString should keep in sync with the finish string in busybench.
	benchFinishString = "busybench finished profiling"
)
const startupTemplate = `
#! /bin/bash

#Fail on any error
set -e pipefail

# Display commands being run
set -x
# Install git
sudo apt-get update
sudo apt-get -y -q install git-all build-essential

# Install desired version of Node.js
curl -sL https://deb.nodesource.com/setup_{{.NodeVersion}}.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt-get install nodejs
npm -v
node -v

# Install agent
git clone https://github.com/GoogleCloudPlatform/cloud-profiler-nodejs.git 
cd cloud-profiler-nodejs
git reset --hard {{.Commit}}
npm install
npm run compile
npm pack
VERSION=$(node -e "console.log(require('./package.json').version);")
PROFILER="$HOME/cloud-profiler-nodejs/google-cloud-profiler-$VERSION.tgz"

TESTDIR="$HOME/test"
mkdir -p "$TESTDIR"
cp "e2e/busybench.js" "$TESTDIR"
cd "$TESTDIR"

npm install "$PROFILER"

# Run benchmark with agent
GCLOUD_PROFILER_LOGLEVEL=5 GAE_SERVICE={{.Service}} node --require @google-cloud/profiler busybench.js 600

# Indicate script finished
echo "busybench finished profiling"
`

type testRunner struct {
	client          *http.Client
	startupTemplate *template.Template
	computeService  *compute.Service
}
type profileResponse struct {
	Profile     profileData   `json:"profile"`
	NumProfiles int32         `json:"numProfiles"`
	Deployments []interface{} `json:"deployments"`
}
type profileData struct {
	Samples           []int32       `json:"samples"`
	SampleMetrics     interface{}   `json:"sampleMetrics"`
	DefaultMetricType string        `json:"defaultMetricType"`
	TreeNodes         interface{}   `json:"treeNodes"`
	Functions         functionArray `json:"functions"`
	SourceFiles       interface{}   `json:"sourceFiles"`
}
type functionArray struct {
	Name       []string `json:"name"`
	Sourcefile []int32  `json:"sourceFile"`
}

func validateProfileData(rawData []byte, wantFunctionName string) error {
	var pr profileResponse
	if err := json.Unmarshal(rawData, &pr); err != nil {
		return err
	}
	if pr.NumProfiles == 0 {
		return fmt.Errorf("profile response contains zero profiles: %v", pr)
	}
	if len(pr.Deployments) == 0 {
		return fmt.Errorf("profile response contains zero deployments: %v", pr)
	}
	if len(pr.Profile.Functions.Name) == 0 {
		return fmt.Errorf("profile does not have function data")
	}
	for _, name := range pr.Profile.Functions.Name {
		if strings.Contains(name, wantFunctionName) {
			return nil
		}
	}
	return fmt.Errorf("wanted function name %s not found in profile", wantFunctionName)
}

type instanceConfig struct {
	name        string
	service     string
	nodeVersion string
}

func newInstanceConfigs() []instanceConfig {
	return []instanceConfig{
		{
			name:        fmt.Sprintf("profiler-test-node6-%d", runID),
			service:     fmt.Sprintf("profiler-test-node6-%d-gce", runID),
			nodeVersion: "6",
		},
		{
			name:        fmt.Sprintf("profiler-test-node8-%d", runID),
			service:     fmt.Sprintf("profiler-test-node8-%d-gce", runID),
			nodeVersion: "8",
		},
	}
}

func renderStartupScript(template *template.Template, inst instanceConfig) (string, error) {
	var buf bytes.Buffer
	err := template.Execute(&buf,
		struct {
			Service     string
			NodeVersion string
			Commit      string
		}{
			Service:     inst.service,
			NodeVersion: inst.nodeVersion,
			Commit:      *commit,
		})
	if err != nil {
		return "", fmt.Errorf("failed to render startup script for %s: %v", inst.name, err)
	}
	return buf.String(), nil
}
func (tr *testRunner) startInstance(ctx context.Context, inst instanceConfig, projectID, zone string) error {
	img, err := tr.computeService.Images.GetFromFamily("debian-cloud", "debian-9").Context(ctx).Do()
	if err != nil {
		return err
	}
	startupScript, err := renderStartupScript(tr.startupTemplate, inst)
	if err != nil {
		return err
	}
	_, err = tr.computeService.Instances.Insert(projectID, zone, &compute.Instance{
		MachineType: fmt.Sprintf("zones/%s/machineTypes/n1-standard-1", zone),
		Name:        inst.name,
		Disks: []*compute.AttachedDisk{{
			AutoDelete: true, // delete the disk when the VM is deleted.
			Boot:       true,
			Type:       "PERSISTENT",
			Mode:       "READ_WRITE",
			InitializeParams: &compute.AttachedDiskInitializeParams{
				SourceImage: img.SelfLink,
				DiskType:    fmt.Sprintf("https://www.googleapis.com/compute/v1/projects/%s/zones/%s/diskTypes/pd-standard", projectID, zone),
			},
		}},
		NetworkInterfaces: []*compute.NetworkInterface{{
			Network: fmt.Sprintf("https://www.googleapis.com/compute/v1/projects/%s/global/networks/default", projectID),
			AccessConfigs: []*compute.AccessConfig{{
				Name: "External NAT",
			}},
		}},
		Metadata: &compute.Metadata{
			Items: []*compute.MetadataItems{{
				Key:   "startup-script",
				Value: googleapi.String(startupScript),
			}},
		},
		ServiceAccounts: []*compute.ServiceAccount{{
			Email: "default",
			Scopes: []string{
				monitorWriteScope,
			},
		}},
	}).Do()
	return err
}
func (tr *testRunner) pollForSerialOutput(ctx context.Context, projectID, zone, instanceName string) error {
	var output string
	defer func() {
		log.Printf("Serial port output for %s:\n%s", instanceName, output)
	}()
	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timed out waiting for profiling finishing on instance %s", instanceName)
		case <-time.After(20 * time.Second):
			resp, err := tr.computeService.Instances.GetSerialPortOutput(projectID, zone, instanceName).Context(ctx).Do()
			if err != nil {
				// Transient failure.
				log.Printf("Transient error getting serial port output from instance %s (will retry): %v", instanceName, err)
				continue
			}
			if output = resp.Contents; strings.Contains(output, benchFinishString) {
				return nil
			}
		}
	}
}
func (tr *testRunner) queryAndCheckProfile(service, startTime, endTime, profileType, projectID string) error {
	queryURL := fmt.Sprintf("https://cloudprofiler.googleapis.com/v2/projects/%s/profiles:query", projectID)
	const queryJSONFmt = `{"endTime": "%s", "profileType": "%s","startTime": "%s", "target": "%s"}`
	queryRequest := fmt.Sprintf(queryJSONFmt, endTime, profileType, startTime, service)
	resp, err := tr.client.Post(queryURL, "application/json", strings.NewReader(queryRequest))
	if err != nil {
		return fmt.Errorf("failed to query API: %v", err)
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %v", err)
	}
	if err := validateProfileData(body, "benchmark"); err != nil {
		return fmt.Errorf("failed to validate profile %v", err)
	}
	return nil
}
func (tr *testRunner) runTestOnGCE(ctx context.Context, t *testing.T, inst instanceConfig, projectID, zone string) {
	if err := tr.startInstance(ctx, inst, projectID, zone); err != nil {
		t.Fatalf("startInstance(%s) got error: %v", inst.name, err)
	}
	defer func() {
		if _, err := tr.computeService.Instances.Delete(projectID, zone, inst.name).Context(ctx).Do(); err != nil {
			t.Errorf("Instances.Delete(%s) got error: %v", inst.name, err)
		}
	}()
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Minute*15)
	defer cancel()
	if err := tr.pollForSerialOutput(timeoutCtx, projectID, zone, inst.name); err != nil {
		t.Fatalf("pollForSerialOutput(%s) got error: %v", inst.name, err)
	}
	timeNow := time.Now()
	endTime := timeNow.Format(time.RFC3339)
	startTime := timeNow.Add(-1 * time.Hour).Format(time.RFC3339)
	profileTypes := []string{"WALL", "HEAP"}
	for _, pType := range profileTypes {
		if err := tr.queryAndCheckProfile(inst.service, startTime, endTime, pType, projectID); err != nil {
			t.Errorf("queryAndCheckProfile(%s, %s, %s, %s) got error: %v", inst.service, startTime, endTime, pType, err)
		}
	}
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
		t.Fatalf("failed to initialize compute service: %v", err)
	}
	template, err := template.New("startupScript").Parse(startupTemplate)
	if err != nil {
		t.Fatalf("failed to parse startup script template: %v", err)
	}
	tr := testRunner{
		computeService:  computeService,
		client:          client,
		startupTemplate: template,
	}
	instances := newInstanceConfigs()
	for _, instance := range instances {
		inst := instance // capture range variable
		t.Run(inst.service, func(t *testing.T) {
			t.Parallel()
			tr.runTestOnGCE(ctx, t, inst, projectID, zone)
		})
	}
}
