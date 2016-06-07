#!/bin/bash
export NODE_PATH=$(npm -g prefix)/lib/node_modules/bpu/node_modules/
node --debug bpu.js
