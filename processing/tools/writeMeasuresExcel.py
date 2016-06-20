import xlsxwriter
import re
from EuglenaData import *
import sys
import numpy as np

path = sys.argv[1]

measures = ['x','y','vx','vy','s','a','w','h']

if path[-1] != '/':
    path+= '/'

euglena = EuglenaData(path)

validTracks = []
for i in xrange( euglena.getNumTracks() ):
    if len(euglena.getTrackAt(i)['samples']) > 10:
        validTracks.append( euglena.getTrackAt(i))

validTracks = sorted(validTracks,cmp=lambda a,b: a['startFrame']  -  b['startFrame'])

print "%d/%d"%(len(validTracks),euglena.getNumTracks())



T = 1.0 / euglena.getFPS()
UMPP = euglena.getUMPP()

hasLeds = True

units = {
    'x' : 'um',
    'y' : 'um',
    'vx' : 'um/sec',
    'vy' : 'um/sec',
    's' : 'um/sec',
    'a' : 'degrees',
    'top' : '%',
    'right' : '%',
    'bottom' : '%',
    'left' : '%',
    'h': 'um',
    'w' : 'um',
    't' : 'sec'
}

def writeAllOnSameSheet(workbook):
    worksheet = workbook.add_worksheet()
    data = {}
    row = 0
    for i, track in enumerate(validTracks):
        x, y, w, h, a, f = np.array(euglena.extractTrackData(track))

        x = x * UMPP
        y = y * UMPP
        w = w * UMPP
        h = h * UMPP

        dt = f[1:] - f[:-1] * T

        if hasLeds:
            ledStates = [euglena.getLedStateFromFrame(fr) for fr in f]
            data['top'], data['right'], data['bottom'], data['left'] = zip(*ledStates)

        data['width'] = w;
        data['height'] = h;
        data['x'] = x;
        data['y'] = y;
        data['vx'] = vx = (x[1:] - x[:-1]) / dt
        data['vy'] = vy = y[1:] - y[:-1] / dt
        data['s'] = np.sqrt(vx * vx + vy * vy)
        data['a'] = a

        startCol = 0

        worksheet.merge_range(row, startCol, row, startCol + len(measures) + 1, '#%d' % (track['trackID']),
                              merge_format)

        row += 1

        worksheet.write(row, startCol, 'frame (#)', header_format)
        worksheet.write(row, startCol + 1, 'time (s)', header_format)

        for c, item in enumerate(measures):
            worksheet.write(row, startCol + 2 + c, "%s (%s)" % (item, units[item]), header_format)

        row += 1

        for j in xrange(len(f)):
            worksheet.write(row, startCol, f[j]);
            worksheet.write(row, startCol + 1, f[j] * T);

            for c, item in enumerate(measures):
                if item in ('vx', 'vy', 's'):
                    if j > 0:
                        worksheet.write(row, startCol + 2 + c, data[item][j - 1]);
                    else:
                        worksheet.write(row, startCol + 2 + c, '');
                else:
                    worksheet.write(row, startCol + 2 + c, data[item][j]);
            row += 1

        row += 1

def writeNewFormat(worbook,validTracks):
    worksheets = {}
    for m in measures:
        worksheets[m] = workbook.add_worksheet(m);


    for m in measures:
        worksheets[m].write(0,0,'frame (#)',header_format)
        worksheets[m].write(0,1, 'time (%s)'%(units['t']),header_format)
        worksheets[m].write(0, 2, 'top (%s)' % (units['top']),header_format)
        worksheets[m].write(0, 3, 'right (%s)' % (units['right']),header_format)
        worksheets[m].write(0, 4, 'bottom (%s)' % (units['bottom']),header_format)
        worksheets[m].write(0, 5, 'left (%s)' % (units['left']),header_format)

    row = 1;
    deltaMeasures = ('vx', 'vy', 's')
    data = {}
    frameLeds = {}

    for i, track in enumerate(validTracks):
        trackId = track['trackID']
        x, y, w, h, a, frames = np.array(euglena.extractTrackData(track))

        data['x'] = x = x * UMPP
        data['y'] = y = y * UMPP
        data['w'] = w = w * UMPP
        data['h'] = h = h * UMPP
        data['a'] = a

        frames = np.array(frames, dtype=np.int)
        dt = (frames[1:] - frames[:-1]) * T
        vx = (x[1:] - x[:-1]) / dt
        vy = (y[1:] - y[:-1]) / dt
        s = np.sqrt(vx * vx + vy * vy)

        data['vx'] = vx
        data['vy'] = vy
        data['s'] = s

        for n, f in enumerate(frames):

            if f not in frameLeds:
                frameLeds[f] = leds = euglena.getLedStateFromFrame(f)
            else:
                leds = frameLeds[f]

            for m in measures:
                sheet = worksheets[m]

                sheet.write(row, 0, f)
                sheet.write(row, 1, f * T)
                for c,l in enumerate(leds):
                    sheet.write(row,2+c,l)
                sheet.write(row, 6, 'X%d'%(trackId))

                if m in deltaMeasures:
                    if n > 0:
                        value = data[m][n - 1]
                    else:
                        value = ''
                else:
                    value = data[m][n]

                sheet.write(row,7,value)

            row += 1

