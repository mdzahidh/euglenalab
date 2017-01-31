#!/bin/bash

screen -AdmS bpu -t camera bash -c "cd setupBpuScripts;./mountAndStartImageStreamer.sh"
screen -S bpu -X screen -t controller bash -c "cd bpu;./startBpu.sh"
