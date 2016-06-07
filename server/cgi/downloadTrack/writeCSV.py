import numpy as np
import matplotlib.pyplot as plt
from EuglenaData import *

print "Loading data .."

path = sys.argv[1]
trackId = int(sys.argv[2])
dest = sys.argv[3]

if path[-1] != '/':
    path+= '/'

e = EuglenaData(path)

print e.getTotalTime()

print "Extracting track# %d"%(trackId)
singleTrack = e.getTrackByID(trackId)

if singleTrack is None:
    print "Track not found"
    sys.exit(-1)

print "Saving a single track into an Excel file, %s"%(dest)
e.writeTrackDataToCSV(singleTrack,"%s"%(dest))
