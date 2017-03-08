#!/bin/bash

#forever -c "node --max-old-space-size=8192" -o out.log -e err.log  app.js
forever -c "node --max-old-space-size=8192" app.js
