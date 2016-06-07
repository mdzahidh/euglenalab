#!/bin/bash

count=0
for i in $(ls /myData/bpu/images/*.jpg)
do
    cp $i /myData/bpu/temp/$(printf '%05d.jpg' $count)
    ((count = $count + 1))
done
