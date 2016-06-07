var async=require('async'); 
var bpuActions=require('./bpuActions.js');

//app from server socket
var app=null;

//Bpu Init
//Bpu Init
//Bpu Init
var bpu={
  doFullStop:false,
  printName:'(bpu2.js)',
  myStatus:'initializing',
  myState:'initializing',
  MyStatuses:[],
};

//Print
bpu.clearConsole=function() {
  console.log('\033c');
};
bpu.mp=function(msg) {
  console.log(bpu.printName+'\t'+' mp:'+msg);
};
bpu.mpErr=function(msg, err) {
  console.log(bpu.printName+'\t'+'mpErr:'+msg, err);
};
//Data Location
bpu.myDataLocs={};
bpu.myDataLocs.mainDataDir='/myData';
bpu.myDataLocs.bpuSaveDir=bpu.myDataLocs.mainDataDir+'/bpu';
bpu.myDataLocs.bpuSaveDir_tars=bpu.myDataLocs.bpuSaveDir+'/tars';
bpu.myDataLocs.bpuSaveDir_temp=bpu.myDataLocs.bpuSaveDir+'/temp';
bpu.myDataLocs.bpuSaveDir_images=bpu.myDataLocs.bpuSaveDir+'/images';
//Config
bpu.config=null;
//Led Controls
bpu.ledControl=require('./leds.js');
bpu.ledControlOptions={
  doTestLeds:false, doRunBlink:true,
  RunPin:13, ValvePin:11, 
  diffuserPin:12, diffuserValue:75,
  LedPins:{Top:10, Right:6, Bottom:5, Left:9},
};

//Bpu Initialization Over
//Bpu Initialization Over
//Bpu Initialization Over

//The Only Local Functions

bpu.setStatus=function(newStatus) {
  var keys=Object.keys(bpu.MyStatuses);
  var found=false;
  for(var i=0;i<keys.length;i++) {
    if(bpu.MyStatuses[keys[i]]===newStatus) {
      bpu.myStatus=bpu.MyStatuses[keys[i]];
      found=true;
      break;
    } 
  }
  if(!found) {
    bpu.mpErr('............................._setStatus', newStatus+' not recognized');
  } else {
    if(app!==null && app!==undefined && app.socket!==null && bpu.myState!=='initializing' && bpu.myState!=='internalCheck') {
      console.log('emit status to app');
      if(bpu.myStatus===bpu.MyStatuses.initializingDone) {
        app.socket.myEmits.initDone({});
      } else if(bpu.myStatus===bpu.MyStatuses.dataPacking) {
        app.socket.myEmits.dataComplete({});
      } else if(bpu.myStatus===bpu.MyStatuses.dataPackingFailed) {
      } else if(bpu.myStatus===bpu.MyStatuses.dataProcessing) {
      } else if(bpu.myStatus===bpu.MyStatuses.dataProcessingFailed) {
      } else if(bpu.myStatus===bpu.MyStatuses.dataReady) {
        app.socket.myEmits.dataReady({});
      }
    }
  }
};
var setTheOnlyExperiment=function(exp) {
  bpu.theOnlyExperiment=exp;
};
var asyncFunctionTemplate=function(options, action, callback) {
  bpu.mp('running '+options.fName+', timeout in '+options.timeoutInterval);
  var tm=setTimeout(function() {
    var err=options.fName+':'+'timed out';
    bpu.mp('\t\t'+options.fName+' finished with err:('+err+')\n');
    callback(err);
  }, options.timeoutInterval);
  action(function(err) {
    if(tm!==null) {
      clearTimeout(tm);
      tm=null;
      bpu.mp('\t\t'+options.fName+' finished with err:('+err+')\n');
      callback(err);
    }
  });
};

