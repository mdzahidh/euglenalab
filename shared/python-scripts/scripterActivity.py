# -*- coding: utf-8 -*-
"""
Created on Wed Jul 15 22:31:41 2015

@author: zhossain
"""

# -*- coding: utf-8 -*-
"""
Created on Wed Jul 15 16:44:30 2015

@author: zhossain
"""

#import sys
#print 102.2340
#sys.exit(0)

import numpy as np
import cv2
import sys
import math
from euglena.detector import Media

SKIPFRAMES = 50
THRESHOLD = 127
DEBUG = False

#cap = cv2.VideoCapture(sys.argv[1])
cap = Media(sys.argv[1])
zoomLevel = float(sys.argv[2]) if len(sys.argv) > 2 else 10

areaFactor = (zoomLevel/10.0)**2
AREA_THRESHOLD = 250 * areaFactor

cap.openMedia()

#totalFrames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
totalFrames = cap.getTotalFrames()

probeFrames = math.ceil(totalFrames * 0.050)
beginFrame = min(totalFrames,SKIPFRAMES)
endFrame = min(beginFrame + probeFrames,totalFrames)

if int(cv2.__version__[0]) > 2:
    legacy = False;
    fgbg = cv2.createBackgroundSubtractorMOG2(detectShadows=False)
else:
    legacy = True;
    fgbg = cv2.BackgroundSubtractorMOG2(history=500,varThreshold=16,bShadowDetection=False)

kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3))
kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5))

n = 0
sums = []
count = 0
width = 1
height = 1
pixelSum = 0
while(True):
    #ret, frame = cap.read()
    ret, frame = cap.getNextFrame()
    height,width =  frame.shape[0:2]
    if ret == False:
        break

    #frameg = cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    fgmask = fgbg.apply(frame,learningRate=-1)

    if n > beginFrame:
        ret,thresh = cv2.threshold(fgmask,THRESHOLD,1,0)
        fgmask = cv2.morphologyEx(thresh, cv2.MORPH_ERODE, kernel_erode)
        fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_DILATE, kernel_dilate)

        if legacy == False:
            _,contours,hierarchy = cv2.findContours(fgmask, cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
        else:
            contours,hierarchy = cv2.findContours(fgmask, cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)


        #contours = filter( lambda c: cv2.contourArea(c) > AREA_THRESHOLD, contours )

        rects = [cv2.minAreaRect(c) for c in contours]

        filtered_rects = filter( lambda r : r[1][0]*r[1][1] > AREA_THRESHOLD and r[1][0]*r[1][1] < 1500*areaFactor, rects )

        #print len(filtered_rects)

        fgmask_clean = np.zeros(fgmask.shape,dtype=np.float)

        #print len(filtered_rects)

        sums.append( len(filtered_rects))

        for rect in filtered_rects:
            if legacy == False:
                box = cv2.boxPoints(rect)
            else:
                box = cv2.cv.BoxPoints(rect)

            box = np.int0(box)
            cv2.drawContours(fgmask_clean,[box],0,1,-1)


        #cv2.drawContours(fgmask_clean, contours, -1,  1, -1)


        if n > (beginFrame + 1):
            #diff = np.abs( np.array(fgmask,dtype=np.float)- np.array(lastFrame,dtype=np.float) )
            diff = np.clip(fgmask_clean - lastFrame, 0, 1,)
            pixelSum += np.sum(diff)
            count += 1

        lastFrame = fgmask_clean

        if DEBUG:
            cv2.imshow("test",fgmask_clean)
            cv2.waitKey(1)

    if( n >= endFrame):
        break

    n += 1

if count > 0 and len(sums) > 0:
    pop = np.median(sums)
    if pop:
        print ((pixelSum / float(count)) / float(pop)) * (1.0 / areaFactor)
    else:
        print 0
else:
    print 0

# When everything done, release the capture
cap.closeMedia()
