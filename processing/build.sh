git submodule init
git submodule update --recursive
cd euglenatracer
./buildall_without_matlab.sh
cp build/euglena ../tools
cd ../euglenamovie
./build.sh
cp build/euglenamovie ../tools

