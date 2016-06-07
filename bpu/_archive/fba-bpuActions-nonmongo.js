var os=require('os');
var fs=require('fs');
var exec=require('child_process').exec;
var targz=require('tar.gz');

var app=null;
var bpu=null;

exports.setApp=function(pApp) {
  app=pApp;
};

exports.setBpu=function(pBpu) {
  bpu=pBpu;
  toggleWebCamSave('stop', false, function() {});
  //toggleWebCamSave('start', true, function() {});
};

//Actions
exports.doExperiment=function(cb_fn) {
  toggleWebCamSave('start', bpu.theOnlyExperiment.groupSettings.doSaveImages, function(err) {
    if(err) {
      cb_fn('toggleWebCamSave err:'+err);  
    } else {
      var run=function() { 
        if(!bpu.doFullStop) {
          var startTime=new Date().getTime();
          var runTime=0;
          bpu.theOnlyExperiment.experimentInfo.startTime=startTime;
          app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
            if(err) {
              bpu.mpErr('mongo save err:'+err);
            }
            var setNextLed=function() {
              var ld=bpu.theOnlyExperiment.eventsToRun.shift();
              var timeNow=new Date().getTime();
              ld.setTime=timeNow-startTime;
              ld.askTime=ld.time;
              var newLd=bpu.ledsSet(ld);
              bpu.addToEventsRan(newLd);
              if(bpu.theOnlyExperiment.eventsToRun.length>0) {
                if(!bpu.doFullStop) {
                  setTimeout(setNextLed, bpu.theOnlyExperiment.eventsToRun[0].time-ld.setTime);
                  } else {
                    cb_fn('doFullStop');
                  }
              } else {
                bpu.myStatus=bpu.MyStatuses.expRunningDone;
                if(app.isInitialized && app.hasConnection && app.socket!==null) {
                  if(app.socket!==null && app.socket!==undefined) {
                    app.socket.myInternalEmits.expRunningDone('doExperiment');
                  }
                }
                var stop=function() {
                  toggleWebCamSave('stop', bpu.theOnlyExperiment.groupSettings.doSaveImages, function(err) {
                    if(err) {
                      bpu.mpErr('action_doExperiment:toggleWebCamSave stop err:'+err)
                    }
                    bpu.theOnlyExperiment.experimentInfo.endRunDate=new Date().getTime();
                    bpu.theOnlyExperiment.experimentInfo.isOver=true;
                    app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
                      if(err) {
                        bpu.mpErr('mongo save err:'+err);
                      }
                      cb_fn(null);
                    });
                  });
                }
                setTimeout(stop, 500);
              }
            }
            setNextLed();
          });
        } else {
          cb_fn('doFullStop');
        }
      };
      setTimeout(run, 500);
    }
  });
};
exports.closeExperiment=function(cb_fn) {
  var compressImages=function() {
    console.log('compress images');
    if(bpu.theOnlyExperiment.groupSettings.doSaveImages || bpu.theOnlyExperiment.groupSettings.doSaveLightData) {
      var filename=getBpuTarFilename(bpu.theOnlyExperiment);
      var dataPath=bpu.myDataLocs.bpuSaveDir_tars+'/'+filename;
      var didSoapRename=false;
      var finishCompress=function(imagesPath) {
        console.log(imagesPath);
        console.log(dataPath);
        var compress=new targz().compress(imagesPath, dataPath, function(err) {
          if(err) {
            if(didSoapRename) {
              var cmd='mv -r  /myData/bpu/'+bpu.theOnlyExperiment.soapId+' /myData/bpu/images';
              runBashCommand(cmd, function(err, stdout) {
                if(err) {
                  console.log('action_closeExperiment unmove mv soapId err:'+err);
                  cb_fn('action_closeExperiment compress err:'+err);
                } else {
                  cb_fn('action_closeExperiment compress err:'+err);
                }
              });
            } else {
              cb_fn('action_closeExperiment compress err:'+err);
            }
          } else {
            bpu.theOnlyExperiment.experimentInfo.dataParentFolder=bpu.myDataLocs.bpuSaveDir_tars;
            bpu.theOnlyExperiment.experimentInfo.dataFileName=filename;
            bpu.theOnlyExperiment.experimentInfo.dataPath=dataPath;
            app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
              if(err) {
                bpu.mpErr('mongo save err:'+err);
              }
              if(didSoapRename) {
                var cmd='mv /myData/bpu/'+bpu.theOnlyExperiment.soapId+' /myData/bpu/images';
                console.log('cmd 2', cmd);
                runBashCommand(cmd, function(err, stdout) {
                  if(err) {
                    console.log('action_closeExperiment unmove mv soapId err:'+err);
                    cb_fn(null);
                  } else {
                    cb_fn(null);
                  }
                });
              } else {
                cb_fn(null);
              }
            });
          }
        });
      }
      var checkSoapMove=function() {
        if(bpu.theOnlyExperiment.isSoap && bpu.theOnlyExperiment.soapId!==null && bpu.theOnlyExperiment.soapId!=='') {
          var cmd='mv /myData/bpu/images /myData/bpu/'+bpu.theOnlyExperiment.soapId;
          console.log('cmd 1', cmd);
          runBashCommand(cmd, function(err, stdout) {
            if(err) {
              console.log('action_closeExperiment move mv soapId err:'+err);
              finishCompress(bpu.myDataLocs.bpuSaveDir_images); 
            } else {
              didSoapRename=true;
              imagesPath=bpu.myDataLocs.bpuSaveDir+'/'+bpu.theOnlyExperiment.soapId;
              finishCompress(bpu.myDataLocs.bpuSaveDir+'/'+bpu.theOnlyExperiment.soapId); 
            }
          });  
        } else {
          finishCompress(bpu.myDataLocs.bpuSaveDir_images); 
        }
      };
      checkSoapMove();
    } else {
      //cb_fn(null);
    }
  };

  var moveImagesToTemp=function() {
    if(bpu.theOnlyExperiment.groupSettings.doSaveImages) {
      var renameScriptPath=bpu.myDataLocs.bpuSaveDir+'/'+'rename.sh';
      fs.stat(renameScriptPath, function(err, dat) {
        var doRename=function() {
          runBashCommand(renameScriptPath, function(err, stdout) {
            if(err) {
              cb_fn('action_closeEperiment rename command err:'+err);
            } else {
              compressImages() 
            }
          });   
        };
        if(err) {
          cb_fn('action_closeEperiment rename stat err:'+err);
        } else {
          doRename();
        }
      });   
    } else {
      compressImages();
    }
  };

  var saveData=function() {
    if(bpu.theOnlyExperiment.groupSettings.doSaveLightData) {
      fs.writeFile(bpu.myDataLocs.bpuSaveDir_images+'/'+'lightdata.json', JSON.stringify(bpu.theOnlyExperiment.eventsRan, null, 4), function(err) {
        if(err) {
          cb_fn('writeFile '+bpu.myDataLocs.bpuSaveDir_images+'/'+'lightdata.json err:'+err);
        } else {
          bpu.theOnlyExperiment.experimentInfo.hasLightDataJson=true;
          app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
            if(err) {
              bpu.mpErr('mongo save err:'+err);
            }
            moveImagesToTemp();
          });
        }
      });
    } else {
      moveImagesToTemp();
    }
  }
  saveData();
};
exports.checkProcessing=function(cb_fn) {
  bpu.myStatus=bpu.MyStatuses.dataProcessing;
  var doDebugRand=false; 
  var doIgnoreScriptError=true; 
  var scripts=JSON.parse(JSON.stringify(bpu.theOnlyExperiment.experimentInfo.scripts));
  var zoomLevel=app.bpuConfig.magnification;
  var next=function() {
    if(scripts.length>0) {
      runScript(scripts.shift(), zoomLevel, doDebugRand, doIgnoreScriptError, function(err) {
        if(err) {
          bpu.myStatus=bpu.MyStatuses.dataProcessingFailed;
          returnErr(script+' script err:'+err);
        } else {
          next();
        }
      });
    } else {
      bpu.mp('population:'+bpu.theOnlyExperiment.stats.population);
      bpu.mp('activity:'+bpu.theOnlyExperiment.stats.activity);
      bpu.mp('response:'+bpu.theOnlyExperiment.stats.response);
      cb_fn(null);
    }
  };
  next();
};
exports.cleanWebcamFolders=function(callback) {
  var folders=[bpu.myDataLocs.bpuSaveDir_images, bpu.myDataLocs.bpuSaveDir_temp]
  var doDelete=true;
  createFolders(folders, doDelete, function(err) {
    if(err) {
      callback('createFolders:'+bpu.myDataLocs.bpuSaveDir_images+':'+err);
    } else {
      callback(null);
    }
  });
};
exports.moveFakeDataToReady=function(cb_fn) {
  var cmd='mv '+bpu.theOnlyExperiment.bpuFakeMongoPath+' '+bpu.myDataLocs.bpuSaveDir_readyMongo;
  runBashCommand(cmd, function(err, stdout) {
    if(err) {
      cb_fn('moveFakeDataToReady err:'+err);
    } else {
      cb_fn(null);
    }
  });
};
exports.clearDataFolders=function(cb_fn) {
  var fldsToDel=[
    bpu.myDataLocs.bpuSaveDir_tars,
    bpu.myDataLocs.bpuSaveDir_temp,
    bpu.myDataLocs.bpuSaveDir_images,
    bpu.myDataLocs.bpuSaveDir_fakeMongo,
    bpu.myDataLocs.bpuSaveDir_readyMongo,
  ]; 
  var doDelete=true;
  createFolders(fldsToDel, doDelete, function(err) {
    cb_fn(err);
  });
};
exports.checkDataFolders=function(cb_fn) {
  var fldsToCheck=[
    bpu.myDataLocs.bpuSaveDir,
    bpu.myDataLocs.bpuSaveDir_tars,
    bpu.myDataLocs.bpuSaveDir_temp,
    bpu.myDataLocs.bpuSaveDir_images,
    bpu.myDataLocs.bpuSaveDir_fakeMongo,
    bpu.myDataLocs.bpuSaveDir_readyMongo,
  ]; 
  var checkFolders=function() {
    if(fldsToCheck.length>0) {
      var fld=fldsToCheck.shift();
      fs.stat(fld, function(err, dat) {
        if(err) {
          if(err.errno===34) {
            var doDelete=false;
            createFolders([fld], doDelete, function(err) {
              if(err) {
                cb_fn(err);
              } else {
                checkFolders();
              }
            });
          } else {
            cb_fn(err);
          }
        } else {
          if(dat.mode!==16895) {
            var chmodCmd='chmod 777 '+fld;
            runBashCommand(chmodCmd, function(err, stdout) {
              if(err) {
                cb_fn(err);
              } else {
                checkFolders();
              }
            });
          } else {
            checkFolders();
          } 
        }
      });
    } else {
      cb_fn(null);
    }
  }; 
  fs.stat(bpu.myDataLocs.mainDataDir, function(err, dat) {
    if(err) {
      cb_fn(err);
    } else {
      if(dat.mode===16895) {
        checkFolders();
      } else if(dat.mode===16877) {
        cb_fn('wrong permissions('+dat.mode+') for '+bpu.myDataLocs.mainDataDir);
      } else {
        cb_fn('unknowm permissions('+dat.mode+') for '+bpu.myDataLocs.mainDataDir);
      }
    }
  });
};
exports.initLedControl=function(cb_fn) {
  console.log('*******************initLedControl**************');
  if(bpu.theOnlyExperiment.debugSettings.doFakeLeds) {
    bpu.ledControl={};
    bpu.ledControl.getIsInitialized=function() {
      return true;
    };
    bpu.ledControl.board={};
    bpu.ledControl.board.ledsSet=function(topValue, rightValue, bottomValue, leftValue) {
      console.log('set fake Leds', topValue, rightValue, bottomValue, leftValue);
    };
    cb_fn(null);
  } else {
    bpu.ledControl.init(bpu.ledControlOptions, function(err) {
      if(err) {
        cb_fn('ledControl:'+err);
      } else {
        cb_fn(null);
      }
    });
  }
};
exports.checkLightDataArray=function(callback) {
  var okay=true; 
  var msg='';
  var lightData=bpu.theOnlyExperiment.eventsToRun;
  if(lightData!==null && typeof lightData==='object' && lightData.length && lightData.length>=2) {
    //Check Keys
    if(okay) {
      lightData.forEach(function(item) {
        if(item.time!==null && item.topValue!==null && item.rightValue!==null && item.bottomValue!==null && item.leftValue!==null) {
          item.time=Number(item.time);
          item.topValue=Number(item.topValue);
          item.rightValue=Number(item.rightValue);
          item.bottomValue=Number(item.bottomValue);
          item.leftValue=Number(item.leftValue);
        } else {
          okay=false;
          msg='does not have all keys';
        }
      });
    }
    //Check/Normalize Time Keys
    if(okay) {
      lightData.sort(function(a, b) {return a.time-b.time;});
      var firstTime=lightData[0].time;
      lightData.forEach(function(item) {
        item.time-=firstTime; 
      }); 
      if(lightData[0].time===0 ||
        lightData[lightData.length-1].time>=app.mainConfig.minTextFileTime || 
        lightData[lightData.length-1].time<=app.mainConfig.maxTextFileTime) {
      } else {
        okay=false;
        msg='max/min time out of range';
      }
    }
    //Check Light Values
    if(okay) {
      lightData.forEach(function(item) {
        if(item.topValue>100 ||  item.topValue<0) {
          okay=false;
          msg='max/min topValue out of range';
        }
        if(item.rightValue>100 ||  item.rightValue<0) {
          okay=false;
          msg='max/min righ out of range';
        }
        if(item.bottomValue>100 ||  item.bottomValue<0) {
          okay=false;
          msg='max/min bott out of range';
        }
        if(item.leftValue>100 ||  item.leftValue<0) {
          okay=false;
          msg='max/min leftValue out of range';
        }
      }); 
    }
  } else {
    okay=false;
    msg='light data is not array >= 1';
  }
  if(okay) {
    bpu.theOnlyExperiment.eventsToRun=lightData;
    callback(null);
  } else {
    callback(msg);
  }
};