def writeTracks(workbook,validTracks,measures):

    header_format = workbook.add_format({'bold': 1})

    worksheets = {}
    for m in measures:
        worksheets[m] = workbook.add_worksheet(m);

    frameData = {}
    trackData = []
    allTracks = set(range(len(validTracks)))
    deltaMeasures = ('vx','vy','s')
    allFrames = range(euglena.getNumFrames())
    frameData = [[] for i in range(euglena.getNumFrames())]

    for i, track in enumerate(validTracks):
        x, y, w, h, a, frames = np.array(euglena.extractTrackData(track))

        x = x * UMPP
        y = y * UMPP
        w = w * UMPP
        h = h * UMPP

        frames = np.array(frames,dtype=np.int)
        dt = (frames[1:] - frames[:-1]) * T
        vx = (x[1:] - x[:-1]) / dt
        vy = (y[1:] - y[:-1]) / dt
        s = np.sqrt(vx * vx + vy * vy)

        for j,f in enumerate(frames):
            frameData[f-1].append( (i,j) )

        trackData.append( {'x': x, 'y':y, 'vx':vx, 'vy':vy, 's':s, 'a':a, 'w':w, 'h':h, } )

    # allFrames = sorted(frameData.keys(), lambda x,y: x - y )


    for m in measures:
        # worksheets[m].write(0,0,'Variable',header_format)
        # worksheets[m].write(0, 1, m)
        #
        # worksheets[m].write(1, 0, 'Unit',header_format)
        # worksheets[m].write(1, 1, units[m])

        worksheets[m].write(0, 0, 'frame (#)',header_format)
        worksheets[m].write(0, 1, 'time (s)',header_format)
        worksheets[m].write(0, 2, 'top (%)',header_format)
        worksheets[m].write(0, 3, 'right (%)',header_format)
        worksheets[m].write(0, 4, 'bottom (%)',header_format)
        worksheets[m].write(0, 5, 'left (%)',header_format)

        for t in allTracks:
            worksheets[m].write(0, t + 6, validTracks[t]['trackID'],header_format)

        for r, f in enumerate(allFrames):
            row =  r + 1
            trackSampleList = frameData[f]
            leds = euglena.getLedStateFromFrame(f);

            # nonEmptyTracks = set( t[0] for t in trackSampleList )

            worksheets[m].write(row, 0, f)
            worksheets[m].write(row, 1, f * T)
            for c,l in enumerate(leds):
                worksheets[m].write(row, 2+c, l)

            for trackSample in trackSampleList:
                trackId,sampleId = trackSample

                if m in deltaMeasures:
                    if sampleId > 0:
                        value = trackData[trackId][m][sampleId-1]
                    else:
                        value = ''
                else:
                    value = trackData[trackId][m][sampleId]

                worksheets[m].write( row, trackId + 6, value )

