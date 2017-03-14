sudo apt-get install -y autoconf libtool nasm yasm cmake libav-tools
pip install xlsxwriter
pip install numpy

git submodule init
git submodule update --recursive
cd euglenatracer
./buildall_without_matlab.sh
cp build/euglena ../tools
cd ../euglenamovie
./build.sh
cp build/euglenamovie ../tools

# For MacOS, please install OpenCV Python module seperately, this build may not work
./build_opencv_python.sh
