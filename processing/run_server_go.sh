#!/bin/bash

#forever -c "node --max-old-space-size=8192" -o out.log -e err.log  procApp.js
export GOPATH=/home/mserver/go
export GOROOT=/opt/go
forever -l forever.log -c "go run" processing.go
