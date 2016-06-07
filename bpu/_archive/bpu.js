var async=require('async'); 
var bpuActions=require('./bpuActions.js');

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
  printName:'(bpu.js)',
  myStatus:'initializing',
  MyStatuses:[],
};

//Config
bpu.config=null;
//Led Controls
bpu.ledControl=require('./leds.js');
bpu.ledControlOptions={
  doTestLeds:false, doRunBlink:true,
  RunPin:13, ValvePin:11, 
  diffuserPin:12, diffuserValue:75,
  LedPins:{Top:5, Right:6, Bottom:9, Left:10},
};
bpu.ledControl.init(bpu.ledControlOptions, function() {});


//The Only Local Functions
//Simple Exports
bpu.ledsSet=function(lightValues, doReset) {
  if(bpu.theOnlyExperiment && bpu.theOnlyExperiment.experimentType.isLive && bpu.myStatus===app.bpuStatuses.expRunning) {
    bpu.theOnlyExperiment.liveJoyDataArray.push(lightValues);
  }
  if(doReset || bpu.myStatus!==app.bpuStatuses.expRunning) {
    lightValues={topValue:0, rightValue:0, bottomValue:0, leftValue:0};
  }
  var msg=lightValues.topValue+'\t'+lightValues.rightValue+'\t'+lightValues.bottomValue+'\t'+lightValues.leftValue;
  var timeNow=new Date().getTime();
  if(bpu.startTime!==null) {
    var runTime=timeNow-bpu.startTime;
    msg=runTime+'\t'+msg;
  } else {
    msg='reseting'+'\t'+msg;
  }
  app.logger.info('ledsSet:'+msg);
  bpu.ledControl.board.ledsSet(lightValues.topValue, lightValues.rightValue, lightValues.bottomValue, lightValues.leftValue);
  lightValues.time=timeNow;
  return lightValues;
};
bpu.valveOpen=function(bVal) {
  if(bVal) {
    bpu.ledControl.board.valveOpen();
  } else {
    bpu.ledControl.board.valveClose();
  }
};
bpu.addToEventsRan=function(newLd) {
  if(bpu.theOnlyExperiment!==null) {
    if(bpu.theOnlyExperiment.eventsRan===null) {
      bpu.theOnlyExperiment.eventsRan=[];
    }
    // ZAHID
    // Due to lag leds value can be set after an experiment is over
    // This led values will not have setTime defined.
    // Don't add this to the eventsRan	
    if(newLd.setTime){
    	bpu.theOnlyExperiment.eventsRan.push(newLd);
    }
  }
};
bpu.getProcessingTime=function() {
  return 60000;
};
var _setDoFullStop=function() {
  bpu.doFullStop=true;
  app.logger.warn('DO FULL STOP NOT IMPLEMENTED');
};
var _initialize=function(pApp, callback) {
  var initErr=null;
  bpu.myStatus=bpu.MyStatuses.initializing;
  bpu.startTime=null;
  //App
  app=pApp;
  app.logger.info('bpu.js _initialize');
  bpuActions.setApp(app);
  //Config 
  bpu.config=app.bpuConfig;
  //Statuses 
  bpu.MyStatuses=app.bpuStatuses;
  //Set Bpu
  bpuActions.setBpu(bpu);

  //Return
  var returnFunc=function(err) {
    //Return
    if(err) {
      bpu.myStatus=bpu.MyStatuses.initializingFailed;
      callback(err, null);
    } else {
      bpu.myStatus=bpu.MyStatuses.initializingDone;
      callback(null, bpu);
    }
  };

  //Initialize Led Control
  if(bpu.ledControl.getIsInitialized()) {
    returnFunc(null);
  } else {
    bpuActions.initLedControl(function(err) {
      returnFunc(null);
    });
  }

};
var setTheOnlyExperiment=function(exp) {
  bpu.theOnlyExperiment=exp;
};
bpu.setTheOnlyExperiment=setTheOnlyExperiment;
exports.getTheOnlyExperiment=function() {
 return bpu.theOnlyExperiment;
};
exports.getMyStatus=function() {return bpu.myStatus;};
exports.setMyStatus=function(newStatus) {bpu.myStatus=newStatus;};
exports.ledsSet=bpu.ledsSet;
exports.valveOpen=bpu.valveOpen;
exports.addToEventsRan=bpu.addToEventsRan;
exports.setDoFullStop=_setDoFullStop;
exports.getProcessingTime=bpu.getProcessingTime;
exports.initialize=_initialize;

//Sequences
//Sequences
//Sequences
//Running Experiments
var _runExperiment=function(mainCallback) {
  app.logger.info('_runExperiment start');
  bpu.theOnlyExperiment.bpuDates.push({date:new Date(), tag:'start run experiment'});
  var doExperiment=function(callback) {
    var options={fName:'doExperiment', timeoutInterval:bpu.theOnlyExperiment.runTime*4};
    var action=function(cb_fn) {
      bpuActions.doExperiment(function(err) {
        if(err) app.logger.error(options.fName+' bpuActions.doExperiment err:'+err);
        app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
          if(err) app.logger.error(options.fName+' BpuExperiment.save err:'+err);
          cb_fn(null);
        });
      });
    };
    app.logger.info(options.fName+' start');
    app.myFunctions.asyncFunctionTemplate(options, action, function(err) {
      if(err) {
        app.logger.error(options.fName+' end with err:'+err);
      } else {
        app.logger.info(options.fName+' end');
      }
      return callback(err);
    });
  };
  var finalizeData=function(callback) {
    bpu.theOnlyExperiment.bpuDates.push({date:new Date(), tag:'start close experiment'});
    var options={fName:'finalizeData', timeoutInterval:10*180000};
    var action=function(cb_fn) {
      bpuActions.closeExperiment(cb_fn);
    };
    app.logger.info(options.fName+' start');
    app.myFunctions.asyncFunctionTemplate(options, action, function(err) {
      if(err) {
        app.logger.error(options.fName+' end with err:'+err);
      } else {
        app.logger.info(options.fName+' end');
      }
      return callback(err);
    });
  };
  var movePackageToMountedDrive=function(callback) {
    var options={fName:'movePackageToMountedDrive', timeoutInterval:5*180000};
    var action=function(cb_fn) {
      bpuActions.moveFakeDataToReady(cb_fn);
    };
    app.logger.info(options.fName+' start');
    app.myFunctions.asyncFunctionTemplate(options, action, function(err) {
      if(err) {
        app.logger.error(options.fName+' end with err:'+err);
      } else {
        app.logger.info(options.fName+' end');
      }
      return callback(err);
    });
  };
  var asyncFinally=function(err) {
    if(err) app.logger.error('_runExperiment asyncFinally err', err);
    bpu.theOnlyExperiment.experimentInfo.isReady=true;
    bpu.theOnlyExperiment.bpuDates.push({date:new Date(), tag:'end run experiment'});
    app.db.models.BpuExperiment.save(bpu.theOnlyExperiment, function(err, dat) {
      if(err) app.logger.error('_runExperiment asyncFinally BpuExperiment.save err:'+err);
      else app.logger.info('_runExperiment asyncFinally');
      mainCallback(null);
    });
  };
  async.waterfall([doExperiment, finalizeData, movePackageToMountedDrive], asyncFinally); 
};

exports.setAndCheckExp=_setAndCheckExp;
exports.runExperiment=_runExperiment;
