var async=require('async'); 
var bpuActions=require('./bpuActions-nonmongo.js');

var zeroLeds={
  topValue:0,
  rightValue:0,
  bottomValue:0,
  leftValue:0
}; 
//app from server socket
var app=null;

//Bpu Init
//Bpu Init
//Bpu Init
var bpu={
  doFullStop:false,
  printName:'(bpu2.js)',
  myStatus:'initializing',
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


//Config
bpu.config=null;
//Led Controls
bpu.ledControl=require('./leds.js');
bpu.ledControlOptions={
  doTestLeds:false, doRunBlink:true,
  RunPin:13, ValvePin:11, 
  diffuserPin:12, diffuserValue:75,
  LedPins:{Top:5, Right:6, Bottom:4, Left:10},
};

//Bpu Initialization Over
//Bpu Initialization Over
//Bpu Initialization Over

//The Only Local Functions
var setTheOnlyExperiment=function(exp) {
  bpu.theOnlyExperiment=exp;
};
var asyncFunctionTemplate=function(options, action, callback) {
  bpu.mp('running '+options.fName+', timeout in '+options.timeoutInterval);
  var tm=setTimeout(function() {
    var err=options.fName+':'+'timed out';
    bpu.mp('\t\t'+options.fName+' finished with err:('+err+')\n');
    bpu.doFullStop=true;
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
bpu.ledsSet=function(lightValues) {
  bpu.ledControl.board.ledsSet(lightValues.topValue, lightValues.rightValue, lightValues.bottomValue, lightValues.leftValue);
  lightValues.time=new Date().getTime();
  return lightValues;
};
bpu.addToEventsRan=function(newLd) {
  bpu.theOnlyExperiment.eventsRan.push(newLd);
};
var _setDoFullStop=function() {
  bpu.doFullStop=true;
  console.log('DO FULL STOP NOT IMPLEMENTED');
};
var _initialize=function(pApp, callback) {
  var err=null;
  bpu.myStatus=bpu.MyStatuses.initializing;
  //App
  app=pApp;
  bpuActions.setApp(app);
  //Config 
  bpu.config=app.bpuConfig;
  //Data Location
  bpu.myDataLocs={};
  bpu.myDataLocs.mainDataDir=app.myDataLocs.mainDataDir;
  bpu.myDataLocs.bpuSaveDir=app.myDataLocs.bpuSaveDir;
  bpu.myDataLocs.bpuSaveDir_tars=app.myDataLocs.bpuSaveDir_tars;
  bpu.myDataLocs.bpuSaveDir_temp=app.myDataLocs.bpuSaveDir_temp;
  bpu.myDataLocs.bpuSaveDir_images=app.myDataLocs.bpuSaveDir_images;
  bpu.myDataLocs.bpuSaveDir_fakeMongo=app.myDataLocs.bpuSaveDir_fakeMongo;
  bpu.myDataLocs.bpuSaveDir_readyMongo=app.myDataLocs.bpuSaveDir_readyMongo;
  //Statuses 
  bpu.MyStatuses=app.bpuStatuses;
  //Set Bpu
  bpuActions.setBpu(bpu);
  //Return
  if(err) {
    bpu.myStatus=bpu.MyStatuses.initializingFailed;
    callback(err);
  } else {
    bpu.myStatus=bpu.MyStatuses.initializingDone;
    callback(null);
  }
};
exports.getTheOnlyExperiment=function() {
 return bpu.theOnlyExperiment;
};
exports.myStatus=function() {return bpu.myStatus;}
exports.ledsSet=bpu.ledsSet;
exports.addToEventsRan=bpu.addToEventsRan;
exports.setDoFullStop=_setDoFullStop;
exports.initialize=_initialize;

var waterfall_resetBpu=function(callbackToSocket) {
  var fName='reset' 
  bpu.mp(fName+'...\n');
  bpu.doFullStop=false;
  var checkDataFolders=function(callback) {
    var opts={
      fName:'checkDataFolders',
      timeoutInterval:30000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkDataFolders, function(err) {
      return callback(err);
    });
  };
  
  var clearDataFolders=function(callback) {
    var opts={
      fName:'clearDataFolders',
      timeoutInterval:30000,
    };
    asyncFunctionTemplate(opts, bpuActions.clearDataFolders, function(err) {
      return callback(err);
    });
  };

  var asyncFinally=function(err) {
    if(err) {
     bpu.mpErr('waterfall_reset asyncFinally err', err);
      callbackToSocket(err);
    } else {
      bpu.mp('waterfall_reset asyncFinally okay.\n');
      //Zero Leds Control
      if(bpu.ledControl!==null && bpu.ledControl.board!==null ) {
        if(bpu.ledControl!==undefined && bpu.ledControl.board!==undefined ) {
          bpu.ledsSet(zeroLeds);
        }
      }
      //Clear Exp
      setTheOnlyExperiment(null);
      //Clear bpuAction App
      bpuActions.setApp(null);
      //Clear bpuAction bpu and toggle web cam stop 
      bpuActions.setBpu(null);
      bpu.myStatus=bpu.MyStatuses.bpuNull;
      callbackToSocket(null);
    }
  };
  async.waterfall([
    checkDataFolders,
    clearDataFolders,
  ], asyncFinally); 
};
var parallel_runExp=function(pApp, exp, callbackToSocket) {
  var fName='runExp' 
  bpu.mp(fName+'...\n');
  bpu.myStatus=bpu.MyStatuses.expRunning;
  var initLedControl=function(callback) {
    if(bpu.ledControl.getIsInitialized()) {
      return callback(null, 'initLedControl already initilized');
    } else {
      var opts={
        fName:'initLedControl',
        timeoutInterval:10000,
      };
      asyncFunctionTemplate(opts, bpuActions.initLedControl, function(err) {
        return callback(err, 'initLedControl okay');
      });
    }
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
      timeoutInterval:10000,
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
      bpu.mp('parallel_runExp asyncFinally running Experiment.\n');
      if(bpu.theOnlyExperiment.isLive) {
        waterfall_runExperiment(function(err) {
          bpu.mp('parallel_runExp asyncFinally okay.\n');
          if(err) {
            bpu.myStatus=bpu.MyStatuses.dataProcessingFailed;
            callbackToSocket('waterfall_runExperiment asyncFinally running Experiment err:'+err);
          } else {
            bpu.myStatus=bpu.MyStatuses.dataReady;
            callbackToSocket(null);
          }
        });
      } else if(bpu.theOnlyExperiment.isArray) {
        waterfall_runExperiment(function(err) {
          bpu.mp('parallel_runExp asyncFinally okay.\n');
          if(err) {
            console.log('.............................................................1111111');
            console.log('.............................................................'+err);
            bpu.myStatus=bpu.MyStatuses.dataProcessingFailed;
            callbackToSocket('waterfall_runExperiment asyncFinally running Experiment err:'+err);
          } else {
            bpu.myStatus=bpu.MyStatuses.dataReady;
            callbackToSocket(null);
          }
        });
      } else if(bpu.theOnlyExperiment.isAuto) {
        waterfall_runExperiment(function(err) {
          bpu.mp('parallel_runExp asyncFinally okay.\n');
          if(err) {
            bpu.myStatus=bpu.MyStatuses.dataProcessingFailed;
            callbackToSocket('waterfall_runExperiment asyncFinally running Experiment err:'+err);
          } else {
            bpu.myStatus=bpu.MyStatuses.dataReady;
            callbackToSocket(null);
          }
        });
      } else {
        bpu.myStatus=bpu.MyStatuses.expRunningFailed;
        callbackToSocket('waterfall_runExperiment asyncFinally running Experiment err:'+'could not find exp type to run');
      }
    }
  };

  setTheOnlyExperiment(exp);
  async.parallel([
      initLedControl,
      checkDataFolders,
      checkLightData
  ], asyncFinally); 
};
//Running Experiments
var waterfall_runExperiment=function(mainCallback) {
  var cleanWebcamFolders=function(callback) {
    var opts={
      fName:'cleanWebcamFolders',
      timeoutInterval:30000,
    };
    asyncFunctionTemplate(opts, bpuActions.cleanWebcamFolders, function(err) {
      return callback(err);
    });
  };
  var checkLightData=function(callback) {
    var opts={
      fName:'checkLightData',
      timeoutInterval:10000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkLightDataArray, function(err) {
      return callback(err);
    });
  };

  var doExperiment=function(callback) {
    var opts={
      fName:'doExperiment',
      timeoutInterval:bpu.theOnlyExperiment.experimentInfo.runTime*4,
    };
    asyncFunctionTemplate(opts, bpuActions.doExperiment, function(err) {
      bpu.theOnlyExperiment.experimentInfo.isOver=true;
      app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
        if(err) {
          bpu.mpErr('mongo save err:'+err);
        } else {
          bpu.mp('waterfall_runExperiment asyncFinally okay and saved.\n');
        }
        return callback(err);
      });
    });
  };
  var closeExperiment=function(callback) {
    var opts={
      fName:'closeExperiment',
      timeoutInterval:180000,
    };
    asyncFunctionTemplate(opts, bpuActions.closeExperiment, function(err) {
      return callback(err);
    });
  };
  var checkProcessing=function(callback) {
    var opts={
      fName:'checkProcessing',
      timeoutInterval:5*180000,
    };
    asyncFunctionTemplate(opts, bpuActions.checkProcessing, function(err) {
      return callback(err);
    });
  };
  var moveFakeDataToReady=function(callback) {
    var opts={
      fName:'moveFakeDataToReady',
      timeoutInterval:60000,
    };
    asyncFunctionTemplate(opts, bpuActions.moveFakeDataToReady, function(err) {
      return callback(err);
    });
  };
  var asyncFinally=function(err) {
    if(err) {
      bpu.mpErr('waterfall_runExperiment asyncFinally err', err);
      mainCallback(err);
    } else {
      bpu.theOnlyExperiment.experimentInfo.isReady=true;
      app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
        if(err) {
          bpu.mpErr('mongo save err:'+err);
        } else {
          bpu.mp('waterfall_runExperiment asyncFinally okay and saved.\n');
        }
        mainCallback(null);
      });
    }
  };
  if(bpu.theOnlyExperiment.groupSettings.doAllowTextFile) {
    async.waterfall([
      cleanWebcamFolders,
      checkLightData,
      doExperiment,
      closeExperiment,
      checkProcessing,
      moveFakeDataToReady,
    ], asyncFinally); 
  } else {
    callback('waterfall_runExperiment not allowed');
  }
};

exports.resetBpu=waterfall_resetBpu;
exports.runExp=parallel_runExp;
