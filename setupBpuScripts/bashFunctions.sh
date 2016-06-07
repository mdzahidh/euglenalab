#Permissions
setUserOwn() {
  cmd="$1: $2"
  #output=$(sudo chown $cmd 2>&1);
  output=$(chown $cmd 2>&1);
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
}
setGroupOwnOnFolder() {
  cmd=":$1 $2"
  #output=$(sudo chown $cmd 2>&1);
  output=$(chown $cmd 2>&1);
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
}
setFullPermission() {
  cmd="777 $1"
  #output=$(sudo chmod $cmd 2>&1);
  output=$(chmod $cmd 2>&1);
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
}

#File System
cmdExists() {
  if [ -c $1 ];then echo '0'; else echo '1'; fi
}
fileExists() {
  if [ -f $1 ];then echo '0'; else echo '1'; fi
}
dirExists() {
  if [ -d "$1" ];then echo '0'; else echo '1'; fi
}
copyDirTo() {
  #output=$(sudo cp -r $1 $2 2>&1);
  output=$(cp -r $1 $2 2>&1);
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
}
createDir() {
  #output=$(sudo mkdir -p $1 2>&1);
  output=$(mkdir -p $1 2>&1);
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
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
makeNewFolder() {
  #Remove Folder 
  exitStatus=$(removeDir $tempFolder)
  if [[ $exitStatus != '0' ]];
  then
    echo "Remove failed:$exitStatus"
  else

    #Create Folder  
    exitStatus=$(createDir $tempFolder)
    if [[ $exitStatus != '0' ]];
    then
      echo "Create failed:$exitStatus"
    else

      #Create Folder  
      exitStatus=$(setFullPermission $tempFolder)
      if [[ $exitStatus != '0' ]];
      then
        echo "Set full permission failed:$exitStatus"
      else
        echo '0'
      fi

    fi
  fi
}

#Mounting
isMountedDir() {
  if mount | grep $1 > /dev/null; 
  then 
    echo '0'; 
  else 
    echo '1'; 
  fi
}
mountRemoteToLocal() {
  output=$(eval sudo mount $2 $1 2>&1)
  #output=$(eval mount $2 $1 2>&1)
  exitStatus=$?
  if [[ $exitStatus -ne 0 ]]; 
  then 
    echo $output
  else
    echo '0'
  fi
}

#File IO
readFile() {
  while IFS='' read -r line || [[ -n "$line" ]]; do
      echo $line
  done < "$1"
}

#Awk
awkFileForLineMatch() {
  re="/$2/"
  echo $(awk $re'{ print }' < $1)
}

#Reg Exp
checkArrayForStringMatch() {
  arr=("$@")
  ((last_idx=${#arr[@]} - 1))
  sstr=${arr[last_idx]}
  unset arr[last_idx]
  for each in "${arr[@]}"
  do
    if [[ "$each" =~ "$sstr" ]];
    then
      echo $each | cut -d':' -f 2
    fi
  done
}
