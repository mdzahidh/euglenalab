#!/bin/bash
rm -f $1/*.jpg
if [ -d "$2/$3" ]; then
  rm -fr $2/$3
fi
mv $1 $2
