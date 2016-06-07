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
# import sys
# print 15
# sys.exit(0)

import numpy as np
import cv2
import sys
import math
from euglena.detector import Media

SKIPFRAMES = 50
THRESHOLD = 127

cap = Media(sys.argv[1])
zoomLevel = float(sys.argv[2]) if len(sys.argv) > 2 else 10

areaFactor = (zoomLevel/10.0)**2
AREA_THRESHOLD = 250 * areaFactor

cap.openMedia()
totalFrames = cap.getTotalFrames()

probeFrames = math.ceil(totalFrames * 0.050)
beginFrame = min(totalFrames,SKIPFRAMES)
endFrame = min(beginFrame + probeFrames,totalFrames)

legacy = False
if int(cv2.__version__[0]) > 2:
    legacy = False;
    fgbg = cv2.createBackgroundSubtractorMOG2(detectShadows=False)
else:
    legacy = True;
    fgbg = cv2.BackgroundSubtractorMOG2(history=500,varThreshold=16,bShadowDetection=False)

kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3))
kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5))

n = 0
sums = [];

DEBUG=False

while(True):
    #ret, frame = cap.read()
    ret, frame = cap.getNextFrame()
    if ret == False:
        break

    #frameg = cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    fgmask = fgbg.apply(frame,learningRate=-1)

    drawFrame = frame.copy()

    if n > beginFrame:
        ret,thresh = cv2.threshold(fgmask,THRESHOLD,255,0)

        fgmask = thresh
        fgmask = cv2.morphologyEx(thresh, cv2.MORPH_ERODE, kernel_erode)
        fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_DILATE, kernel_dilate)

        if DEBUG:
            cv2.imwrite("tmp/thresh_%05d.jpg"%n,fgmask)

        if legacy == False:
            _,contours,hierarchy = cv2.findContours(fgmask, cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
        else:
            contours,hierarchy = cv2.findContours(fgmask, cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)


        rects = [cv2.minAreaRect(c) for c in contours]

        filtered_rects = filter( lambda r : r[1][0]*r[1][1] > AREA_THRESHOLD and r[1][0]*r[1][1] < 1500*areaFactor, rects )

        sums.append( len(filtered_rects) )

        if DEBUG:

            for rect in filtered_rects:
                if legacy == False:
                    box = cv2.boxPoints(rect)
                    for ii in range(4):
                        cv2.line(drawFrame,tuple(box[ii]),tuple(box[(ii+1)%4]),(0,255,255))
                else:
                    box = cv2.cv.BoxPoints(rect)
                    box = np.int0(box)
                    cv2.drawContours(drawFrame,[box],0,(0,255,255),3)

            cv2.drawContours(drawFrame,contours,-1,(255,0,0),1)
            cv2.imwrite("tmp/area_%05d.jpg"%n,drawFrame)

    if( n >= endFrame):
        break

    n += 1

if DEBUG:
    print sums

if len(sums) > 0:
  print int(np.median(sums))
else:
  print 0
# When everything done, release the capture
cap.closeMedia()
