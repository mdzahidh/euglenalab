#!/bin/bash

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
#*********Init************
#*********Init************
#Mount Remote Folder For Bpu Data
localMountPoint='/mnt/bpuEuglenaData'
#Addr for Remote Folder to Mount
remoteAddress='192.168.1.100:/bpuEuglenaData_forMounting'
#Bpu data Directory
bpuDataDir=$localMountPoint"/"$HOSTNAME

#*******Functions*********
#*******Functions*********
#*******Functions*********
#Create Folder Functions
dirExists() {
  if [ -d "$1" ];then echo '0'; else echo '1'; fi
}
fileExists() {
  if [ -f $1 ];then echo '0'; else echo '1'; fi
}
removeDir() {
  #Check Folder 
  exitStatus=$(dirExists $1)
  if [[ $exitStatus != '0' ]];
  then
    echo '0'
  else
    output=$(rm -r $1 2>&1);
    exitStatus=$?
    if [[ $exitStatus -ne 0 ]]; 
    then 
      echo $output
    else
      echo '0'
    fi
  fi
}
createDir() {
  output=$(sudo mkdir -p $1 2>&1);
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
}
listDirNotTested() {
  count=0 
  for i in ls $1/*.jpg;
  do
      echo "$count $i"
      ((count = $count + 1))
  done
}
#Mounting Functions
mountRemoteToLocal() {
  output=$(eval sudo mount' '$2' '$1 2>&1)
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
}
isMountedDir() {
  if mount | grep $1 > /dev/null; then echo '0'; else echo '1'; fi
}
setFullPermission() {
  cmd="777 $1"
  output=$(sudo chmod $cmd 2>&1);
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
}
#*******Main Functions*********
#*******Main Functions*********
#*******Main Functions*********
mountDir() {
  
  #Check Mount 
  exitStatus=$(isMountedDir $localMountPoint)
  if [[ $exitStatus == '0' ]];
  then
    AddToOutArr "1. Is alreay mounted? Yes"
    
    #Create Final Data Dir 
    exitStatus=$(createDir $bpuDataDir)
    if [[ $exitStatus != '0' ]];
    then
      AddToOutArr "2. Create final data dir? Failed"
      AddToErrArr "$exitStatus"
    else
      AddToOutArr "2. Create final data dir? Okay"

    fi
  
  else 
    AddToOutArr "1. Is alreay mounted? No"

    #Create Local for Mount 
    exitStatus=$(createDir $localMountPoint)
    if [[ $exitStatus != '0' ]];
    then
      AddToOutArr "2. Create local mount point? Failed"
      AddToErrArr "$exitStatus"
    else
      AddToOutArr "2. Create local mount point? Okay"
    

      #Do Mount 
      exitStatus=$(mountRemoteToLocal $localMountPoint $remoteAddress)
      if [[ $exitStatus != '0' ]];
      then
        AddToOutArr "3. Mount remote to local. Failed"
        AddToErrArr "$exitStatus"
      else 
        AddToOutArr "3. Mount remote to local. Okay"
          
        #Create Final Data Dir 
        exitStatus=$(createDir $bpuDataDir)
        if [[ $exitStatus != '0' ]];
        then
          AddToOutArr "5. Create final data dir? Failed"
          AddToErrArr "$exitStatus"
        else
          AddToOutArr "5. Create final data dir? Okay"
        fi
      fi
    fi
  fi
}

#*******Run*********
#*******Run*********
#*******Run*********
AddToOutArr "user:$USER hostname:$HOSTNAME"
AddToOutArr "mount remote $remoteAddress to local $localMountPoint"
AddToOutArr "create final bpu data directory $localMountPoint"

AddToOutArr ""
AddToOutArr "Start Mount"
mountDir

PrintIoArrays
