from __future__ import print_function
import sys

import os
import json
import copy
import csv

def warning(*objs):
    print("WARNING: ", *objs, file=sys.stderr)

class EuglenaData(object):
    def __init__(self,path):
        self._maxFrame = 0

        if not path.endswith(os.pathsep):
            path += os.path.sep

        with open(path+"lightdata_meta.json") as fp:
            self._lightData = json.load(fp)

        with open(path+"tracks.json") as fp:
            self._tracks = json.load(fp)

        ## Converting all frame numbers from 1 to N
        for i in xrange(len(self._tracks)):
            self._tracks[i]['startFrame'] += 1
            self._tracks[i]['lastFrame'] += 1
            samples = self._tracks[i]['samples']
            for j in xrange(len(samples)):
                samples[j]['frame'] += 1
                self._maxFrame = max(self._maxFrame, samples[j]['frame'])

        self._zoom = self._lightData['metaData']['magnification']
        self._events = self._lightData['eventsToRun']
        baseTime = self._events[0]['time']
        for i in xrange(len(self._events)):
            self._events[i]['time'] = (self._events[i]['time'] - baseTime) / 1000.0

        self._totalTime = (self._events[-1]['time'])
        self._trackIDtoIndexMap = { t['trackID']:i for i,t in enumerate(self._tracks) }

    def getUMPP(self):
        return 100.0/30.0 * 4.0 / float(self._zoom)


    def getNumTracks(self):
        return len(self._tracks)

    def getNumFrames(self):
        if "numFrames" in self._lightData['metaData']:
            return max(self._maxFrame, self._lightData['metaData']['numFrames'])
        else:
            warning("Use newer version of data, numFrames information doesn't exists")
            return self._maxFrame;

    def getTotalTime(self):
        return self._totalTime

    def getFPS(self):
        return self.getNumFrames() / self.getTotalTime()

    def getMagnification(self):
        return self._zoom

    def findTrackID(self,id):
        return self._trackIDtoIndexMap.get(id,-1)

    def findTracksBetweenFrames(self,startFrame, endFrame):
        return [ t for t in self._tracks if not (( t['startFrame']) > endFrame or (t['lastFrame']) < startFrame) ]


    def getTrackAt(self,index):
        return self._tracks[index]

    def getTrackByID(self,id):
        idx = self.findTrackID(id)
        if idx >= 0:
            return self.getTrackAt( idx )
        else:
            return None


    def extractEuglenaBetweenFrames(self,startFrame,endFrame):
        x = []
        y = []
        w = []
        h = []
        a = []
        f = []

        for t in self._tracks:
            for s in t['samples']:
                if startFrame <=  (s['frame']) <= endFrame:
                    rect = s['rect']
                    x.append(rect[0])
                    y.append(rect[1])
                    w.append(rect[2])
                    h.append(rect[3])
                    a.append(rect[4])
                    f.append(s['frame'])

        return [x,y,w,h,a,f]

    def getLedStateFromTime(self,t):
        i = 0
        while i< len(self._events) and self._events[i]['time'] <= t:
            i += 1

        i -= 1
        if i >= 0:
            return  [self._events[i]['topValue'], self._events[i]['rightValue'], self._events[i]['bottomValue'], self._events[i]['leftValue'] ]

        return 0,0,0,0

    def getLedStateFromFrame(self,frame):
        return self.getLedStateFromTime( frame / self.getFPS() )

    @staticmethod
    def clipTracksBetweenFrames(tracks,startFrame, endFrame):
        clippedTracks = []
        for t in tracks:
            if not (t['startFrame']) > endFrame or (t['lastFrame']) < startFrame:
                if (t['startFrame']) >= startFrame  and (t['lastFrame']) <= endFrame:
                    #completely inside
                    clippedTracks.append( copy.deepcopy(t) )
                else:
                    newTrack = copy.deepcopy(t)
                    newTrack['samples'] =filter(lambda ss: startFrame <= (ss['frame']) <= endFrame, t['samples'] )
                    frames = [ss['frame'] for ss in newTrack['samples']]
                    newTrack["startFrame"] = min(frames)
                    newTrack["lastFrame"] = max(frames)
                    newTrack["numSamples"] = len(frames)
                    clippedTracks.append(newTrack)
            else:
                newTrack = copy.deepcopy(t)
                newTrack['samples'] = []
                newTrack['startFrame'] = -1
                newTrack['lastFrame'] = -1
                newTrack['numSamples'] = 0
                clippedTracks.append(newTrack)

        return clippedTracks

    @staticmethod
    def extractTrackData(track):
        # returns x,y,w,h,a,f
        return zip(*[(s['rect'][0], s['rect'][1], s['rect'][2], s['rect'][3], s['rect'][4], s['frame']) for s in track['samples'] ])

    def writeTrackDataToCSV(self,track,csvfile):
        x,y,w,h,a,f = EuglenaData.extractTrackData(track)

        umpp = self.getUMPP()
        period = 1.0 / self.getFPS()

        x = [ xx * umpp for xx in x  ]
        y = [ yy * umpp for yy in y  ]
        w = [ ww * umpp for ww in w  ]
        h = [ hh * umpp for hh in h  ]
        t = [ tt * period for tt in f]

        # x *= self.getUMPP()
        # y *= self.getUMPP()
        # w *= self.getUMPP()
        # h *= self.getUMPP()


        # t = f / self.getFPS()

        ledStates = [self.getLedStateFromFrame(fr) for fr in f]

        with open(csvfile,'wb') as fb:
            header = ('frame#','time (sec)','center_x (um)','center_y (um)','width (um)','height (um)','angle (degrees)','topLED','rightLED','bottomLED','leftLED')
            wr = csv.writer(fb)
            rows = zip(f,t,x,y,w,h,a)
            wr.writerow(header)
            for i,r in enumerate(rows):
                data = list(r)
                data.extend(ledStates[i])
                wr.writerow(data)
