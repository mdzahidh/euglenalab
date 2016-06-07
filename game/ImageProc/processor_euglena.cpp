#include <stdio.h>
#include "singleton_factory.hpp"
#include <opencv2/core/core.hpp>
#include "opencv2/imgproc/imgproc.hpp"
//#include <opencv2/highgui/highgui.hpp>
#include <opencv2/video/background_segm.hpp>



// take number image type number (from cv::Mat.type()), get OpenCV's enum string.
std::string getImgType(int imgTypeInt)
{
    int numImgTypes = 35; // 7 base types, with five channel options each (none or C1, ..., C4)

    int enum_ints[] =       {CV_8U,  CV_8UC1,  CV_8UC2,  CV_8UC3,  CV_8UC4,
                             CV_8S,  CV_8SC1,  CV_8SC2,  CV_8SC3,  CV_8SC4,
                             CV_16U, CV_16UC1, CV_16UC2, CV_16UC3, CV_16UC4,
                             CV_16S, CV_16SC1, CV_16SC2, CV_16SC3, CV_16SC4,
                             CV_32S, CV_32SC1, CV_32SC2, CV_32SC3, CV_32SC4,
                             CV_32F, CV_32FC1, CV_32FC2, CV_32FC3, CV_32FC4,
                             CV_64F, CV_64FC1, CV_64FC2, CV_64FC3, CV_64FC4};

    std::string enum_strings[] = {"CV_8U",  "CV_8UC1",  "CV_8UC2",  "CV_8UC3",  "CV_8UC4",
                             "CV_8S",  "CV_8SC1",  "CV_8SC2",  "CV_8SC3",  "CV_8SC4",
                             "CV_16U", "CV_16UC1", "CV_16UC2", "CV_16UC3", "CV_16UC4",
                             "CV_16S", "CV_16SC1", "CV_16SC2", "CV_16SC3", "CV_16SC4",
                             "CV_32S", "CV_32SC1", "CV_32SC2", "CV_32SC3", "CV_32SC4",
                             "CV_32F", "CV_32FC1", "CV_32FC2", "CV_32FC3", "CV_32FC4",
                             "CV_64F", "CV_64FC1", "CV_64FC2", "CV_64FC3", "CV_64FC4"};

    for(int i=0; i<numImgTypes; i++)
    {
        if(imgTypeInt == enum_ints[i]) return enum_strings[i];
    }
    return "unknown image type";
}

class EuglenaProcessor : public Processor {
    public:
        EuglenaProcessor();
        virtual ~EuglenaProcessor();
        cv::Mat operator()(cv::Mat);
    private:
        cv::BackgroundSubtractor* _fgbg;
        cv::Mat _elementErode;
        cv::Mat _elementDilate;
};

EuglenaProcessor::EuglenaProcessor() : _fgbg(0)
{
    _fgbg = new cv::BackgroundSubtractorMOG2(500,16,false);
    _elementErode  = getStructuringElement( cv::MORPH_ELLIPSE, cv::Size( 3, 3 ) );
    _elementDilate = getStructuringElement( cv::MORPH_ELLIPSE, cv::Size( 5, 5 ));
}

EuglenaProcessor::~EuglenaProcessor()
{
    if(_fgbg)
        delete _fgbg;
}
cv::Mat EuglenaProcessor::operator()(cv::Mat im)
{
    //printf("Image Type: %s\n" , getImgType(im.type()).c_str() );

    cv::Mat fgmask;
    (*_fgbg)(im,fgmask,-1);

    //int morphElem = 0;
    cv::Mat dst;

    // cv::morphologyEx( fgmask, dst, cv::MORPH_ERODE,  _elementErode );
    // cv::morphologyEx( dst, fgmask, cv::MORPH_DILATE, _elementDilate );

    cv::threshold(fgmask,fgmask, 127,255, cv::THRESH_BINARY);
    cv::morphologyEx( fgmask, fgmask, cv::MORPH_ERODE,  _elementErode );
    cv::morphologyEx( fgmask, fgmask, cv::MORPH_DILATE, _elementDilate );

    std::vector<std::vector<cv::Point> > contours;
    cv::findContours( fgmask, contours,
                      cv::RETR_TREE,cv::CHAIN_APPROX_SIMPLE);

    //std::vector< std::vector<cv::Point> > validContours;
    std::vector<cv::RotatedRect>  euglenas;
    for(auto &c : contours){
        if ( cv::contourArea(c) > 250.0 ){
            cv::RotatedRect rect = cv::minAreaRect(c);
            euglenas.push_back( rect );
        }
    }


    for(auto &e : euglenas){
        cv::Point2f pts[4];
        e.points(pts);
        for(int i=0;i<4;i++){
            cv::line(im,pts[i],pts[(i+1)%4],cv::Scalar(255,255,0,255),2);
        }
    }
    //drawContours(im, validContours, -1, cv::Scalar(0,0,255),2);


    // cv::Mat fullAlpha = cv::Mat( im.size(), CV_8UC1, cv::Scalar(255));
    // std::vector<cv::Mat> rgb;
    // rgb.push_back(fgmask);
    // rgb.push_back(fgmask);
    // rgb.push_back(fgmask);
    // rgb.push_back(fullAlpha);
    // cv::merge(rgb,im);

    return im;
}


namespace {
  auto euglenaProcReg = ProcessorRegister<EuglenaProcessor>("Euglena");
}
