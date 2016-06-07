#!/bin/bash

. ./bashFunctions.sh
source sourcefile
echo "LD_LIBRARY_PATH:"$LD_LIBRARY_PATH
#*********Output Statements*************
errArr=()
AddToErrArr() {
  errArr=("${errArr[@]}" "$1")
}
wrnArr=()
AddToWrnArr() {
  errArr=("${wrnArr[@]}" "$1")
}
outArr=()
AddToOutArr() {
  outArr=("${outArr[@]}" "$1")
}
PrintIoArrays() {
  printf "\n"
  printf '%s\n' "${outArr[@]}"
  printf "\n"
  if [ ${#wrnArr[@]} -eq 0 ];
  then
    printf "Complete with No Warnings"
  else
    printf "***********Warnings!"
    printf "\n"
    printf '%s\n' "${wrnArr[@]}"
  fi
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
#Print counter
secCnt=0
incSectionCounter() {
  secCnt=$((secCnt+1))
}

#*********  Variables

#Remote Folder to Mount
remoteAddress='192.168.1.100:/home/mserver/bpuEuglenaData_forMounting'
#Local Mount Location
# Basically the above remoteAddress will be mounted in this localMountPoint
localMountPoint='/mnt/bpuEuglenaData'
#Final data location in mounted folder
finalDataLocationInMount=$localMountPoint"/"$HOSTNAME
#Temp local data location
localDataLocation='/home/pi/bpuData/tempExpData'
#Group for data transfer
bpuDataGroup='bpudata'
#Init Flags
F_doSkipCameraStart=1
#Run Flags
F_isMounted=1
F_hasFinalDir=1
F_hasLocalDir=1

#*********  Functions
createLocalMountAndMount() {

  #Create Local for Mount
  exitStatus=$(createDir $localMountPoint)
  if [[ $exitStatus != '0' ]];
  then
    echo "Could not create local mount point $localMountPoint"
  else

    #Do Mount
    exitStatus=$(mountRemoteToLocal $localMountPoint $remoteAddress)
    if [[ $exitStatus != '0' ]];
    then
      echo "Could not mount remote $remoteAddress to local $localMountPoint err:$exitStatus"
    else
      echo '0'
    fi
  fi
}

#*********  Run
#Check Mount
exitStatus=$(isMountedDir $localMountPoint)
incSectionCounter
if [[ $exitStatus == '0' ]];
then
  AddToOutArr $secCnt". Is remote mounted? Yes"
  F_isMounted=0
else
  AddToOutArr $secCnt". Is remote mounted? No"

  #Do Mount
  incSectionCounter
  exitStatus=$(createLocalMountAndMount)
  if [[ $exitStatus != '0' ]];
  then
    AddToOutArr $secCnt". Create Local And Mount? No"
    AddToErrArr "$exitStatus"
  else
    AddToOutArr $secCnt". Create Local And Mount? Yes"
    F_isMounted=0
  fi
fi


#Create Final Data Location with Hostname
if [ $F_isMounted == 0 ];
then
  incSectionCounter
  exitStatus=$(createDir $finalDataLocationInMount)
  if [[ $exitStatus != '0' ]];
  then
    AddToOutArr $secCnt". Create Final Data Location with Hostname? No"
    AddToErrArr "$exitStatus"
  else
    AddToOutArr $secCnt". Create Final Data Location with Hostname? Yes"

    #set group bpudata ownership to hostname folder
    incSectionCounter
    exitStatus=$(setGroupOwnOnFolder $bpuDataGroup $finalDataLocationInMount)
    if [[ $exitStatus != '0' ]];
    then
      AddToOutArr $secCnt". set group bpudata ownership to hostname folder? No"
      AddToErrArr "$exitStatus"
    else
      AddToOutArr $secCnt". set group bpudata ownership to hostname folder? Yes"
      F_hasFinalDir=0
    fi
  fi
fi

#Create Local Temporaty Data Location
if [ $F_hasFinalDir == 0 ];
then
  incSectionCounter
  exitStatus=$(createDir $localDataLocation)
  if [[ $exitStatus != '0' ]];
  then
    AddToOutArr $secCnt". Create Local Temporaty Data Location? No"
    AddToErrArr "$exitStatus"
  else
    AddToOutArr $secCnt". Create Local Temporaty Data Location? Yes"
    F_hasLocalDir=0;
  fi
fi

#Camera
if [ $F_doSkipCameraStart == 1 ];
then
  #If everything is okay then start web streamer
  if [ $F_isMounted == 0 -a $F_hasFinalDir == 0 -a $F_hasLocalDir == 0 ];
  then
    #Static Camera Arguments
    inFPS=15
    inX=640
    inY=480
    outHttpPort=8080
    outHttpWeb='../bpu/ImageStreamer/www'
    outFilePath=$localDataLocation
    outFileMs=100

    #Rough webCam dev
    webCamDev="/dev/video0"
    #Data Dir for bpu config and temp data dir, this will be moved to mounted drive when experiment is finished
    isRaspPiCam=1
    cameraConfigOutFile='cameraConfigOutFile.cnf'
    doStartCam=1

    # if raspberry pi camera arg(-r) is not set then check for web cam device.
    incSectionCounter
    if [ "$1" == "-r" ];
    then
      AddToOutArr $secCnt". Rasp Pi Cam argument specified? Yes"
      isRaspPiCam=0
    else
      #Check for standard webcam device
      exitStatus=$(cmdExists $webCamDev)
      if [[ $exitStatus == '0' ]];
      then
          AddToOutArr $secCnt". Has webcam? Yes"
      else
          AddToOutArr $secCnt". Has webcam? No"
          isRaspPiCam=0
      fi
    fi

    #write Image Streamer info to file
    incSectionCounter
    timestamp=$(date)
    timestamp=${timestamp// /_}
    outpath=$localDataLocation'/'$cameraConfigOutFile
    outputstr=$"timestamp:$timestamp\n"
    outputstr=$outputstr$"inFPS:$inFPS\n"
    outputstr=$outputstr$"inX:$inX\n"
    outputstr=$outputstr$"inY:$inY\n"
    outputstr=$outputstr$"outHttpPort:$outHttpPort\n"
    outputstr=$outputstr$"outHttpWeb:$outHttpWeb\n"
    outputstr=$outputstr$"outFilePath:$outFilePath\n"
    outputstr=$outputstr$"outFileMs:$outFileMs\n"
    outputstr=$outputstr$"isRaspPiCam:$isRaspPiCam\n"
    outputstr=$outputstr$"localDataLocation:$localDataLocation\n"
    outputstr=$outputstr$"hostname:$HOSTNAME\n"
    outputstr=$outputstr$"user:$USER\n"
    echo -e $outputstr > $outpath
    if [ $? -eq 0 ];
    then
      AddToOutArr $secCnt". write Image Streamer info to file? Yes"
    else
      AddToOutArr $secCnt". write Image Streamer info to file? No"
      AddToWrnArr "write Image Streamer info to file $exitStatus"
    fi

    #Start Webcam
    incSectionCounter
    if [ $isRaspPiCam -eq 0 ];
    then
      AddToOutArr $secCnt". Starting rasp pi cam? Yes"
      ##original##./mjpg_streamer -i './input_raspicam.so -fps 15  -x 640 -y 480' -o './output_http.so -p 8080 -w ./www' -o './output_file.so -f /myData/bpu/images -d 100'
      input="-fps $inFPS -x $inX -y $inY"
      outputHttp="-p $outHttpPort -w $outHttpWeb"
      outputFile="-f $outFilePath -d $outFileMs"
      ../bpu/ImageStreamer/mjpg_streamer -i "../bpu/ImageStreamer/input_raspicam.so $input" -o "../bpu/ImageStreamer/output_http.so $outputHttp" -o "../bpu/ImageStreamer/output_file.so $outputFile"
    else
      AddToOutArr $secCnt". Starting web cam? Yes"
      ##original##./mjpg_streamer -i './input_uvc.so -d /dev/video0 -f 15 -r 640x480' -o './output_http.so -p 8080 -w ./www' -o './output_file.so -f /myData/bpu/images -d 100'
      res="x"
      res=$inX$res
      res=$res$inY
      input="-d /dev/video0 -f $inFPS -r $res"
      outputHttp="-p $outHttpPort -w $outHttpWeb"
      outputFile="-f $outFilePath -d $outFileMs"
      ../bpu/ImageStreamer/mjpg_streamer -i "../bpu/ImageStreamer/input_uvc.so $input" -o "../bpu/ImageStreamer/output_http.so $outputHttp" -o "../bpu/ImageStreamer/output_file.so $outputFile"
    fi
  else
      AddToErrArr "Can't start image stream without file system being ready."
  fi
else
    AddToErrArr "Skip camera start init flag is set to true."
fi

PrintIoArrays
