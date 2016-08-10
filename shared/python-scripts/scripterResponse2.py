
# import sys
# print 0.512349218342304
# sys.exit(0)

import numpy as np
import sys
from euglena.detector import EuglenaDetector
import math

DEBUG    = False


zoomLevel = float(sys.argv[2]) if len(sys.argv) > 2 else 10
lengthFactor = zoomLevel / 10.0
detector = EuglenaDetector(sys.argv[1],zoomLevel)
detector._debug = DEBUG
detector.detect()

#print "frames " + str(len(detector._frameAngles))

T        = 120.0/len(detector._frameAngles)
TRESHOLD = 0.2
STD      = 10 # standard deviation of gaussian noise in measurment
VAR_2 = STD * STD * 2
ONE_OVER_SQRT_2_PI_STD = 1.0 / (STD*np.sqrt(2*math.pi))

if DEBUG:
    import matplotlib.pyplot as plt
    import matplotlib.lines as lines
    import matplotlib.patches as patches

#import pdb

def mog(angles,sampleAngle):
    N = angles.size
    return np.sum(np.exp(-((sampleAngle - np.abs(angles)) ** 2) / (VAR_2))) * ONE_OVER_SQRT_2_PI_STD / N

def angularInvariance(angles):
    dx = np.abs(np.cos(angles*math.pi/180.0))
    dy = np.abs(np.sin(angles*math.pi/180.0))
    ady = np.mean(dy)
    adx = np.mean(dx)
    return np.arctan2(ady,adx)*180.0/math.pi, ady**2 + adx**2

direction = -1
d = []
x = []
y = []
r = []
frameAngles = []
for i in range(len(detector._frameAngles)):
    angles = detector._frameAngles[i]

    if len(angles) > 0:
        npAngles = np.array(angles)
        x.append(i * T)
        frameAngles.append( npAngles )
        if DEBUG:
            totalAngles = len(angles)
            vertical = np.sum(np.abs(npAngles) > 45)
            horizontal = np.sum(np.abs(npAngles) <= 45)

            horizontal = float(horizontal)/totalAngles
            vertical  = float(vertical)/totalAngles

            if( np.abs(horizontal - vertical) > TRESHOLD or direction == -1 ):
                direction = horizontal > vertical

            d.append(direction)
            theta,R = angularInvariance(npAngles)
            y.append(theta)
            r.append(R)

npx = np.array(x)

if DEBUG :
    npy = np.array(y)
    npd = np.array(d)
    npr = np.array(r)

frac = []
expected = [False,True,False,True]
sampleAngles = [90.0,0.0,90.0,0.0]
probs = []
multiplier = STD * np.sqrt(2*math.pi)

if DEBUG:
    plt.figure();

for seg in range(4):
    timeStart = seg * 30 + 15.0
    timeEnd   = (seg+1)*30.0
    idx =np.logical_and(npx >= timeStart, npx < timeEnd).nonzero()[0]
    if len(idx) > 0:
        segAngles = []
        for i in idx:
            segAngles.extend(frameAngles[i])

        #print segAngles
        if sampleAngles[seg] > 45:
            correctAngles = np.sum(np.abs(np.array(segAngles)) > 45.0)
        elif sampleAngles[seg] < 45:
            correctAngles = np.sum(np.abs(np.array(segAngles)) < 45.0)

        segProb = correctAngles / float(len(segAngles))

        probs.append(segProb)

        if DEBUG:
            segment_y = npy[idx]
            f = np.sum(segment_y == expected[seg]) / float(len(segment_y))
            frac.append(f)
    else:
        if DEBUG:
            frac.append(0)

#print np.sum(frac) / 4.0
#print len(npx)
#print probs
if len(probs)  == 4:
    #print min(np.prod(probs) * 1000.0 / 3.0,1.0)
    #print np.prod(probs) * 1000.0 / 3.0
    # print np.sum(probs)
    # print np.prod(probs)
    # print np.log(np.prod(probs)) - 4.0*np.log(0.5)
    # print (np.log(np.prod(probs)) - 4.0*np.log(0.5)) / 4.0

    p = np.prod(probs)
    if np.abs(p) < 1e-3:
        print 0
    else:
        print max( (np.log2(p) + 4.0), 0 )
else:
    print 0.0

# if DEBUG:
#     plt.style.use('ggplot')
#     plt.ioff()
#     fig,ax = plt.subplots()
#     plt.xlim([0,120])
#     plt.ylim([0,90])

#     ax.add_patch(patches.Rectangle((15,0),15,90,alpha=0.1))
#     ax.add_patch(patches.Rectangle((45,0),15,90,alpha=0.1))
#     ax.add_patch(patches.Rectangle((75,0),15,90,alpha=0.1))
#     ax.add_patch(patches.Rectangle((105,0),15,90,alpha=0.1))

#     ax.add_line(lines.Line2D([30,30],  [0,90],linewidth=1,linestyle="--",color='gray'))
#     ax.add_line(lines.Line2D([60,60],  [0,90],linewidth=1,linestyle="--",color='gray'))
#     ax.add_line(lines.Line2D([90,90],  [0,90],linewidth=1,linestyle="--",color='gray'))
#         #this is the horizontal line through 45 degrees
#     ax.add_line(lines.Line2D([0,120],  [45,45],linewidth=2,color='black'))
#     plt.plot(npx,npy)
#     plt.xlabel('Time (sec)')
#     plt.ylabel('Average angle per frame')
#     plt.show()
