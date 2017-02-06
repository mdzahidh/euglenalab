./tools/euglena -i $1 -tv -t 10
if [ ! -f $1/tracks_thresholded_10.avi ]; then
    exit -1
fi
avconv -y -i $1/tracks_thresholded_10.avi $1/tracks_thresholded_10.mp4 2>/dev/null 1>&2
avconv -y -i $1/tracks_thresholded_10.mp4 -qscale 5 $1/tracks_thresholded_10.ogg 2>/dev/null 1>&2
if [[ $?  -ne 0 ]]; then
    exit -1
fi
rm -f $1/tracks_thresholded_10.avi

python ./tools/writeMeasuresExcel.py $1
