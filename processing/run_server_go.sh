#!/bin/bash

#forever -c "node --max-old-space-size=8192" -o out.log -e err.log  procApp.js
set -o allexport
source ../.env
set +o allexport

forever -l forever.log -c "go run" -e "errors.log" processing.go