def writeFlatSheetsAggregate(workbook,validTracks,measures):

    header_format = workbook.add_format({'bold': 1})
    worksheets = {}
    for m in measures:
        worksheets[m] = workbook.add_worksheet(m);

    allFrames = range(euglena.getNumFrames())
    frameData = [[] for i in range(euglena.getNumFrames())]

    trackData = []
    allTracks = set(range(len(validTracks)))
    deltaMeasures = ('vx','vy','s')
    trackLengths = {}
    maxDisplaySamples = 0
    displayOffset = 10

    for i, track in enumerate(validTracks):
        x, y, w, h, a, frames = np.array(euglena.extractTrackData(track))

        x = x * UMPP
        y = y * UMPP
        w = w * UMPP
        h = h * UMPP

        if i not in trackLengths:
            trackLengths[i] = 0;

        trackLengths[i] = len(frames);

        frames = np.array(frames,dtype=np.int)
        dt = (frames[1:] - frames[:-1]) * T
        vx = (x[1:] - x[:-1]) / dt
        vy = (y[1:] - y[:-1]) / dt
        s = np.sqrt(vx * vx + vy * vy)

        for j,f in enumerate(frames):
            frameData[f-1].append( (i,j) )

        trackData.append( {'x': x, 'y':y, 'vx':vx, 'vy':vy, 's':s, 'a':a, 'w':w, 'h':h, } )



    for m in measures:
        # worksheets[m].write(0,0,'Variable',header_format)
        # worksheets[m].write(0, 1, m)
        #
        # worksheets[m].write(1, 0, 'Unit',header_format)
        # worksheets[m].write(1, 1, units[m])

        worksheets[m].write(0, 0, 'frame (#)',header_format)
        worksheets[m].write(0, 1, 'time (s)',header_format)
        worksheets[m].write(0, 2, 'top (%)',header_format)
        worksheets[m].write(0, 3, 'right (%)',header_format)
        worksheets[m].write(0, 4, 'bottom (%)',header_format)
        worksheets[m].write(0, 5, 'left (%)',header_format)
        worksheets[m].write(0, 6, 'Mean (%s)'%(units[m]), header_format)
        worksheets[m].write(0, 7, 'Std (%s)'%(units[m]), header_format)
        worksheets[m].write(0, 8, 'N (#)', header_format)

        for ii in range(maxDisplaySamples):
            worksheets[m].write(0, ii + displayOffset, 'Sample %d (%s)'%(ii,units[m]), header_format)

        for r, f in enumerate(allFrames):
            row =  r + 1
            trackSampleList = frameData[f]
            leds = euglena.getLedStateFromFrame(f);

            # nonEmptyTracks = set( t[0] for t in trackSampleList )

            worksheets[m].write(row, 0, f)
            worksheets[m].write(row, 1, f * T)
            for c,l in enumerate(leds):
                worksheets[m].write(row, 2+c, l)


            values = []
            lengthArray = []
            for trackSample in trackSampleList:
                trackId,sampleId = trackSample

                if m in deltaMeasures:
                    if sampleId > 0:
                        value = trackData[trackId][m][sampleId-1]
                        values.append( value )
                        lengthArray.append((trackLengths[trackId], trackSample))
                else:
                    value = trackData[trackId][m][sampleId]
                    values.append(value)
                    lengthArray.append((trackLengths[trackId], trackSample))

            N = len(values)
            mean = np.mean(values) if N > 0 else ''
            std = np.std(values) if N > 0 else ''

            worksheets[m].write(row, 0 + 6, mean )
            worksheets[m].write(row, 1 + 6, std)
            worksheets[m].write(row, 2 + 6, N)

            sortedTracks = sorted( lengthArray, key=lambda x: x[0], reverse=True)

            for tt in range(min(len(sortedTracks), maxDisplaySamples)):
                trackSample = sortedTracks[tt]
                trackId     =     trackSample[1][0]
                sampleId    = trackSample[1][1]

                if m in deltaMeasures:
                    if sampleId > 0:
                        value = trackData[trackId][m][sampleId - 1]
                    else:
                        value = ''

                else:
                    value = trackData[trackId][m][sampleId]

                worksheets[m].write(row, tt + displayOffset, value )


def writeFlatSheetsAggregateBatchMesures(workbook,validTracks,measures):

    header_format = workbook.add_format({'bold': 1})
    worksheet = workbook.add_worksheet(','.join(measures));

    allFrames = range(euglena.getNumFrames())
    frameData = [[] for i in range(euglena.getNumFrames())]

    trackData = []
    allTracks = set(range(len(validTracks)))
    deltaMeasures = ('vx','vy','s')
    trackLengths = {}
    maxDisplaySamples = 0
    displayOffset = 10

    for i, track in enumerate(validTracks):
        x, y, w, h, a, frames = np.array(euglena.extractTrackData(track))

        x = x * UMPP
        y = y * UMPP
        w = w * UMPP
        h = h * UMPP

        if i not in trackLengths:
            trackLengths[i] = 0;

        trackLengths[i] = len(frames);

        frames = np.array(frames,dtype=np.int)
        dt = (frames[1:] - frames[:-1]) * T
        vx = (x[1:] - x[:-1]) / dt
        vy = (y[1:] - y[:-1]) / dt
        s = np.sqrt(vx * vx + vy * vy)

        for j,f in enumerate(frames):
            frameData[f-1].append( (i,j) )

        trackData.append( {'x': x, 'y':y, 'vx':vx, 'vy':vy, 's':s, 'a':a, 'w':w, 'h':h, } )

    worksheet.write(0, 0, 'frame (#)', header_format)
    worksheet.write(0, 1, 'time (s)', header_format)
    worksheet.write(0, 2, 'top (%)', header_format)
    worksheet.write(0, 3, 'right (%)', header_format)
    worksheet.write(0, 4, 'bottom (%)', header_format)
    worksheet.write(0, 5, 'left (%)', header_format)

    for n_m, m in enumerate(measures):
        worksheet.write(0, 6+n_m, '%s Mean (%s)' % (m,units[m]), header_format)
        worksheet.write(0, 6+len(measures) + n_m, '%s Std (%s)' % (m,units[m]), header_format)
        worksheet.write(0, 6+len(measures)*2, 'N (#)', header_format)


    for r, f in enumerate(allFrames):
        row = r + 1
        trackSampleList = frameData[f]
        leds = euglena.getLedStateFromFrame(f);

        for n_m, m in enumerate(measures):

            worksheet.write(row, 0, f)
            worksheet.write(row, 1, f * T)
            for c,l in enumerate(leds):
                worksheet.write(row, 2+c, l)

            values = []
            lengthArray = []
            for trackSample in trackSampleList:
                trackId,sampleId = trackSample

                if m in deltaMeasures:
                    if sampleId > 0:
                        value = trackData[trackId][m][sampleId-1]
                        values.append( value )
                        lengthArray.append((trackLengths[trackId], trackSample))
                else:
                    value = trackData[trackId][m][sampleId]
                    values.append(value)
                    lengthArray.append((trackLengths[trackId], trackSample))

            N = len(values)
            mean = np.mean(values) if N > 0 else ''
            std = np.std(values) if N > 0 else ''

            worksheet.write(row, n_m + 6, mean )
            worksheet.write(row, n_m + len(measures) + 6, std)

        worksheet.write(row,  6 + len(measures)*2, N)


