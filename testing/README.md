This directory contains an integration test that confirms the basic functionality
of the profiler works on GCE. In particular, this test confirms that the agent 
can create and upload profiles from GCE, and that these profiles contain 
symbolized samples from the benchmark application.

More specifically, this test:
1. Starts 3 GCE VMs, one to test node versions 6, 8, and 9. 
Each GCE VM then:
    1. Downloads the desired version of node, github, and build-essentials 
    (the dependencies needed to run the test).
    2. Clones the agent from github.
    3. Runs the benchmark application, busybenchmark.js (which repeatedly calls
    a function which creates and fills a buffer) with the agent attached.
2. Waits for the application in each GCE VM to finish.
3. Queries the cloud profiler API to confirm that both heap and wall profiles 
have been uploaded to the API and that the profiles contain symbolized samples
which include the name of the function in the benchmark.
