#!/bin/bash
git submodule init
git submodule update
npm install

cd shared
npm install

# For the webserver
cd ../server
npm install

#The controller server doesn't require any setup at the moment

# For the processing server
cd ../processing
./build.sh

#For the external camera
cd ../bpu/ImageStreamer
make
