import cv2
import glob
import numpy as np

import multiprocessing as mp
from multiprocessing import Manager

class Media(object):
    def  __init__(self,movieFile):
        self._movieFile = movieFile
        self._isMovie = self._movieFile.endswith(".mp4") or self._movieFile.endswith(".ogg")
        self._cond = mp.Condition()
        self._queue = Manager().Queue(100)
        self._totalFrames = mp.Value("i",0)
        self._finished = mp.Value("i",0)

    def _prefetch(self):
        self._cond.acquire()
        if self._isMovie:
            self._cap = cv2.VideoCapture(self._movieFile)
        else:
            if not self._movieFile.endswith("/"):
                self._movieFile = self._movieFile + "/"

            self._imgFiles =  glob.glob(self._movieFile + "*.jpg")
            self._imgFiles.sort()

        self._totalFrames.value = self._getTotalFrames()
        self._cond.notify_all()
        self._cond.release()

        count = 0
        while(self._finished.value == 0):
            flag,frame = self._getNextFrame()
            if flag :
                try:
                    self._queue.put( frame , block=True )
                    count += 1
                except:
                    pass
            else:
                break

        self._closeMedia()

    def openMedia(self):
        self._cursor = 0
        mp.Process(target=self._prefetch).start()
        self._cond.acquire()
        self._cond.wait()
        self._cond.release()

    def getTotalFrames(self):
        return self._totalFrames.value

    def _getTotalFrames(self):
        if self._isMovie:
            return int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))
        else:
            return len(self._imgFiles)

    def _closeMedia(self):
        if self._isMovie:
            self._cap.release()

    def getNextFrame(self):
        if( self._cursor >= self._totalFrames.value):
            return (False,None)

        self._cursor += 1
        return (True,self._queue.get())

    def _getNextFrame(self):
        if self._isMovie:
            return self._cap.read()
        else:
            if( self._cursor < len(self._imgFiles )):
                frame = cv2.imread(self._imgFiles[self._cursor])
                self._cursor += 1
                return (True,frame)
            else:
                return (False,None)

    def closeMedia(self):
        with self._finished.get_lock():
            self._finished.value  = 1
        #print self._finished.value

class EuglenaDetector(object):
    __KERNEL_ERODE          = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3))
    __KERNEL_DILATE         = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5))
    __FGBG                  = cv2.createBackgroundSubtractorMOG2(detectShadows=False)
    __CONTOUR_AREA_TRESHOLD = 250

    def __init__(self,movieFile,zoom=10):
        self._frameRects = []
        self._frameAngles = []
        self._debug = True
        self._zoom = zoom
        self._areaFactor = (zoom / 10.0) ** 2
        self._media = Media(movieFile)

    def detect(self):

        self._media.openMedia()
        self._frameRects = []
        self._frameAngles = []

        n = 0
        while (True):
            ret,frame = self._media.getNextFrame()
            if ret == False:
                break

            fgmask = self.__FGBG.apply(frame)

            ret,thresh = cv2.threshold(fgmask,127,255,0)
            fgmask = cv2.morphologyEx(thresh, cv2.MORPH_ERODE,self.__KERNEL_ERODE)
            fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_DILATE, self.__KERNEL_ERODE)
            #fgmask = cv2.morphologyEx(thresh,cv2.MORPH_OPEN,self._KERNEL_ERODE)
            _,contours,_ = cv2.findContours(fgmask, cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
            rectangles = []
            angles = [];

            if self._debug :
                drawFrame = frame.copy()

            for i in xrange(len(contours)):
                if cv2.contourArea(contours[i]) > self.__CONTOUR_AREA_TRESHOLD * self._areaFactor:
                    rect = cv2.minAreaRect(contours[i])
                    rectangles.append( rect )

                    if self._debug:
                        box = cv2.boxPoints(rect)
                        for ii in range(4):
                          cv2.line(drawFrame,tuple(box[ii]),tuple(box[(ii+1)%4]),(0,255,255))

                    #image,"Hello World!!!", (x,y),
                    xy = np.int0(np.array(rect[0]))
                    #xy = np.int0((np.array(rect[0]) + np.array(rect[1]))/2.0)
                    #print
                    x = xy[0]
                    y = xy[1]

                    #width  = np.abs(rect[0][0] - rect[1][0])
                    #height = np.abs(rect[0][1] - rect[1][1])

                    width = rect[1][0]
                    height = rect[1][1]

                    angle = rect[2]

                    if height > width:
                        angle = angle + 90

                    if angle > 90:
                        angle -= 180
                    elif angle < -90:
                        angle += 180

                    angle = -angle
                    angles.append(angle)
                    if self._debug :
                        #color = (255,0,0) if flag else (255,255,255)
                        color = (255,255,255)
                        cv2.putText(drawFrame,"%0.1f"%(angle),(x,y),cv2.FONT_HERSHEY_DUPLEX, 0.5, color)

            self._frameRects.append( rectangles )
            self._frameAngles.append(angles)
            if self._debug:
                cv2.imwrite("out/%05d.jpg"%(n),drawFrame)

            n += 1

        #self._media.closeMedia()
