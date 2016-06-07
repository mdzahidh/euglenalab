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
else
  imagesFolder=$1
fi 
tempFolder=$imagesFolder'/temp'

#Rename
renameToTemp() {
  count=0 
  for i in $1/*.jpg;
  do
      AddToOutArr "$count $i"
      out=$(setFullPermission $i)
      out=$(cp $i $2/$(printf '%05d.jpg' $count))
      ((count = $count + 1))
  done
  echo '0'
}

#New Temp Folder
exitStatus=$(makeNewFolder $tempFolder)
if [[ $exitStatus != '0' ]];
then
  AddToOutArr "1. Make New Temp Folder For Rename? Failed"
  AddToErrArr "$exitStatus"
else
  AddToOutArr "1. Make New Temp Folder For Rename? Okay"
  
  #Rename images to temp with integer files names 
  exitStatus=$(renameToTemp $imagesFolder $tempFolder)
  if [[ $exitStatus != '0' ]];
  then
    AddToOutArr "2. Rename files to temp? Failed"
    AddToErrArr "$exitStatus"
  else
    AddToOutArr "2. Rename files to temp? Okay"
  fi
fi

PrintIoArrays