//Simple Functions
var getBpuTarFilename=function(exp) {
  var filename=exp.bpuInfo.nameBpu+'_';
  filename+=exp._id+'_';
  filename+=exp.username+'.tar.gz';
  return filename;
};
var toggleWebCamSave=function(startStop, doSave, cb_fn) {
  if(startStop==='stop' || (startStop==='start' && doSave)){
    var net=require('net');
    var client=new net.Socket();
    client.connect(32000, 'localhost', function() {
      client.write(startStop);
      cb_fn(null);
    });
    client.on('error', function(err) {
      cb_fn(err);
    });
  } else {
    cb_fn(null);
  }
};
var runScript=function(scriptName, zoomLevel, doRand, doIgnoreScriptErr, callback) {
  if(bpu.theOnlyExperiment.groupSettings.doAllowScript) {
    fs.readdir(bpu.myDataLocs.bpuSaveDir_temp, function(err, dat) {
      if(err) {
        callback('readdir '+bpu.myDataLocs.bpuSaveDir_temp+' err:'+err);
      } else if(dat===null || dat.length<=0) {
        callback('readdir '+bpu.myDataLocs.bpuSaveDir_temp+'err:'+'no files');
      } else {
        console.log('..........', zoomLevel);
        if(zoomLevel===null || zoomLevel===undefined) {
          zoomLevel=Number(zoomLevel);
          if(zoomLevel>0 || zoomLevel<100) {
            if(zoomLevel!==4 || zoomLevel!==10) {
              zoomLevel=10;
            } 
          } else {
            zoomLevel=10;
          }
        }
        var cmd='python ../shared/python-scripts/'+scriptName+'.py /myData/bpu/temp '+zoomLevel;
        console.log('..........', cmd);
        if(doRand) {
          cmd+=' d t';
        }
        runBashCommand(cmd, function(err, stdout) {
          if(err) {
            if(doIgnoreScriptErr) {
              bpu.mp(scriptName+' err ignored:'+err);
              bpu.theOnlyExperiment.stats[scriptName]=-2;
              bpu.theOnlyExperiment.experimentInfo.hasStats=true;
              app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
                if(err) {
                  bpu.mpErr('mongo save err:'+err);
                }
                callback(null);
              });
            } else {
              callback(err);
            }
          } else {
            bpu.theOnlyExperiment.stats[scriptName]=Number(stdout);
            bpu.theOnlyExperiment.experimentInfo.hasStats=true;
            app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
              if(err) {
                bpu.mpErr('mongo save err:'+err);
              }
              callback(null);
            });
          }
        });
      }
    });
  } else {
    callback(null);
  }
}
var runBashCommand=function(cmdStr, callback) {
  var child=exec(cmdStr, function (error, stdout, stderr) {
    if(error!==null) {callback('error: ' + stderr, stdout);
    } else if(stderr) {callback('stderr: ' + stderr, stdout);
    } else if(stdout) {callback(null, stdout);
    } else {callback(null, null);}
  });
};
var deleteFolders=function(folders, callback) {
  var next=function() {
    if(folders.length>0) {
      var folder=folders.shift();
      var deleteCmd='rm -r '+folder;
      runBashCommand(deleteCmd, function(err, stdout) {
        if(err) {
          callback(err);
        } else {
          next();
        }
      });
    } else {
      callback(null);
    }
  };
  if(folders!==null && typeof folders!=='string' && folders.length && folders.length>0) {
    next();
  } else {
    callback('takes an array of folders names');
  }
};
var createFolders=function(folders, doDelete, callback) {
  var next=function() {
    if(folders.length>0) {
      var folder=folders.shift();
      var createCmd='mkdir '+folder+' && chmod 777 '+folder;
      runBashCommand(createCmd, function(err, stdout) {
        if(err) {
          callback(err);
        } else {
          next();
        }
      });
    } else {
      callback(null);
    }
  };
  if(folders!==null && typeof folders!=='string' && folders.length && folders.length>0) {
    if(doDelete) {
      var delFolders=[]
      folders.forEach(function(item) {delFolders.push(item);});
      deleteFolders(delFolders, function(err) {
        if(err) {
          callback('deleteFolders'+':'+err);
        } else {
          next();
        }
      });
    } else {
      next();
    }
  } else {
    callback('takes an array of folders names');
  }
};
