#!/bin/bash
git fetch && git pull
./initLeds.sh
forever app.js