//Simple Exports
bpu.setLeds=function(lightValues) {
  bpu.ledControl.board.ledsSet(lightValues.topValue, lightValues.rightValue, lightValues.bottomValue, lightValues.leftValue);
  lightValues.time=new Date().getTime();
  return lightValues;
};
var _resetState=function() {
  bpu.myState='initializing';
};
var _getState=function() {
  return bpu.myState;
};
var _getStatus=function() {
  return bpu.myStatus;
};
var _setDoFullStop=function() {
  bpu.doFullStop=true;
};
exports.setBpuStatuses=function(bpuStatuses) {
  bpu.MyStatuses=bpuStatuses;
};
exports.checkLightDataArray=function(exp, callback) {
  setTheOnlyExperiment(exp);
  bpuActions.setBpu(bpu);
  bpuActions.checkLightDataArray(function(err) {
    callback(err, bpu.theOnlyExperiment.eventsToRun)
  });
};
exports.setLeds=bpu.setLed;
exports.resetState=_resetState;
exports.getState=_getState;
exports.getStatus=_getStatus;
exports.setStatus=bpu.setStatus;
exports.setDoFullStop=_setDoFullStop;

//Waterfall/Exports
var parallel_runExp=function(pApp, exp, callbackToSocket) {
  var fName='runExp' 
  bpu.myState=fName;
  bpu.mp(fName+'...\n');

  app=pApp;
  bpu.config=app.bpuConfig;
  setTheOnlyExperiment(exp);
  bpuActions.setApp(app);
  bpuActions.setBpu(bpu);

  var initLedControl=function(callback) {
    var opts={
      fName:'initLedControl',
      timeoutInterval:1000,
    };
    asyncFunctionTemplate(opts, bpuActions.initLedControl, function(err) {
      return callback(err, 'initLedControl okay');
    });
  };
  var checkDataFolders=function(callback) {
    var opts={
      fName:'checkDataFolders',
      timeoutInterval:1000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkDataFolders, function(err) {
      return callback(err, 'checkDataFolders okay');
    });
  };
  var checkLightData=function(callback) {
    var opts={
      fName:'checkLightData',
      timeoutInterval:1000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkLightDataArray, function(err) {
      return callback(err, 'checkDataFolders okay');
    });
  };
  var asyncFinally=function(err, results) {
    if(err) {
     bpu.mpErr('parallel_runExp asyncFinally err', err);
      callbackToSocket(err);
    } else {
      bpu.mp('parallel_runExp asyncFinally okay.\n');
      
      bpu.mp('parallel_runExp asyncFinally running Experiment.\n');
      if(bpu.theOnlyExperiment.isLive) {
        waterfall_runExperimentFromJoystick(function(err) {
          if(err) {
            callbackToSocket('waterfall_runExperimentFromJoystick asyncFinally running Experiment err:'+err);
          } else {
            callbackToSocket(null);
          }
        });
      } else if(bpu.theOnlyExperiment.isArray) {
        waterfall_runExperimentFromArray(function(err) {
          if(err) {
            callbackToSocket('waterfall_runExperimentFromArray asyncFinally running Experiment err:'+err);
          } else {
            callbackToSocket(null);
          }
        });
      } else if(bpu.theOnlyExperiment.isAuto) {
        waterfall_runExperimentFromArray(function(err) {
          if(err) {
            callbackToSocket('waterfall_runExperimentFromArray asyncFinally running Experiment err:'+err);
          } else {
            callbackToSocket(null);
          }
        });
      } 
    }
  };
  async.parallel([
    initLedControl,
    checkDataFolders,
    checkLightData
  ], asyncFinally); 
};

var waterfall_internalCheck=function(pApp, exp, callbackToSocket) {
  var fName='internalCheck' 
  bpu.myState=fName;
  bpu.mp(fName+'...\n');

  app=pApp;
  bpu.config=app.bpuConfig;
  setTheOnlyExperiment(exp);
  bpuActions.setApp(app);
  bpuActions.setBpu(bpu);

  bpu.setStatus(bpu.MyStatuses.initializing);
  
  var initLedControl=function(callback) {
    var opts={
      fName:'initLedControl',
      timeoutInterval:1000,
    };
    asyncFunctionTemplate(opts, bpuActions.initLedControl, function(err) {
      return callback(err);
    });
  };
  var checkDataFolders=function(callback) {
    var opts={
      fName:'checkDataFolders',
      timeoutInterval:1000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkDataFolders, function(err) {
      return callback(err);
    });
  };
  var cleanWebcamFolders=function(callback) {
    var opts={
      fName:'cleanWebcamFolders',
      timeoutInterval:1000,
    };
    asyncFunctionTemplate(opts, bpuActions.cleanWebcamFolders, function(err) {
      return callback(err);
    });
  };
  var asyncFinally=function(err) {
    if(err) {
     bpu.mpErr('checkInit asyncFinally err', err);
      callbackToSocket(err);
    } else {
      bpu.mp('checkInit asyncFinally okay.\n');
      
      bpu.mp('checkInit asyncFinally running Experiment.\n');
      waterfall_runExperimentFromArray(function(err) {
        bpu.setStatus(bpu.MyStatuses.initializingDone);
        if(err) {
          callbackToSocket('checkInit asyncFinally running Experiment err:'+err);
        } else {
          callbackToSocket(null);
        }
      });
    }
  };
  async.waterfall([
    initLedControl,
    checkDataFolders,
    cleanWebcamFolders,
  ], asyncFinally); 
};

