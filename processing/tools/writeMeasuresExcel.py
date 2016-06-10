import xlsxwriter
import re
from EuglenaData import *
import sys
import numpy as np

path = sys.argv[1]

measures = ['x','y','vx','vy','s','a','width','height']

if path[-1] != '/':
    path+= '/'

euglena = EuglenaData(path)

validTracks = []
for i in xrange( euglena.getNumTracks() ):
    if len(euglena.getTrackAt(i)['samples']) > 10:
        validTracks.append( euglena.getTrackAt(i))

validTracks = sorted(validTracks,cmp=lambda a,b: b['numSamples']  -  a['numSamples'])

print "%d/%d"%(len(validTracks),euglena.getNumTracks())
dest = path + 'VelocityAndOrientations.xlsx'
workbook = xlsxwriter.Workbook(dest)

T = 1.0 / euglena.getFPS()

hasLeds = True


merge_format = workbook.add_format({'align': 'left','fg_color':'yellow','bold':1})
header_format = workbook.add_format({'bold':1})
units = {
    'x' : 'um',
    'y' : 'um',
    'vx' : 'um/s',
    'vy' : 'um/s',
    's' : 'um/s',
    'a' : 'deg',
    'top' : '%',
    'right' : '%',
    'bottom' : '%',
    'left' : '%',
    'height': 'um',
    'width' : 'um'
}
def writeAllOnSameSheet(workbook):
    worksheet = workbook.add_worksheet()
    data = {}
    row = 0
    for i, track in enumerate(validTracks):
        x, y, w, h, a, f = np.array(euglena.extractTrackData(track))
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

def writeOnDifferentWorksheets(workbook):
    worksheets = {}

    for m in measures:
        worksheets[m] = workbook.add_worksheet(m);

    data = {}
    for i, track in enumerate(validTracks):
        x, y, w, h, a, f = np.array(euglena.extractTrackData(track))
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


# writeAllOnSameSheet(workbook)
writeOnDifferentWorksheets(workbook)
workbook.close()


