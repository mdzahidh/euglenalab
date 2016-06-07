#!/bin/bash
. ../../shared/bashFuncs/myBashFunctions.sh

#Run
configPath='./cameraConfigOutFile.txt'
lineArray=($(readFile $configPath))
output=$(checkArrayForStringMatch "${lineArray[@]}" 'outFileMs')
echo $output
