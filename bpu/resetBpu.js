var _app=null;
var _fs=null;
var _exec=null;
exports=module.exports=function(app, deps, options, mainCallback) {
  var moduleName='resetBpu.js'; 

  //Assert Deps 
  if(app===null) {mainCallback('need app object');

  } else if(deps.async===null) {mainCallback('need async module');
  } else if(deps.fs===null) {mainCallback('need fs module');
  } else if(deps.exec===null) {mainCallback('need exec object');
  
  } else {

    _app=app;
    _fs=deps.fs;
    _exec=deps.exec;

    app.bpuStatus=app.bpuStatusTypes.reseting;
    
    //Check Options
    var o_doFlushFlag=options.doFlushFlag || false;
    var o_flushTime=options.flushTime || 20*1000;

    var finishInit=function() {
      //Series Vars
      var outcome={};
      var num=0;
      
      //Series Funcs
      
      var checkDataFolders=function(callback) {
        num++;
        var options={fName:moduleName+' '+num+'. checkDataFolders', timeoutInterval:5000};
        var action=function(cb_fn) {
          var fldsToCheck=[
            app.mainDataDir,
            app.expDataDir,
            app.mountedDataDir,
          ]; 
          _checkFolders(fldsToCheck, function(err) {
            cb_fn(err);
          });
        };
        app.logger.trace(options.fName+' start');
        app.myFunctions.asyncFunctionTemplate(options, action, function(err) {
          app.logger.trace(options.fName+' end');
          if(err) {
            return callback(options.fName+' '+err);
          } else {
            return callback(null);
          }
        });
      };
      
      var clearTempFolder=function(callback) {
        num++;
        var options={fName:moduleName+' '+num+'. clearTempFolder', timeoutInterval:5000};
        var action=function(cb_fn) {
          _clearTempFolder(app.expDataDir, function(err) {
            cb_fn(err);
          });
        };
        app.logger.trace(options.fName+' start');
        app.myFunctions.asyncFunctionTemplate(options, action, function(err) {
          app.logger.trace(options.fName+' end');
          if(err) {
            return callback(options.fName+' '+err);
          } else {
            return callback(err);
          }
        });
      };

      var resetBpuData=function(callback) {
        num++;
        var options={fName:moduleName+' '+num+'. resetBpuData', timeoutInterval:5000};
        var action=function(cb_fn) {
          //Other
          app.bpu.startTime=null;
          app.exp=null;
          app.didConfirmRun=false;
          app.didConfirmTimeoutRun=false;
          //Zero Leds Control
          var doReset=true;
          app.bpu.ledsSet(null, doReset);
          cb_fn(null);
        };
        app.logger.trace(options.fName+' start');
        app.myFunctions.asyncFunctionTemplate(options, action, function(err) {
          app.logger.trace(options.fName+' end');
          if(err) {
            return callback(options.fName+' '+err);
          } else {
            return callback(err);
          }
        });
      };
      
      var checkFlush=function(callback) {
        num++;
        var options={fName:moduleName+' '+num+'. checkFlush', timeoutInterval:5000};
        if(o_doFlushFlag) options.timeoutInterval=2*o_flushTime;
        var action=function(cb_fn) {
          //Check Flush 
          if(o_doFlushFlag) {
            app.bpu.startFlush({flushTime:o_flushTime}, function() {
              cb_fn(null);
            });
          } else {
            cb_fn(null);
          }
        };
        app.logger.trace(options.fName+' start');
        app.myFunctions.asyncFunctionTemplate(options, action, function(err) {
          app.logger.trace(options.fName+' end');
          if(err) {
            return callback(options.fName+' '+err);
          } else {
            return callback(null);
          }
        });
      };
      
      //Build Series
      var funcs=[];
      funcs.push(checkDataFolders);
      funcs.push(clearTempFolder);
      funcs.push(resetBpuData);
      funcs.push(checkFlush);
      
      //Start Series 
      var startDate=new Date();
      app.logger.info(moduleName+' start');
      app.async.series(funcs, function(err) {
        app.logger.info(moduleName+' end in '+(new Date()-startDate)+' ms');
        if(err) {
          app.bpuStatus=app.bpuStatusTypes.resetingFailed;
          app.bpuStatusError=err;

          mainCallback(err);
        } else {
          app.bpuStatus=app.bpuStatusTypes.resetingDone;
          mainCallback(null);
        }
      });
    };

    //Make Bpu If it Doesn't exist 
    if(app.bpu===null) {
      app.logger.warn('application initialization start');
      app.bpu={};
      app.bpu.startTime=null;
      app.bpu.ledControl=require('./leds.js');
      app.bpu.ledControlOptions={
        doTestLeds:false, doRunBlink:true,
        RunPin:9, ValvePin:7,
        diffuserPin:10, diffuserValue:75,
        LedPins:{Top:24, Right:25, Bottom:3, Left:8},
      };
      app.bpu.ledControl.init(app.bpu.ledControlOptions, function(err) {
        if(err) {
          mainCallback(app.bpu.ledControl.init+' '+err);
        } else {
          
          //Bpu Function Wrappers 
          app.bpu.ledsSet=function(lightValues, doReset) {
            if(doReset) lightValues={topValue:0, rightValue:0, bottomValue:0, leftValue:0};
            app.bpu.ledControl.board.ledsSet(lightValues.topValue, lightValues.rightValue, lightValues.bottomValue, lightValues.leftValue);
            lightValues.time=new Date().getTime();
            return lightValues;
          };
          //Flush Thingy
          //Flush Thingy
          //Flush Thingy
          var _doFlushFlag=false;
          var startFlushDate=new Date();
          app.bpu.startFlush=function(data, flushCallback) {
            if(!app.isFlushing) {
              startFlushDate=new Date();
              var flushTime=5*1000;
              if(data && data.flushTime) {
                flushTime=Number(data.flushTime);
              }
              app.isFlushing=true;
              app.logger.info('bpu.startFlush flush for '+flushTime+' ms.');
              var startDate=new Date();
              app.bpu.ledControl.board.valveOpen();
              setTimeout(function() {
                app.bpu.ledControl.board.valveClose();
                app.logger.info('bpu.startFlush flush done in '+(new Date()-startDate));
                app.isFlushing=false;
                flushCallback(null);
              }, flushTime);
            } else {
              flushCallback('bpu.startFlush already flushing');
            }
          };
          //app.startFlush=_startFlush;
          finishInit();
        }
      });
    } else {
      finishInit();
    }
  }
};

