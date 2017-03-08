#!/bin/bash

#forever -c "node --max-old-space-size=8192" -o out.log -e err.log  procApp.js
forever -c "node --max-old-space-size=8192" procApp.js
