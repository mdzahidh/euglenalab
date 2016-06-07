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

import numpy as np
import cv2
import sys
import math


SKIPFRAMES = 50
THRESHOLD = 127
AREA_THRESHOLD = 250

cap = cv2.VideoCapture(sys.argv[1])
totalFrames = cap.get(cv2.CAP_PROP_FRAME_COUNT)

probeFrames = math.ceil(totalFrames * 0.050)
beginFrame = min(totalFrames,SKIPFRAMES)
endFrame = min(beginFrame + probeFrames,totalFrames)

fgbg = cv2.createBackgroundSubtractorMOG2(detectShadows=False)
#fgbg = cv2.createBackgroundSubtractorKNN(detectShadows=False)
kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3))
kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5))

n = 0
sums = [];

while(True):
    ret, frame = cap.read()    
    if ret == False:
        break
    
    frameg = cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
    fgmask = fgbg.apply(frameg)
    
    if n > beginFrame:
        ret,thresh = cv2.threshold(fgmask,THRESHOLD,255,0)
        fgmask = thresh
        fgmask = cv2.morphologyEx(thresh, cv2.MORPH_ERODE, kernel_erode)
        fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_DILATE, kernel_dilate)
        _,contours,hierarchy = cv2.findContours(fgmask, cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
                    
        sums.append( np.sum([1 for c in contours if cv2.contourArea(c) > AREA_THRESHOLD]) )
                                
        #cv2.imwrite("area_%05d.jpg"%n,fgmask)

    if( n >= endFrame):
        break

    n += 1
    
print np.median(sums)
# When everything done, release the capture
cap.release()
cv2.destroyAllWindows()