def writeOnDifferentWorksheets(workbook):
    worksheets = {}

    for m in measures:
        worksheets[m] = workbook.add_worksheet(m);

    data = {}
    for i, track in enumerate(validTracks):
        x, y, w, h, a, f = np.array(euglena.extractTrackData(track))
        x = x * UMPP
        y = y * UMPP
        w = w * UMPP
        h = h * UMPP

        dt = f[1:] - f[:-1] * T

        if hasLeds:
            ledStates = [euglena.getLedStateFromFrame(fr) for fr in f]
            data['top'], data['right'], data['bottom'], data['left'] = zip(*ledStates)

        data['w'] = w;
        data['h'] = h;
        data['x'] = x;
        data['y'] = y;
        data['vx'] = vx = (x[1:] - x[:-1]) / dt
        data['vy'] = vy = y[1:] - y[:-1] / dt
        data['s'] = np.sqrt(vx * vx + vy * vy)
        data['a'] = a

        startCol = i*3

        for item in measures:
            worksheets[item].merge_range(0, startCol, 0, startCol + 2, '#%d' % (track['trackID']),
                                  merge_format)

            #worksheets[item].write(1, startCol, 'frame (#)', header_format)
            worksheets[item].write(1, startCol + 0, 'time (s)', header_format)
            worksheets[item].write(1, startCol + 1, 'LEDS %(t,r,b,l)', header_format)


        for item in measures:
            worksheets[item].write(1, startCol + 2, "%s (%s)" % (item, units[item]), header_format)

        for j in xrange(len(f)):
            for item in measures:
                #worksheets[item].write(j+2, startCol, f[j]);
                worksheets[item].write(j+2, startCol + 0, f[j] * T);
                worksheets[item].write(j+2, startCol + 1, '%d,%d,%d,%d'%(data['top'][j],data['right'][j],data['bottom'][j],data['left'][j]));

                if item in ('vx', 'vy', 's'):
                    if j > 0:
                        worksheets[item].write(j+2, startCol + 2, data[item][j - 1]);
                    else:
                        worksheets[item].write(j+2, startCol + 2, '');
                else:
                    worksheets[item].write(j+2, startCol + 2, data[item][j]);


def writeAllTracksAndAllMeasures():
    dest = path + 'Track_Everything_Time_Series.xlsx'
    workbook = xlsxwriter.Workbook(dest)
    writeTracks(workbook, validTracks, measures)
    workbook.close()


def writeDataSet1():
    dest = path + 'Track_Speed_Time_Series.xlsx'
    workbook = xlsxwriter.Workbook(dest)
    writeTracks(workbook, validTracks, ['s',])
    workbook.close()

def writeDataSet2():
    dest = path + 'Speed_Aggregate_Mean_Std_Time_Series.xlsx'
    workbook = xlsxwriter.Workbook(dest)
    writeFlatSheetsAggregate(workbook, validTracks, ['s',])
    workbook.close()

def writeDataSet3():
    dest = path + 'Velocity_Aggregate_Mean_Std_Time_Series.xlsx'
    workbook = xlsxwriter.Workbook(dest)
    writeFlatSheetsAggregateBatchMesures(workbook, validTracks, ['vx','vy'])
    workbook.close()

try:
    writeAllTracksAndAllMeasures()
    writeDataSet1()
    writeDataSet2()
    writeDataSet3()
except:
    print "Something bad happened while processing Excel files"
