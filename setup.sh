#!/bin/bash
#sudo mkdir /myData
#sudo mkdir /myData/bpu
#sudo cp ./rename.sh /myData/bpu/
#sudo chmod -Rv 777 /myData
git submodule init
git submodule update
#make -C bpu/ImageStreamer clean
#make -C bpu/ImageStreamer 
npm install
cd shared
npm install
cd ../server
npm install
cd ../bpu
npm install

