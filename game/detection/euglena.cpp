// #include <opencv2/core/core.hpp>
// #include <opencv2/video/background_segm.hpp>
// #include "opencv2/imgproc/imgproc.hpp"
// #include <opencv2/highgui/highgui.hpp>


#include <opencv2/opencv.hpp>

cv::Ptr<cv::BackgroundSubtractor> _fgbg;
cv::Mat _elementErode;
cv::Mat _elementDilate;

class State{
private:
    cv::Point2f _pos;
    float       _angle;
public:
    cv::Mat toMatrix()
    {
        cv::Mat state = cv::Mat_<float>(State::DIMENSION,1);
        state.at<float>(0) = _pos.x;
        state.at<float>(1) = _pos.y;
        state.at<float>(2) = _angle;
        return state;
    }

    static const int DIMENSION=3;
    static State fromMatrix( cv::Mat state )
    {
        State st;
        st._pos.x = state.at<float>(0);
        st._pos.y = state.at<float>(1);
        st._angle = state.at<float>(2);
    }
};

class Predictor{
public:
    cv::KalmanFilter _kalman;

    Predictor(State& initial):
        _kalman(State::DIMENSION,State::DIMENSION)
    {
        cv::setIdentity(_kalman.transitionMatrix);
        cv::setIdentity(_kalman.processNoiseCov, cv::Scalar::all(1e-4));
        cv::setIdentity(_kalman.measurementNoiseCov, cv::Scalar::all(10));
        cv::setIdentity(_kalman.errorCovPost, cv::Scalar::all(.1));
        _kalman.statePre = initial.toMatrix();
    }
    State predict()
    {
        cv::Mat prediction = _kalman.predict();
        return State::fromMatrix(prediction);
    }

    void correct(State &state)
    {
        _kalman.correct( state.toMatrix() );
    }
};

class Track{
public:
    int             _startFrame;
    int             _lastFrame;
    cv::RotatedRect _head;
    Predictor       _predictor;

    Track( cv::RotatedRect &head, int startFrame, State &initialState) :
        _head(head), _startFrame(startFrame), _predictor(initialState)
    {

    }
    cv::RotatedRect& getHead(){ return _head;}
};

class TrackManager{
private:
    std::vector< Track > _tracks;
public:
    void track( std::vector<cv::RotatedRect> &euglenas)
    {
    }
};

cv::RotatedRect rectifyRect(cv::RotatedRect &rect)
{
    float width  = rect.size.width;
    float height = rect.size.height;
    float angle = rect.angle;

    if (height > width){
        rect.size.width = height;
        rect.size.height = width;
        rect.angle = angle + 90;
    }

    return rect;

}

void detectEuglena(cv::Mat im, std::vector<cv::RotatedRect>  &euglenas)
{
    cv::Mat fgmask;
    //_fgbg->apply(im,fgmask,-1);
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

    euglenas.clear();
    for(auto &c : contours){
        if ( cv::contourArea(c) > 250.0 ){
            cv::RotatedRect rect = cv::minAreaRect(c);
            euglenas.push_back( rectifyRect(rect) );
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

    //return im;
}

void drawEuglena( cv::Mat &im, const std::vector<cv::RotatedRect> &euglenas)
{
    for(auto &e : euglenas){
        cv::Point2f pts[4];
        e.points(pts);
        for(int i=0;i<4;i++){
            cv::line(im,pts[i],pts[(i+1)%4],cv::Scalar(255,255,0,255),2);
        }
    }
}

int main(int argc, char **argv)
{
    _fgbg = new cv::BackgroundSubtractorMOG2(500,16,false);
    //_fgbg = cv::createBackgroundSubtractorMOG2();
    _elementErode  = getStructuringElement( cv::MORPH_ELLIPSE, cv::Size( 3, 3 ) );
    _elementDilate = getStructuringElement( cv::MORPH_ELLIPSE, cv::Size( 5, 5 ));

    cv::VideoCapture cap("../movie.ogg");
    cv::Mat frame;
    std::vector< cv::RotatedRect> euglenaList;

    while(1){
        if ( !cap.read(frame) ) break;
        detectEuglena(frame, euglenaList);
        drawEuglena(frame,euglenaList);
        cv::imshow("image",frame);
        if( (cv::waitKey(67)  & 0xff)  == 27 )
            break;
    }

    return 0;
}
