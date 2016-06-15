#!/bin/bash
git submodule init
git submodule update
cd bpu
npm install
cd ImageStreamer
make
