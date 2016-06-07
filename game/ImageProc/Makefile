# Project Build flags
WARNINGS := -Wno-long-long -Wall -Wswitch-enum -pedantic -Werror
CXXFLAGS := -pthread -std=gnu++11 $(WARNINGS)

#
# Compute tool paths
#
GETOS := python $(NACL_SDK_ROOT)/tools/getos.py
OSHELPERS = python $(NACL_SDK_ROOT)/tools/oshelpers.py
OSNAME := $(shell $(GETOS))
RM := $(OSHELPERS) rm

PNACL_TC_PATH := $(abspath $(NACL_SDK_ROOT)/toolchain/$(OSNAME)_pnacl)
PNACL_CXX := $(PNACL_TC_PATH)/bin/pnacl-clang++
PNACL_FINALIZE := $(PNACL_TC_PATH)/bin/pnacl-finalize
PNACL_COMPRESS := $(PNACL_TC_PATH)/bin/pnacl-compress
PNACL_CXXFLAGS := -O2 -I$(NACL_SDK_ROOT)/include $(CXXFLAGS)
LDFLAGS := -lopencv_video -lopencv_objdetect -lopencv_imgproc -lopencv_core  -lz
PNACL_LDFLAGS := -L$(NACL_SDK_ROOT)/lib/pnacl/Release  -lppapi_cpp -lppapi -lpthread $(LDFLAGS)

#PROCESSORS := $(wildcard processor_*.cpp) url_loader_handler.cpp
PROCESSORS := processor_euglena.cpp url_loader_handler.cpp
PROC_OBJECTS := $(PROCESSORS:.cpp=.bc)

OBJ := $(addprefix $(build)/, $(subst src/,, $(patsubst %.cpp, %.o, $(wildcard src/*.cpp))))

IMPROC_HEADERS := image_proc.cpp image_proc.hpp instance_factory.hpp improc_instance.hpp singleton_factory.hpp

# Declare the ALL target first, to make the 'all' target the default build
all: image_proc.pexe

# Create individual test
test:
	g++ -g -o test_display test_display.cpp $(PROC) -std=c++0x -lopencv_highgui -lopencv_imgcodecs $(LDFLAGS)


test_processor: test_processor.cpp singleton_factory.hpp $(PROCESSORS)
	g++ -g -o test_processor test_processor.cpp $(PROCESSORS) -std=c++0x $(LDFLAGS)

clean:
	$(RM) image_proc.pexe image_proc.bc
	$(RM) ${PROC_OBJECTS}

#$(PROC_OBJECTS): $(PROCESSORS) singleton_factory.hpp
#	$(PNACL_CXX) -o $@ $< -O2 $(CXXFLAGS) $(LDFLAGS)

%.bc:%.cpp                                                                                                                                                            |   ~
	$(PNACL_CXX) -c $(PNACL_CXXFLAGS) -o $@ $<


# image_proc.bc:  $(IMPROC_HEADERS) $(PROCESSORS) url_loader_handler.cpp
# 	$(PNACL_CXX) -o $@ $< $(PROCESSORS) url_loader_handler.cpp -O3 $(PNACL_CXXFLAGS) $(PNACL_LDFLAGS)

image_proc.bc: $(PROC_OBJECTS)
	$(PNACL_CXX) -o $@ $(PROC_OBJECTS) $(PNACL_CXXFLAGS) image_proc.cpp $(PNACL_LDFLAGS)

image_proc.pexe: image_proc.bc
	$(PNACL_FINALIZE) -o $@ $<
	$(PNACL_COMPRESS) -o image_proc.compressed.pexe image_proc.pexe

serve:
	python -m SimpleHTTPServer 8000
