var os=require('os');
var fs=require('fs');
var exec=require('child_process').exec;
var targz=require('tar.gz');

var app=null;
var bpu=null;

exports.setApp=function(pApp) {
  app=pApp;
  if(app) app.logger.info('bpuActions.js setApp************************');
};

exports.setBpu=function(pBpu) {
  if(app) app.logger.info('bpuActions.js setBpu************************');
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
          bpu.startTime=startTime;
          var runTime=0;
          bpu.theOnlyExperiment.startRunTime=startTime;
          app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
            if(err) {
              app.logger.error('doExperiment mongo save err:'+err);
            }
            var setNextLed=function() {
              var ld=bpu.theOnlyExperiment.eventsToRun.shift();
              var timeNow=new Date().getTime();
              ld.setTime=timeNow-startTime;
              ld.askTime=ld.time;
              var newLd=bpu.ledsSet(ld, false);
              bpu.addToEventsRan(newLd);
              if(bpu.theOnlyExperiment.eventsToRun.length>0) {
                if(!bpu.doFullStop) {
                  setTimeout(setNextLed, bpu.theOnlyExperiment.eventsToRun[0].time-ld.setTime);
                  } else {
                    cb_fn('doFullStop');
                  }
              } else {
                bpu.myStatus=bpu.MyStatuses.expRunningDone;
                var doReset=true;
                bpu.ledsSet(null, doReset);
                if(app.isInitialized && app.hasConnection && app.socket!==null) {
                  if(app.socket!==null && app.socket!==undefined) {
                    app.socket.myInternalEmits.expRunningDone('doExperiment');
                  }
                }
                var stop=function() {
                  toggleWebCamSave('stop', bpu.theOnlyExperiment.groupSettings.doSaveImages, function(err) {
                    if(err) {
                      app.logger.error('doExperiment toggleWebCamSave stop err:'+err);
                    }
                    bpu.theOnlyExperiment.experimentInfo.endRunDate=new Date().getTime();
                    bpu.theOnlyExperiment.experimentInfo.isOver=true;
                    app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
                      if(err) {
                        app.logger.error('doExperiment stop mongo save err:'+err);
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
  app.logger.info('closeExperiment');
  var numFrames=0; //done at bottom before starting the seq
  var compressImages=function() {
    app.logger.info('closeExperiment compressImages');
    if(bpu.theOnlyExperiment.groupSettings.doSaveImages || bpu.theOnlyExperiment.groupSettings.doSaveLightData) {
      var filename=getBpuTarFilename(bpu.theOnlyExperiment);
      var dataPath=app.myDataLocs.bpuSaveDir_tars+'/'+filename;
      var didSoapRename=false;
      var finishCompress=function(imagesPath, tempSoapFolder) {
        app.logger.info('closeExperiment compressImages finishCompress');
        var compress=new targz().compress(imagesPath, dataPath, function(err) {
          if(err) {
            err='closeExperiment compressImages finishCompress err'+err;
            app.logger.error(err);
            if(didSoapRename) {
              var cmd='mv -r '+tempSoapFolder+' '+app.myDataLocs.bpuSaveDir_images;
              runBashCommand(cmd, function(errSoap, stdout) {
                if(errSoap) cb_fn('closeExperiment compressImages finishCompress didSoapRename errSoap'+errSoap);
                else cb_fn(err);
              });
            } else {
              cb_fn(err);
            }
          } else {
            app.logger.info('closeExperiment compressImages finishCompress');
            bpu.theOnlyExperiment.experimentInfo.dataParentFolder=app.myDataLocs.bpuSaveDir_tars;
            bpu.theOnlyExperiment.experimentInfo.dataFileName=filename;
            bpu.theOnlyExperiment.experimentInfo.dataPath=dataPath;
            app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
              if(err) app.logger.error('closeExperiment compressImages finishCompress save err:'+err);
              if(didSoapRename) {
                var cmd='mv /myData/bpu/'+bpu.theOnlyExperiment.experimentData.soap.id+' /myData/bpu/images';
                runBashCommand(cmd, function(err, stdout) {
                  if(err) {
                    app.logger.error('closeExperiment compressImages finishCompress cmd err:'+err);
                    bpu.theOnlyExperiment.endProcessingDate=new Date();
                    app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
                      if(err) app.logger.error('closeExperiment compressImages finishCompress cmd save err:'+err);
                      cb_fn(null);
                    });
                  } else {
                    bpu.theOnlyExperiment.endProcessingDate=new Date();
                    app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
                      if(err) app.logger.error('closeExperiment compressImages finishCompress cmd save err:'+err);
                      cb_fn(null);
                    });
                  }
                });
              } else {
                bpu.theOnlyExperiment.endProcessingDate=new Date();
                app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
                  if(err) app.logger.error('closeExperiment compressImages finishCompress cmd save err:'+err);
                  cb_fn(null);
                });
              }
            });
          }
        });
      };
      var checkSoapMove=function() {
        app.logger.info('closeExperiment compressImages checkSoapMove');
        if(bpu.theOnlyExperiment.experimentType.isSoap && bpu.theOnlyExperiment.experimentData.soap.id!==null && bpu.theOnlyExperiment.experimentData.soap.id!=='') {
          var soapId=bpu.theOnlyExperiment.experimentData.soap.id;
          var tempSoapFolder=app.myDataLocs.bpuSaveDir+'/'+soapId;
          var cmd='mv '+app.myDataLocs.bpuSaveDir_images+' '+tempSoapFolder;
          runBashCommand(cmd, function(err, stdout) {
            if(err) {
              app.logger.error('closeExperiment compressImages checkSoapMove cmd err:'+err);
              finishCompress(app.myDataLocs.bpuSaveDir_images); 
            } else {
              didSoapRename=true;
              finishCompress(tempSoapFolder, tempSoapFolder); 
            }
          });  
        } else {
          finishCompress(app.myDataLocs.bpuSaveDir_images); 
        }
      };
      checkSoapMove();
    } else {
      cb_fn('not allowed to save/compress');
    }
  };
  var moveImagesToTemp=function() {
    app.logger.info('closeExperiment moveImagesToTemp');
    if(bpu.theOnlyExperiment.groupSettings.doSaveImages) {
      var renameScriptPath=app.myDataLocs.bpuSaveDir+'/'+'rename.sh';
      fs.readdir(app.myDataLocs.bpuSaveDir_images, function(err, files) {
        var jpgFileCount=0;
        files.forEach(function(file) {
          if(file.search('.jpg')>-1) jpgFileCount++;
        });
        fs.stat(renameScriptPath, function(err, dat) {
          var doRename=function() {
            var mkMovie = function() {
              app.logger.info('closeExperiment moveImagesToTemp mkMovie');

	      // ZAHID: We shouldn't sort by setTime because of the weird way we are using sort time !
              //bpu.theOnlyExperiment.eventsRan.sort(function(aObj, bObj) {return aObj.setTime-bObj.setTime;});
              var framesPerSec=bpu.theOnlyExperiment.eventsRan[bpu.theOnlyExperiment.eventsRan.length-1].setTime;
		app.logger.warn('fps1 '+framesPerSec);
		framesPerSec-=bpu.theOnlyExperiment.eventsRan[0].setTime;

		app.logger.warn('fps2 '+framesPerSec);
		app.logger.warn('file count '+jpgFileCount);
              framesPerSec=jpgFileCount/(framesPerSec/1000);
		app.logger.warn('fps3 '+framesPerSec);

              var movieScriptPath=app.myDataLocs.bpuSaveDir+'/'+'movie.sh';
              fs.stat(movieScriptPath, function(err, dat) {
                if(err) {
                  cb_fn('action_closeExperiment movie stat err:'+err);
                } else{
                  movieScriptPath+=' '+framesPerSec;
			app.logger.warn('script', movieScriptPath);
                  runBashCommand(movieScriptPath, function(err, stdout) {
              	    if(err) {
                      app.logger.error('mkMovie script err:'+err);
                    } else {
              	      app.logger.info('mkMovie script stdout:'+stdout);
                    }
                    compressImages();
                  });
                }
              });
            };
            runBashCommand(renameScriptPath, function(err, stdout) {
              if(err) {
                cb_fn('action_closeEperiment rename command err:'+err);
              } else {
                if(bpu.theOnlyExperiment.usergroups.indexOf('nwg')>-1) {compressImages();
                } else {mkMovie();
                }
              }
            });   
          };
          if(err) {
            cb_fn('action_closeEperiment rename stat err:'+err);
          } else {
            doRename();
          }
        });   
      });   
    } else {
      compressImages();
    }
  };
  var saveData=function() {
    app.logger.info('closeExperiment saveData');
    if(bpu.theOnlyExperiment.groupSettings.doSaveLightData) {
      var saveObj={metaData:{}};
      saveObj.eventsToRun=bpu.theOnlyExperiment.eventsRan;
      if(bpu.theOnlyExperiment.metaData===null || bpu.theOnlyExperiment.metaData===undefined) {
        bpu.theOnlyExperiment.metaData={};
      } 
      saveObj.metaData=bpu.theOnlyExperiment.metaData;
      //Dates 
      bpu.theOnlyExperiment.bpuDates.sort(function(aObj, bObj) {return aObj.date-bObj.date;});
      saveObj.metaData.userSubmitDate=new Date(bpu.theOnlyExperiment.experimentInfo.creationDate).getTime();
      saveObj.metaData.startRunDate=bpu.theOnlyExperiment.bpuDates[0].date.getTime();
      saveObj.metaData.endRunDate=bpu.theOnlyExperiment.bpuDates[bpu.theOnlyExperiment.bpuDates.length-1].date.getTime();
      //Time Diffs 
      saveObj.metaData.submitToRunTime=saveObj.metaData.startRunDate-saveObj.metaData.userSubmitDate;
      saveObj.metaData.runToEndRunTime=saveObj.metaData.endRunDate-saveObj.metaData.startRunDate;
      //Other data 
      saveObj.metaData.expId=bpu.theOnlyExperiment._id;
      saveObj.metaData.bpuName=app.bpuConfig.name;
      saveObj.metaData.tag=bpu.theOnlyExperiment.tag;
      saveObj.metaData.description=bpu.theOnlyExperiment.description;
      saveObj.metaData.magnification=app.bpuConfig.magnification;
      saveObj.metaData.expTypeString=bpu.theOnlyExperiment.expTypeString;
      saveObj.metaData.numFrames=numFrames;
      if(bpu.theOnlyExperiment.usergroups.indexOf('nwg')>-1) {
        saveObj=saveObj.eventsToRun;
      }
      fs.writeFile(app.myDataLocs.bpuSaveDir_images+'/'+'lightdata.json', JSON.stringify(saveObj, null, 4), function(err) {
        if(err) {
          cb_fn('writeFile '+app.myDataLocs.bpuSaveDir_images+'/'+'lightdata.json err:'+err);
        } else {
          bpu.theOnlyExperiment.experimentInfo.hasLightDataJson=true;
          bpu.theOnlyExperiment.startProcessingDate=new Date();
          app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
            if(err) {
              app.logger.error('closeExperiment saveData mongo save err:'+err);
            }
            moveImagesToTemp();
          });
        }
      });
    } else {
      bpu.theOnlyExperiment.startProcessingDate=new Date();
      app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
        if(err) {
          app.logger.error('closeExperiment saveData mongo save err:'+err);
        }
        moveImagesToTemp();
      });
    }
  };
  //hack for image processing mat lab thing, to add image frames to json 
  fs.readdir(app.myDataLocs.bpuSaveDir_images, function(err, files) {
    var jpgFileCount=0;
    files.forEach(function(file) {
      if(file.search('.jpg')>-1) jpgFileCount++;
    });
    numFrames=jpgFileCount;
    saveData();
  });
};
exports.checkProcessing=function(cb_fn) {
  app.logger.info('checkProcessing');
  bpu.myStatus=bpu.MyStatuses.dataProcessing;
  var doDebugRand=false; 
  var doIgnoreScriptError=true; 
  var scripts=JSON.parse(JSON.stringify(bpu.theOnlyExperiment.experimentData.auto.scripts));
  var zoomLevel=app.bpuConfig.magnification;
  var next=function() {
    if(scripts.length>0) {
      var script=scripts.shift();
      app.logger.info('checkProcessing next script='+script);
      runScript(script, zoomLevel, doDebugRand, doIgnoreScriptError, function(err) {
        if(err) {
          bpu.myStatus=bpu.MyStatuses.dataProcessingFailed;
          returnErr(script+' script err:'+err);
        } else {
          app.logger.info('checkProcessing script='+script+' value:'+bpu.theOnlyExperiment.stats[script]);
          next();
        }
      });
    } else {
      cb_fn(null);
    }
  };
  next();
};

