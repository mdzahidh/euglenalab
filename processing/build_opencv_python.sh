# For MacOS, please install OpenCV Python module seperately, this build may not work
OSX_SDK_VERSION="10.9"
export MACOSX_DEPLOYMENT_TARGET=${OSX_SDK_VERSION}

mkdir -p build-opencv
cd build-opencv


cmake -DCMAKE_OSX_SYSROOT="/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX${OSX_SDK_VERSION}.sdk" -DCMAKE_OSX_DEPLOYMENT_TARGET=${OSX_SDK_VERSION} -DBUILD_PERF_TESTS=OFF -DBUILD_TESTS=OFF -DBUILD_PNG=ON -DBUILD_opencv_java=OFF -DBUILD_FAT_JAVA_LIB=OFF -DBUILD_JPEG=ON -DBUILD_TIFF=ON -DWITH_OPENEXR=OFF -DBUILD_ZLIB=ON -DWITH_WEBP=OFF -DWITH_OPENGL=OFF -DWITH_OPENCL=OFF -DWITH_CUDA=OFF -DBUILD_SHARED_LIBS=ON -DCMAKE_BUILD_TYPE=Release  ../euglenatracer/opencv/

make -j 8
sudo make install
