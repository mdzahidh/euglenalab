#!/bin/bash
avconv -r $1 -i /myData/bpu/temp/%05d.jpg -preset ultrafast /myData/bpu/images/movie.mp4
rm -f /myData/bpu/images/*.jpg
