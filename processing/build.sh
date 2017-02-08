sudo apt-get install -y autoconf libtool nasm yasm cmake libav-tools
sudo pip install xlsxwriter

git submodule init
git submodule update --recursive
cd euglenatracer
./buildall_without_matlab.sh
cp build/euglena ../tools
cd ../euglenamovie
./build.sh
cp build/euglenamovie ../tools

