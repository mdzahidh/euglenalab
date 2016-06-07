#!/bin/bash


path="/home/mserver/dev-processingFeature/setupBpuScripts/test.sh"

path="/dev/video0"
if [ -c $path ];
then
  echo '0'
else
  echo '1'
fi

