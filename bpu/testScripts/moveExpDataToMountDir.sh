#!/bin/bash
#Author: clitton

. ../../shared/bashFuncs/myBashFunctions.sh

#*********Output Statements*************
errArr=()
AddToErrArr() {
  errArr=("${errArr[@]}" "$1")
}
outArr=()
AddToOutArr() {
  outArr=("${outArr[@]}" "$1")
}
PrintIoArrays() {
  printf "\n"
  printf '%s\n' "${outArr[@]}"
  printf "\n"
  if [ ${#errArr[@]} -eq 0 ];
  then
    printf "Complete with No Errors"
  else
    printf "***********Errors!"
    printf "\n"
    printf '%s\n' "${errArr[@]}"
  fi
  printf "\n"
}

#*********Init************
if [ $# -eq 0 ];
then
  expFolder='/bpuData/tempExpData'
  lightData='/bpuData/tempExpData/lightdata.json'
  finalDataFolder='/mnt/bpuEuglenaData/'$HOSTNAME
else
  expFolder=$1
  lightData=$2
  finalDataFolder=$3
fi 
#lightData='/home/mserver/dev-processingFeature/bpu/bpuTestScripts/lightdata.json'
#default exp name incase id is not available.  hostname_timestamp
expId=$HOSTNAME"_"$(date +%s%N | cut -b1-13)

#Get Exp Id From Json
searchStr='exdpId'
output=$(awkFileForLineMatch $lightData $searchStr)
if [[ -z "${output// }" ]];
then
  AddToOutArr "1. Get Exp Id From Json? Warning"
  AddToErrArr "non-blocking error: Get Exp Id From Json search output is empty. $searchStr default is $expId"
else
  echo $output
  expId="${output#*:}"
  echo $expId
  expId="${expId#*\"}"
  echo $expId
  expId="${expId%\"*}"
  echo $expId
  AddToOutArr "1. Get Save images interval in ms from streamer config? $searchStr is $expId "
fi


finalDataFolder=$finalDataFolder"/"$expId
echo $finalDataFolder
#Make Final Data Folder 
exitStatus=$(copyDirTo $expFolder $finalDataFolder)
exitStatus='0'
if [[ $exitStatus != '0' ]];
then
  AddToOutArr "2. Make Final Data Folder? Failed"
  AddToErrArr "$exitStatus"
else
  AddToOutArr "2. Make Final Data Folder? Okay"

  #Remove Temp Dir
  #exitStatus=$(removeDir $tempImagesFolder)
  if [[ $exitStatus != '0' ]];
  then
    AddToOutArr "3. Remove Temp Dir? Failed"
    AddToErrArr "$exitStatus"
  else
    AddToOutArr "3. Remove Temp Dir? Okay"
  fi

fi

PrintIoArrays
