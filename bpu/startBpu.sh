#!/bin/bash
git fetch && git pull
./initLeds.sh
v4l2-ctl -c exposure_auto_priority=0
forever app.js
