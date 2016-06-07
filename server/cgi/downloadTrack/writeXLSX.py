import xlsxwriter
import re
from EuglenaData import *
import sys

header = ('frame#','time (sec)','center_x (um)','center_y (um)','width (um)','height (um)','angle (degrees)','topLED','rightLED','bottomLED','leftLED')

def writeTrack(workbook,euglena, trackId):
    track = euglena.getTrackByID(trackId)

    if track:
        worksheet = workbook.add_worksheet(str(trackId));

        x,y,w,h,a,f = euglena.extractTrackData(track)

        umpp = euglena.getUMPP()
        period = 1.0 / euglena.getFPS()

        x = [ xx * umpp for xx in x  ]
        y = [ yy * umpp for yy in y  ]
        w = [ ww * umpp for ww in w  ]
        h = [ hh * umpp for hh in h  ]
        t = [ tt * period for tt in f]

        ledStates = [euglena.getLedStateFromFrame(fr) for fr in f]

        rows = zip(f,t,x,y,w,h,a)

        for j in range(len(header)):
                worksheet.write(0,j,header[j])

        for i,r in enumerate(rows):
            data = list(r)
            data.extend(ledStates[i])

            for j,c in enumerate(data):
                worksheet.write(i+1,j,c)

def parseRange(token):
    try:
        idx = token.rfind('-')
        firstNumber = int(token[0:idx])
        secondNumber = int(token[idx+1:len(token)])
        firstNumber = max(firstNumber,0)
        if firstNumber <= secondNumber:
            return range(firstNumber,secondNumber+1)
        else:
            return []
    except:
        return []
    return []

def parse(trackIdStr):
    tokens = [ s.strip() for s in re.split(r'[; \t]',trackIdStr) ]
    tokens  = filter(lambda a: len(a) > 0, tokens)
    ids = []
    for token in tokens:
        if token.rfind('-') > 0:
            idRange = parseRange(token)
            ids.extend(idRange)
        else:
            try:
                n = int(token)
                if n >=0:
                    ids.append(n)
            except:
                pass
    return sorted(list(set(ids)))

path = sys.argv[1]
dest = sys.argv[2]
trackIdStr = sys.argv[3]

if path[-1] != '/':
    path+= '/'

e = EuglenaData(path)

trackIds = parse(trackIdStr)


if len(trackIds) > 100:
   trackIds = trackIds[:99]

workbook = xlsxwriter.Workbook(dest)
for t in trackIds:
  writeTrack(workbook, e, t)

workbook.close()

