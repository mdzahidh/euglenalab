#!/bin/bash

#forever -c "node --max-old-space-size=8192" -o out.log -e err.log  bpuContApp.js
forever -c "node --max-old-space-size=8192" bpuContApp.js