exports.internalCheck=waterfall_internalCheck;
exports.runExp=parallel_runExp;

//Running Experiments
var waterfall_runExperimentFromJoystick=function(callback) {
  var doExperiment=function(callback) {
    var opts={
      fName:'doExperiment',
      timeoutInterval:bpu.theOnlyExperiment.experimentInfo.runTime*1.25,
    };
    asyncFunctionTemplate(opts, bpuActions.doExperiment, function(err) {
      return callback(err);
    });
  };
  var closeExperiment=function(callback) {
    var opts={
      fName:'closeExperiment',
      timeoutInterval:60000,
    };
    asyncFunctionTemplate(opts, bpuActions.closeExperiment, function(err) {
      return callback(err);
    });
  };
  var checkProcessing=function(callback) {
    var opts={
      fName:'checkProcessing',
      timeoutInterval:60000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkProcessing, function(err) {
      return callback(err);
    });
  };
  var asyncFinally=function(err) {
    if(err) {
      bpu.mpErr('waterfall_runExperimentFromJoystick asyncFinally err', err);
      callback(err);
    } else {
      bpu.mp('waterfall_runExperimentFromJoystick asyncFinally okay.\n');
      callback(null);
    }
  };
  if(bpu.theOnlyExperiment.groupSettings.doAllowTextFile) {
    async.waterfall([
      doExperiment,
      closeExperiment,
      checkProcessing,
    ], asyncFinally); 
  } else {
    callback('waterfall_runExperimentFromJoystick not allowed');
  }
};
var waterfall_runExperimentFromArray=function(callback) {
  var cleanWebcamFolders=function(callback) {
    var opts={
      fName:'cleanWebcamFolders',
      timeoutInterval:1000,
    };
    asyncFunctionTemplate(opts, bpuActions.cleanWebcamFolders, function(err) {
      return callback(err);
    });
  };
  var checkLightData=function(callback) {
    var opts={
      fName:'checkLightData',
      timeoutInterval:1000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkLightDataArray, function(err) {
      return callback(err);
    });
  };

  var doExperiment=function(callback) {
    var opts={
      fName:'doExperiment',
      timeoutInterval:bpu.theOnlyExperiment.experimentInfo.runTime*1.25,
    };
    asyncFunctionTemplate(opts, bpuActions.doExperiment, function(err) {
      return callback(err);
    });
  };
  var closeExperiment=function(callback) {
    var opts={
      fName:'closeExperiment',
      timeoutInterval:60000,
    };
    asyncFunctionTemplate(opts, bpuActions.closeExperiment, function(err) {
      return callback(err);
    });
  };
  var checkProcessing=function(callback) {
    var opts={
      fName:'checkProcessing',
      timeoutInterval:60000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkProcessing, function(err) {
      return callback(err);
    });
  };
  var asyncFinally=function(err) {
    if(err) {
      bpu.mpErr('action_runExperimentFromArray asyncFinally err', err);
      callback(err);
    } else {
      bpu.mp('action_runExperimentFromArray asyncFinally okay.\n');
      callback(null);
    }
  };
  if(bpu.theOnlyExperiment.groupSettings.doAllowTextFile) {
    async.waterfall([
      cleanWebcamFolders,
      checkLightData,
      doExperiment,
      closeExperiment,
      checkProcessing,
    ], asyncFinally); 
  } else {
    callback('action_runExperimentFromArray not allowed');
  }
};

