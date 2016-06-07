#ifndef PROCESSOR_HPP
#define PROCESSOR_HPP

#include <opencv2/core/core.hpp>
#include "ppapi/cpp/var_dictionary.h"

class Processor {
  public:
    virtual cv::Mat operator()(cv::Mat)=0;
    virtual void getAuxillaryData( pp::VarDictionary& data ){};
    virtual ~Processor() {}
    virtual void init( cv::Mat ) {};
};

#endif
