var _exec=null;
var _ToggleCameraOn='start';
var _ToggleCameraOff='stop';
exports=module.exports=function(app, deps, options, exp, mainCallback) {
  var moduleName='runExperiment.js';

  //Assert Deps
  if(app===null) {mainCallback('need app object');

  } else if(app.script_fakeMongo===null) {mainCallback('need app.script_fakeMongo object');

  } else if(app.bpu===null) {mainCallback('need app.bpu object');
  } else if(app.exp===null) {mainCallback('need app.exp object');

  } else if(deps.fs===null) {mainCallback('need fs module');
  } else if(deps.exec===null) {mainCallback('need exec object');
  } else {

    _exec=deps.exec;

    app.bpuStatus=app.bpuStatusTypes.running;

      //Series Vars
    var outcome={};
    var num=0;
    //Series Funcs
    var checkExp=function(callback) {
      num++;
      var fName=num+' checkExp';
      app.logger.debug(moduleName+' '+fName+' '+'start');

      app.exp.exp_eventsToRun.sort(function(objA, objB) {return objA.time-objB.time;});
      app.logger.trace(moduleName+' '+fName+' '+'app.exp.group_experimentType:'+app.exp.group_experimentType);
      app.logger.trace(moduleName+' '+fName+' '+'app.exp.eventsToRun:'+app.exp.exp_eventsToRun.length);
      app.logger.trace(moduleName+' '+fName+' '+'app.exp.exp_metaData:'+app.exp.exp_metaData);
      var retObj=_checkEventsArray(JSON.parse(JSON.stringify(app.exp.exp_eventsToRun)));
      if(retObj.err) {
        app.bpuStatus=app.bpuStatusTypes.runningFailed;
        return callback('fName '+retObj.err);
      } else {
        app.exp.exp_eventsToRunFinal=retObj.eventsToRun;
        return callback(null);
      }
    };
    var experimentLoop=function(callback) {
      num++;
      var fName=num+' experimentLoop';
      app.logger.debug(moduleName+' '+fName+' '+'start');

      //Start Web Cam and Run Light Events
      toggleWebCamSave(_ToggleCameraOn, function(err) {
        if(err) {
          err=fName+' '+_ToggleCameraOn+' '+err;
          app.logger.error(err);
          return callback(err);
        } else {
          //Small Wait for camera lead in
          setTimeout(function() {
            //Run Experiment
            app.exp.exp_runStartTime=new Date().getTime();
            app.exp.exp_eventsToRunFinal.sort(function(objA, objB) {return objA.time-objB.time;});
            app.logger.trace(moduleName+' '+fName+' '+'app.exp.exp_eventsToRunFinal:'+app.exp.exp_eventsToRunFinal.length);
            app.logger.trace(moduleName+' '+fName+' '+'final events runTime:'+(app.exp.exp_eventsToRunFinal[app.exp.exp_eventsToRunFinal.length-1].askTime));
            var evtCounter=0;
            var runInt=setInterval(function() {
              var timeNow=new Date().getTime();
              var dtStart=timeNow-app.exp.exp_runStartTime;
              var doReset=false;
              if(dtStart>(app.exp.exp_eventsToRunFinal[0].askTime-10)) {
                var evt=app.exp.exp_eventsToRunFinal.shift();
                evt.setTime=dtStart;
                evtCounter++;
                var msg=evt.setTime+":"+evt.topValue+", "+evt.rightValue+", "+evt.bottomValue+", "+evt.leftValue;
                app.logger.info('in:::'+fName+' '+evtCounter+'('+msg+')');
                var ranEvent=app.bpu.ledsSet(evt, doReset);
                app.exp.exp_eventsRan.push(ranEvent);

                if(app.exp.exp_eventsToRunFinal.length===0) {
                  clearInterval(runInt);
                  //Stop Camera
                  toggleWebCamSave(_ToggleCameraOff, function(err) {
                    if(err) {
                      err=fName+' '+_ToggleCameraOff+' '+err;
                      app.logger.error(err);
                    }
                    app.exp.exp_runEndTime=timeNow;
                    app.exp.exp_eventsRan.sort(function(objA, objB) {return objA.time-objB.time;});

                    app.logger.trace(moduleName+' '+fName+' '+'app.exp.exp_eventsRan:'+app.exp.exp_eventsRan.length);
                    app.logger.trace(moduleName+' '+fName+' '+'actual events runTime:'+(dtStart));
                    app.logger.trace(moduleName+' '+fName+' '+'expected events runTime:'+(app.exp.exp_eventsRan[app.exp.exp_eventsRan.length-1].askTime));
                    return callback(null);
                  });
                }
              }
            }, 20);
          }, 2000);
        }
      });
    };

    var finalizeData=function(callback) {

      app.bpuStatus=app.bpuStatusTypes.finalizing;
      num++;
      var fName=num+' finalizeData';
      app.logger.debug(moduleName+' '+fName+' '+'start');
      app.logger.trace(moduleName+' '+fName+' '+'app.exp.group_experimentType:'+app.exp.group_experimentType);
      app.logger.trace(moduleName+' '+fName+' '+'app.exp.eventsToRun:'+app.exp.exp_eventsToRun.length);
      app.logger.trace(moduleName+' '+fName+' '+'app.exp.exp_eventsToRunFinal:'+app.exp.exp_eventsToRunFinal.length);
      app.logger.trace(moduleName+' '+fName+' '+'app.exp.exp_eventsRan:'+app.exp.exp_eventsRan.length);
      app.logger.trace(moduleName+' '+fName+' '+'app.exp.exp_metaData:'+app.exp.exp_metaData);

      app.exp.exp_metaData.numFrames=-1;
      deps.fs.readdir(app.expDataDir, function(err, files) {
        if(err) {
          app.exp.exp_metaData.numFrames=-1;
        } else {
          var jpgs=files.filter(function(filename) {
            return filename.search('.jpg')> -1;
          });
          app.exp.exp_metaData.numFrames=jpgs.length;
        }
        app.db.BpuExperiment.save(app.exp, function(err) {
          if(err) {
            return callback('script_fakeMongo '+err);
          } else {
            return callback(null);
          }
        });
      });

    };
    var movePackageToMountedDrive=function(callback) {
      num++;
      var fName=num+' movePackageToMountedDrive';
      app.logger.debug(moduleName+' '+fName+' '+'start');

      //Directories
      var saveImageFolder=app.expDataDir || '/home/pi/bpuData/tempExpData';
      var finalPath=app.mountedDataDir+'/'+app.exp._id;
      //Commands
      //var rmPreCmd='rm -r '+finalPath;
      var mkdirCmd='mkdir '+finalPath;
      //var changeOwnershipCmd='chown pi:bpudata '+finalPath;   //change ownership was removed since we're not running under sudo
      var moveCmd='cp '+saveImageFolder+'/'+'*'+' '+finalPath;
      var rmTempFiles='rm '+saveImageFolder+'/*.jpg'+' && '+'rm '+saveImageFolder+'/*.json';
      //Final and Run
      //var cmdStr=mkdirCmd+' && '+changeOwnershipCmd+' && '+moveCmd+ ' && '+rmTempFiles;
      var cmdStr=mkdirCmd+' && '+moveCmd+ ' && '+rmTempFiles;
      runBashCommand(cmdStr, function(err) {
        if(err) {
          app.bpuStatus=app.bpuStatusTypes.finalizingFailed;
          app.bpuStatusError=fName+' '+err;
          err=fName+' '+err;
          return callback(err);
        } else {
          app.bpuStatus=app.bpuStatusTypes.finalizingDone;
          return callback(null);
        }
      });
    };
    //Build Series
    var funcs=[];
    funcs.push(checkExp);
    funcs.push(experimentLoop);
    funcs.push(finalizeData);
    funcs.push(movePackageToMountedDrive);

    //Start Series
    var startDate=new Date();
    app.logger.info(moduleName+' start');
    app.async.series(funcs, function(err) {
      app.logger.info(moduleName+' end in '+(new Date()-startDate)+' ms');
      if(err) {
        mainCallback(err);
      } else {
        mainCallback(null);
      }
    });
  }
};
//General Functions
var runBashCommand=function(cmdStr, callback) {
  var child=_exec(cmdStr, function (error, stdout, stderr) {
    if(error!==null) {callback('error: ' + stderr, stdout);
    } else if(stderr) {callback('stderr: ' + stderr, stdout);
    } else if(stdout) {callback(null, stdout);
    } else {callback(null, null);}
  });
};
//Camera functions
var toggleWebCamSave=function(startStop, cb_fn) {
  if(startStop==='stop' || startStop==='start') {
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
    cb_fn("1st param needs to be 'start' or 'stop'");
  }
};
//Side Func - Part of Socket*****Add Exp
var EventKeys=['topValue', 'rightValue', 'bottomValue', 'leftValue'];
var checkEventValues=function(evt) {
  var returnEvent={time:evt.time, topValue:0, rightValue:0, bottomValue:0, leftValue:0};
  EventKeys.forEach(function(key) {
    var value=evt[key];
    if(value===null || value===undefined || isNaN(Number(value))) {
      returnEvent[key]=0;
    } else if(value<=0) {
      returnEvent[key]=0;
    } else if(value>=100) {
      returnEvent[key]=100;
    } else {
      returnEvent[key]=value;
    }
  });
  return returnEvent;
};
var _checkEventsArray=function(eventsToRun) {
  var MaxExperimentTime=5*60*1000;  //5 minutes
  var MinTimeBetweenEvents=10; //ms

  var org_eventsToRun=JSON.parse(JSON.stringify(eventsToRun));
  var final_eventsToRun=[];
  var ErrStr=null;

  //Check eventsToRun is Array
  if(org_eventsToRun===null || org_eventsToRun===undefined) ErrStr='no eventsToRun';
  else if(typeof org_eventsToRun.forEach!=='function') ErrStr='eventsToRun is not array';
  else if(org_eventsToRun.length<2) ErrStr='eventsToRun needs at least two objects';

  //Check individual events and strip bad
  if(ErrStr===null) {
    var keeperEvents=[];
    try {
      //Check Each Event
      org_eventsToRun.forEach(function(evt) {
        if(evt.time!==null && evt.time!==undefined && !isNaN(Number(evt.time)) && evt.time>=0) {
          var retEvt=checkEventValues(evt);
          if(retEvt!==null) {
            keeperEvents.push(retEvt);
          }
        }
      });
      //Recheck Events for at least 2 or more
      if(keeperEvents.length>=2) {
        //Make Times Relative
        keeperEvents.sort(function(objA, objB) {return objA.time-objB.time;});
        var zeroTime=keeperEvents[0].time;
        keeperEvents.forEach(function(evt) {
          evt.askTime=evt.time-zeroTime;
          evt.setTime=-1;
        });
        //Strip over max time and events too close to eachother
        var lastTime=-1000;
        keeperEvents.forEach(function(evt) {
          //Max Time Keep
          if(evt.askTime<=MaxExperimentTime) {
            //between interval
            if((evt.askTime-lastTime)>MinTimeBetweenEvents) {
              lastTime=evt.askTime;
              final_eventsToRun.push(evt);
            }
          }
        });
      } else {
        ErrStr='mapped eventsToRun returned with less than two objects';
      }
    } catch(err) {
      ErrStr='catchErr '+err;
    } finally {
      //Check eventsToRun is Array
      if(org_eventsToRun===null || org_eventsToRun===undefined) ErrStr='no eventsToRun';
      else if(typeof org_eventsToRun.forEach!=='function') ErrStr='eventsToRun is not array';
      else if(org_eventsToRun.length<2) ErrStr='eventsToRun needs at least two objects';
    }
  }
  return {err:ErrStr, eventsToRun:final_eventsToRun};
};
var setNewExperiment=function(newExp, callback) {
  var savePath=mongoose.getSavePath();
  var saveName=newExp._id+"_"+newExp.user.name+".json";
  savePath=savePath+"/"+saveName;
  newExp.bpuFakeMongoFilename=saveName;
  newExp.bpuFakeMongoPath=savePath;

  newExp.bpuInfo={
    nameBpu:app.bpuConfig.name,
    useBpu:newExp.bpuInfo.useBpu,
  };

  newExp.debugSettings={
    doSkipAuto:app.config.doSkipAuto,
    doFakeLeds:app.config.doFakeLeds,
    doFakeScripts:app.config.doFakeScripts,
    doFakeBpu:app.config.doFakeBpu,
    doCamera:app.config.doCamera,
  };
  var setGroupFlags=function(cb_fn) {
    var compiledSettings={};
    Object.keys(newExp.groupSettings).forEach(function(key) {
      if(key.search('_')===-1) {
        compiledSettings[key]=false;
      }
    });
    //Filter Groups by bpu
    var tempGroups=JSON.parse(JSON.stringify(newExp.usergroups));
    var groups=[];
    tempGroups.forEach(function(tg) {
      app.bpuConfig.allowedGroups.forEach(function(ag) {
        if(tg===ag) {
          groups.push(tg);
        }
      });
    });
    //Set Group permissions
    var didFindOneGroup=false;
    var findNext=function() {
      if(groups.length>0) {
        var grp=groups.shift();
        app.db.models.Group.findOne({name:grp}, {}, function(err, data) {
          if(data && data.settings) {
            didFindOneGroup=true;
            keys=Object.keys(data.settings);
            keys.forEach(function(key) {
              if(!compiledSettings[key] && data.settings[key]) {
                compiledSettings[key]=data.settings[key];
              }
            });
          }
          findNext();
        });
      } else {
        if(didFindOneGroup) {
          newExp.groupSettings=compiledSettings;
          cb_fn(null);
        } else {
          cb_fn('groups not recogized');
        }
      }
    };
    if(groups.length>0) {
      findNext();
    } else {
      cb_fn('no groups');
    }
  };
  setGroupFlags(function(err) {
    if(err) {
      callback(err, null);
    } else {
      app.db.models.BpuExperiment.save(newExp, function(err, dat) {
        if(err) {
          callback('setNewEperiment asyncFinally could not save err:'+err, null);
        }
        callback(null, newExp);
      });
    }
  });
};
