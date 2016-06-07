var fs=require('fs');
var async=require('async');
var exec=require('child_process').exec;

//File Logging
var fileLogObjects={};
exports.logToFile=function(options, callback) {
  var createNew=function(cb_fn) {
    var readStream=fs.createWriteStream(options.handle, {flags: 'w', encoding: 'utf-8',mode: 0666});
    readStream.on('open', function () {
      if(options.line) {
        readStream.write(options.line);
      }
      cb_fn(null, readStream);
    });
    readStream.on('error', function(err) {
      cb_fn(err, null);
    });
  };
  var writeLine=function(cb_fn) {
    var stream=fileLogObjects[options.handle].readStream;
    if(stream!==null && stream!==undefined) {
      stream.write('\n'+options.line);
      cb_fn(null);
    } else {
      cb_fn('stream DNE');
    }
  };
  if(fileLogObjects[options.handle]) {
    writeLine(function(err) {
      if(err) {
        var err='writeLine err:'+err;
        console.log(err)
      }
      if(callback) {
        callback(err)
      };
    });
  } else {
    createNew(function(err, readStream) {
      if(err) {
        var err='createNew err:'+err;
        console.log(err)
        if(callback) {
          callback(err)
        };
      } else {
        options.readStream=readStream;
        fileLogObjects[options.handle]=options;
        if(callback) {
          callback(null)
        };
      }
    });
  }
};

var cpFile=function(src, dest, callback) {
  var cmd='cp '+src+' '+dest;
  _runBashCommand(cmd, function(err, stdout) {
    if(err) {
      callback('cpFile'+err, null);
    } else {
      callback(null, dest);
    }
  });
};
exports.addFrontZeroToNumber=function(num, len) {
  var strNum=''+num;
  while(strNum.length<len) strNum='0'+strNum;
  return strNum;
};
exports.addFrontSpaceToStr=function(str, len) {
  while(str.length<len) str=' '+str;
  return str;
};
exports.getTimeFromMongoId=function(id, callback) {
  return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
};
exports.getMongoIdFromTime=function(id, callback) {
  return Math.floor(date.getTime() / 1000).toString(16) + "0000000000000000";
};

exports.moveTarToMedia=function(tarName, callback) {
  var src='/myData/mServer/'+tarName;
  var dest='/home/mserver/git/euglenalab/server/public/media/userTars/'+tarName;
  var finalPath='../../media/userTars/'+tarName;
  cpFile(src, dest, function(err, finalDest) {
    callback(err, finalPath);
  });
};

var deleteFile=function(src, callback) {
  fs.unlink(src, function(err) {
    if(err) {
      callback('deleteFile err:'+err);
    } else {
      callback(null);
    }
  });
};
var moveFile=function(src, dest, callback) {
  fs.readFile(src, function(err, data) {
    if(err) {
      callback('moveFile read err:'+err);
    } else {
      fs.writeFile(dest, data, function(err) {
        if(err) {
          callback('moveFile write err:'+err);
        } else {
          deleteFile(src, function(err) {
            if(err) {
              callback('moveFile write err:'+err);
            } else {
              callback(null);
            }
          });
        }
      });
    }
  });
};
exports.moveFiles=function(src, files, dest, mainCallback) {
  if(files.length>0) {
    var errs=[];
    var queue=async.queue(function(task, callback) {
        moveFile(task.src, task.dest, callback);
    }, 20);
    queue.drain=function() {
      console.log('moveFiles: finished with errors '+errs.length);
      if(errs.length>0) {
        mainCallback(errs);
      } else {
        mainCallback(null);
      }
    }
    files.forEach(function(file) {
      var path=src+'/'+file;
      queue.push({src:src+'/'+file, dest:dest+'/'+file}, function(err) {
        console.log('moveFiles: finished move '+file+' with err:'+err);
        if(err) {
          errs.push({path:path, file:file, src:src, err:err});
        }
      });
    });
  } else {
    mainCallback(null);
  }
};

//Exports Only
exports.asyncFunctionTemplate=function(options, action, callback) {
  var didTimeout=false;
  var didComplete=false;
  var tm=setTimeout(function() {
    if(!didComplete) {
      didTimeout=true;
      var err=options.fName+':'+'timed out in '+options.timeoutInterval;
      callback(err);
    }
  }, options.timeoutInterval);
  action(function(err) {
    if(!didTimeout) {
      didCompelte=true;
      clearTimeout(tm);
      callback(err);
    }
  });
};
exports.clearConsole=function() {
  console.log('\033c');
};
exports.getSocket=function(appIo, socketID) {
  var returnSocket=null;

  var keys=Object.keys(appIo.sockets.connected);
  console.log('Number of connected socket ids: ' + keys.length);

  for(var i=0;i<keys.length;i++) {
    var key=keys[i];
    var sock=appIo.sockets.connected[key];
    if(''+sock.id===''+socketID) {
      returnSocket=sock;
      break;
    }
    if(''+sock.id==='/#'+socketID) {
      returnSocket=sock;
      break;
    }
    if('/#'+sock.id===''+socketID) {
      returnSocket=sock;
      break;
    }
  }
  return returnSocket;
};
//Local Exports
var _runBashCommand=function(cmdStr, callback) {
  var child=exec(cmdStr, function (error, stdout, stderr) {
    if(error!==null) {callback('error: ' + stderr, stdout);
    } else if(stderr) {callback('stderr: ' + stderr, stdout);
    } else if(stdout) {callback(null, stdout);
    } else {callback(null, null);}
  });
};
var _cloneObjectArray=function(array, callback) {
  return JSON.parse(JSON.stringify(array));
}

exports.cloneObjectArray=_cloneObjectArray;
exports.runBashCommand=_runBashCommand;

//Local Only