exports.checkFolders=function(cb_fn) {
  var fldsToCheck=[
    app.myDataLocs.mainDataDir,
    app.myDataLocs.expDataDir,
    app.myDataLocs.mountedDataDir,
  ]; 
  var checkFolders=function() {
    if(fldsToCheck.length>0) {
      var fld=fldsToCheck.shift();
      fs.stat(fld, function(err, dat) {
        if(err) {
          cb_fn(err);
        } else {
          console.log(fld, dat.mode);
          if(dat.mode===16895) {
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
  checkFolders();
};
exports.clearTempFolder=function(cb_fn) {
  var cmdStr='rm '+app.myDataLocs.expDataDir+'/*.jpg'+' && '+'rm '+app.myDataLocs.expDataDir+'/*.json';
  runBashCommand(cmdStr, function(err, stdout) {
    if(err) app.logger.warn('clearTempFolder err '+err);
    cb_fn(null);
  });
};


exports.initLedControl=function(cb_fn) {
  if(bpu.theOnlyExperiment.debugSettings.doFakeLeds) {
    bpu.ledControl={};
    bpu.ledControl.getIsInitialized=function() {
      return true;
    };
    bpu.ledControl.board={};
    bpu.ledControl.board.ledsSet=function(topValue, rightValue, bottomValue, leftValue) {
      app.logger.warn('set fake Leds', topValue, rightValue, bottomValue, leftValue);
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

//Simple Functions
var getBpuTarFilename=function(exp) {
  var filename=exp.bpuInfo.nameBpu+'_';
  filename+=exp._id+'_';
  filename+=exp.user.name+'.tar.gz';
  return filename;
};
var toggleWebCamSave=function(startStop, doSave, cb_fn) {
  if(startStop==='stop' || (startStop==='start' && doSave)) {
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
    fs.readdir(app.myDataLocs.bpuSaveDir_temp, function(err, dat) {
      if(err) {
        callback('readdir '+app.myDataLocs.bpuSaveDir_temp+' err:'+err);
      } else if(dat===null || dat.length<=0) {
        callback('readdir '+app.myDataLocs.bpuSaveDir_temp+'err:'+'no files');
      } else {
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
        if(doRand) {
          cmd+=' d t';
        }
        runBashCommand(cmd, function(err, stdout) {
          if(err) {
            if(doIgnoreScriptErr) {
              app.logger.info(scriptName+' err ignored:'+err);
              bpu.theOnlyExperiment.stats[scriptName]=-2;
              bpu.theOnlyExperiment.experimentInfo.hasStats=true;
              app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
                if(err) {
                  app.logger.error('mongo save err:'+err);
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
                app.logger.error('closeExperiment saveData mongo save err:'+err);
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
};
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
