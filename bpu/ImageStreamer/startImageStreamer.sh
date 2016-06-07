#!/bin/bash

. ../../shared/bashFuncs/myBashFunctions.sh

#/******************************************************************************
#                                                                              #
#      MJPG-streamer allows to stream JPG frames from an input-plugin          #
#      to several output plugins                                               #
#                                                                              #
#      Copyright (C) 2007 Tom Stöveken                                         #
#                                                                              #
# This program is free software; you can redistribute it and/or modify         #
# it under the terms of the GNU General Public License as published by         #
# the Free Software Foundation; version 2 of the License.                      #
#                                                                              #
# This program is distributed in the hope that it will be useful,              #
# but WITHOUT ANY WARRANTY; without even the implied warranty of               #
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the                #
# GNU General Public License for more details.                                 #
#                                                                              #
# You should have received a copy of the GNU General Public License            #
# along with this program; if not, write to the Free Software                  #
# Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA    #
#                                                                              #
#******************************************************************************/

## This example shows how to invoke mjpg-streamer from the command line

##clitton-2016_03_21: Rough check if webcam or rasppi cam in case -r is not supplied but raspi cam is.
##clitton-2016_03_21: Starting this script will create directories in / to save images
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

bpuInfo="/bpuData"
bpuTempExpData=$bpuInfo"/tempExpData"
#Static Camera Arguments
inFPS=15
inX=640
inY=480
outHttpPort=8080
outHttpWeb='./www'
outFilePath=$bpuTempExpData
outFileMs=100

#Rough webCam dev
webCamDev="/dev/video0"
#Data Dir for bpu config and temp data dir, this will be moved to mounted drive when experiment is finished
isRaspPiCam=1
cameraConfigOutFile='cameraConfigOutFile.txt'
doStartCam=1

# if raspberry pi camera arg(-r) is not set then check for web cam device.  
if [ "$1" == "-r" ]; 
then
  AddToOutArr "1. Rasp Pi Cam argument specified? Yes"
  isRaspPiCam=0
else 
    AddToOutArr "1. Rasp Pi Cam argument specified? No"
    
    #Check for standard webcam device 
    exitStatus=$(fileExists $webCamDev)
    if [[ $exitStatus == '0' ]];
    then
      AddToOutArr "2. Has webcam? Yes"
    else
      AddToOutArr "2. Has webcam? No. Auto set rasp pi cam flag."
      isRaspPiCam=0
    fi
fi


#Create Data Folder 
exitStatus=$(createDir $bpuTempExpData)
if [[ $exitStatus != '0' ]];
then
  AddToOutArr "3. Has data directory? No"
  AddToErrArr "Could not create data directory.  Will not start camera without $bpuTempExpData folder."
  AddToErrArr "$exitStatus"
else
  AddToOutArr "3. Has data directory? Yes"
  
  #Set ownership of temp data folder to 'pi'
  exitStatus=$(setUserOwn 'pi' $bpuTempExpData)
  if [[ $exitStatus != '0' ]];
  then
    AddToOutArr "3.1. Set pi user ownership? No"
    AddToErrArr "Could not set pi user ownership of temp data directory.  Will not start camera without $bpuTempExpData ownership."
    AddToErrArr "$exitStatus"
  else  
    AddToOutArr "3.1. Set pi user ownership? Yes"
    
    #Set full permission of temp data folder to 'pi'
    exitStatus=$(setFullPermission $bpuTempExpData)
    if [[ $exitStatus != '0' ]];
    then
      AddToOutArr "3.2. Set full permission? No"
      AddToErrArr "Could not Set full permission of temp data directory.  Will not start camera without $bpuTempExpData full permission"
      AddToErrArr "$exitStatus"
    else  
      AddToOutArr "3.2. Set full permission? Yes"
      doStartCam=0;
    fi
  fi
fi

#Start Camera
if [[ $doStartCam == '0' ]];
  then 

  #Turning of autoexposure for the camera. This could be specific to camera brands, 
  #check wth v4l2-ctl --list-ctrls
  v4l2-ctl --set-ctrl exposure_auto_priority=0
  export LD_LIBRARY_PATH="$(pwd)"

  #write Image Streamer info to file
  timestamp=$(date)
  timestamp=${timestamp// /_}
  outpath=$bpuTempExpData'/'$cameraConfigOutFile
  outputstr=$"timestamp:$timestamp\n"
  outputstr=$outputstr$"inFPS:$inFPS\n"
  outputstr=$outputstr$"inX:$inX\n"
  outputstr=$outputstr$"inY:$inY\n"
  outputstr=$outputstr$"outHttpPort:$outHttpPort\n"
  outputstr=$outputstr$"outHttpWeb:$outHttpWeb\n"
  outputstr=$outputstr$"outFilePath:$outFilePath\n"
  outputstr=$outputstr$"outFileMs:$outFileMs\n"
  outputstr=$outputstr$"isRaspPiCam:$isRaspPiCam\n"
  outputstr=$outputstr$"bpuTempExpData:$bpuTempExpData\n"
  echo -e $outputstr > $outpath 
  printf $?
  if [ $isRaspPiCam -eq 0 ]; 
  then
    AddToOutArr "4. Starting rasp pi cam"
    PrintIoArrays
    ##original##./mjpg_streamer -i './input_raspicam.so -fps 15  -x 640 -y 480' -o './output_http.so -p 8080 -w ./www' -o './output_file.so -f /myData/bpu/images -d 100'
    input="-fps $inFPS -x $inX -y $inY"
    outputHttp="-p $outHttpPort -w $outHttpWeb"
    outputFile="-f $outFilePath -d $outFileMs"
    ./mjpg_streamer -i "./input_raspicam.so $input" -o "./output_http.so $outputHttp" -o "./output_file.so $outputFile"
  else 
    AddToOutArr "4. Starting web cam"
    PrintIoArrays
    ##original##./mjpg_streamer -i './input_uvc.so -d /dev/video0 -f 15 -r 640x480' -o './output_http.so -p 8080 -w ./www' -o './output_file.so -f /myData/bpu/images -d 100'
    input="-fps $inFPS -x $inX -y $inY"
    outputHttp="-p $outHttpPort -w $outHttpWeb"
    outputFile="-f $outFilePath -d $outFileMs"
    ./mjpg_streamer -i "./input_uvc.so $input" -o "./output_http.so $outputHttp" -o "./output_file.so $outputFile"
  fi
else
  AddToOutArr "4. Not Starting camera"
  PrintIoArrays
fi

