#!/bin/bash
git submodule init
git submodule update
cd bpu
npm install
./initLeds.sh
cd ImageStreamer
make
