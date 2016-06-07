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
  imagesFolder='/bpuData/tempExpData'
  tempImagesFolder='/bpuData/tempExpData/temp'
  imagesStreamerConfigFile='/bpuData/tempExpData/cameraConfigOutFile.txt'
else
  imagesFolder=$1
  tempImagesFolder=$3
  imagesStreamerConfigFile=$2
fi 
movieOutPath=$imagesFolder'/movie.mp4'
makeMovieTempInputStr=$tempImagesFolder"/%05d.jpg"

#Make Movie
makeMovieFromTemp() {
  avconv -y -r $1 -i $2 -preset ultrafast $3 
  echo '0'
}

#Get Save images interval in ms from streamer config
searchStr='outFileMs'
fps=100
output=$(awkFileForLineMatch $imagesStreamerConfigFile $searchStr)
if [[ -z "${output// }" ]];
then
  AddToOutArr "1. Get Save images interval in ms from streamer config? Failed"
  AddToErrArr "non-blocking error: fps search output is empty"
else
  fps="${output#*:}"
  AddToOutArr "1. Get Save images interval in ms from streamer config? $searchStr is $fps ms"
fi

#Make Movie from temp folder 
exitStatus=$(makeMovieFromTemp $fps $makeMovieTempInputStr $movieOutPath)
if [[ $exitStatus != '0' ]];
then
  AddToOutArr "2. Make Movie from temp folder? Failed"
  AddToErrArr "$exitStatus"
else
  AddToOutArr "2. Make Movie from temp folder? Okay"

  #Remove Temp Dir
  exitStatus=$(removeDir $tempImagesFolder)
  if [[ $exitStatus != '0' ]];
  then
    AddToOutArr "2. Remove Temp Dir? Failed"
    AddToErrArr "$exitStatus"
  else
    AddToOutArr "2. Remove Temp Dir? Okay"
  fi

fi

PrintIoArrays