//Main Functions
_checkFolders=function(fldsToCheck, callback) {
  var checkFolders=function() {
    if(fldsToCheck.length>0) {
      var fld=fldsToCheck.shift();
      _fs.stat(fld, function(err, dat) {
        if(err) {
          callback(err);
        } else {
          if(dat.mode!==16895 && dat.mode!==16893) {
            callback(fld+':fs stat mode('+dat.mode+')for folder is not 16895');
          } else {
            checkFolders();
          }
        }
      });
    } else {
      callback(null);
    }
  }; 
  checkFolders();
};
_clearTempFolder=function(tempDataDir, callback) {
  var cmdStr='rm '+tempDataDir+'/*.jpg'+' && '+'rm '+tempDataDir+'/*.json';
  runBashCommand(cmdStr, function(err, stdout) {
    if(err) _app.logger.warn('(usually okay folder may be empty is all)clearTempFolder '+err);
    callback(null);
  });
};

//Other Functions
var runBashCommand=function(cmdStr, callback) {
  var child=_exec(cmdStr, function (error, stdout, stderr) {
    if(error!==null) {callback('error: ' + stderr, stdout);
    } else if(stderr) {callback('stderr: ' + stderr, stdout);
    } else if(stdout) {callback(null, stdout);
    } else {callback(null, null);}
  });
};
