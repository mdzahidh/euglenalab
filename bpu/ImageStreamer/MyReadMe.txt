./mjpg_streamer -i './input_uvc.so -d /dev/video0 -f 15 -r 640x480' -o './output_http.so -p 8080 -w ./www' -o './output_file.so -f /myData/bpu/images -d 100'
./mjpg_streamer -i './input_uvc.so -d /dev/video0 -f 15 -r 640x480' -o './output_http.so -p 8080 -w ./www'

