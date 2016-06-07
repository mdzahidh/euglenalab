SRC := euglena.cpp
SRC_OBJS := $(SRC:.cpp=.o)
LIBS := -lopencv_objdetect  -lopencv_highgui -lopencv_videoio  -lopencv_video  -lopencv_imgproc -lopencv_core
CXXFLAGS := -O2 -std=c++11

all:euglena

%.bc:%.cpp
	g++ $(CXXFLAGS) -c $@ $<

euglena:$(SRC_OBJS)
	g++ -o euglena $(SRC_OBJS) $(LIBS)

clean:
	rm -f eugelna *.o
