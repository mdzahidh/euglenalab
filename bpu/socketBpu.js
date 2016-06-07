exports=module.exports=function(app, deps, opts, mainCallback) {
  var moduleName='socketBpu.js';
  
  //Assert Deps 
  if(app===null) {mainCallback(moduleName+':need app object');
  
  } else if(app.script_runExperiment===null) {mainCallback('need app.script_runExperiment object');
  
  } else if(app.bpuConfig===null) {mainCallback('need app.bpuConfig object');
  } else if(app.bpuStatusTypes===null) {mainCallback('need app.bpuStatusTypes object');
  } else if(app.socketStrs===null) {mainCallback('need app.socketStrs object');
  } else {
 
    //Create Socket Server   
    var server=require('http').createServer(function(req, res) {
      app.logger.warn(moduleName+' fn_serverHandler');
    });
    app.logger.debug(moduleName+' create server on '+app.bpuConfig.localAddr.ip+':'+app.bpuConfig.localAddr.serverPort);
    server.listen(app.bpuConfig.localAddr.serverPort, app.bpuConfig.localAddr.ip);
    app.io=deps.socketIo(server);
    
    app.io.on('connection', function(socket) {
      app.logger.info(moduleName+' app.io.on connection with socketid:'+socket.id);

      //Ping
      //Ping
      //Ping
      socket.on(app.socketStrs.bpu_ping, function(callback) {
        var emitStr=app.socketStrs.bpu_ping;
        var retStr=emitStr+'Res';
        var resObj={err:null, bpuStatus:app.bpuStatus};
        //Log
        //app.logger.info(moduleName+' '+emitStr);
      
        //Run

        //Return 
        socket.emit(retStr, resObj);
        if(typeof callback==='function') callback(resObj.err, resObj);
      });


      //Get Status
      //Get Status
      //Get Status
      socket.on(app.socketStrs.bpu_getStatus, function(callback) {
        //Init
        var emitStr=app.socketStrs.bpu_getStatus;
        var retStr=emitStr+'Res';
        var resObj={
          //id
          index:app.bpuConfig.index,
          name:app.bpuConfig.name,
          //status
          err:null, 
          bpuStatus:app.bpuStatus,
          expOverId:null,
          //Exp 
          exp:null,
          expTimeLeft:0,
        };

        //Log
        //app.logger.info(moduleName+' '+emitStr+':'+app.bpuStatus);
     
        //Run 
        if(app.exp) {
          resObj.exp=app.exp;
          if(app.isExperimentOverAndWaitingForPickup) {
            app.isExperimentOverAndWaitingForPickup=false;
            resObj.expOverId=app.exp._id;
            var opts={};
            app.logger.debug(moduleName+' script_resetBpu '+'start');
            app.script_resetBpu(app, deps, opts, function(err) {
              app.logger.debug(moduleName+' script_resetBpu '+'end');
              if(err) {
                app.logger.error(moduleName+' script_resetBpu '+err);
              } else {
                app.logger.debug(moduleName+' run experiment done READY FOR Next EXPERIMENT');
                callback(null);
              }
            });

          //While Bpu Has Exp: Check for Run Bad Status 
          } else {
            if(app.bpuStatus===app.bpuStatusTypes.runningFailed) {
              app.logger.error('app.exp***********Get Status Bpu Status '+app.bpuStatus+' Error*********'+app.bpuStatusError);
              app.logger.error('app.exp           Make sure this is not a big deal and force reset here');

            } else if(app.bpuStatus===app.bpuStatusTypes.finalizingFailed) {
              app.logger.error('app.exp***********Get Status Bpu Status '+app.bpuStatus+' Error*********'+app.bpuStatusError);
              app.logger.error('app.exp           Make sure this is not a big deal and force reset here');
            
            } else if(app.bpuStatus===app.bpuStatusTypes.resetingFailed) {
              app.logger.error('app.exp***********Get Status Bpu Status '+app.bpuStatus+' Error*********'+app.bpuStatusError);
              app.logger.error('app.exp           Make sure this is not a big deal...reset is being forced');
              app.script_resetBpu(app, deps, {}, function(err) {
                app.logger.debug(moduleName+' script_resetBpu '+'end');
                if(err) {
                  app.logger.error(moduleName+'app.exp force script_resetBpu '+err);
                } else {
                  app.logger.debug(moduleName+'app.exp force reset done done READY FOR Next EXPERIMENT');
                  callback(null);
                }
              });
            
            } else {
              console.log('1', app.exp_eventsRunTime, (new Date().getTime()-app.exp.exp_runStartTime));
              resObj.expTimeLeft=app.exp_eventsRunTime || 0;
              if(app.bpuStatus!==app.bpuStatusTypes.pendingRun) {
                if(app.exp_eventsRunTime && app.exp.exp_runStartTime) {
                  resObj.expTimeLeft=app.exp_eventsRunTime-(new Date().getTime()-app.exp.exp_runStartTime);
                }
              }
              app.logger.trace('Exp Time Left:'+resObj.expTimeLeft);
            }
          }
       
        //While Bpu Does Not Have Exp: Check for Bad Status 
        } else {
          
          if(app.bpuStatus===app.bpuStatusTypes.initializingFailed) {
            app.logger.error('***********Get Status Bpu Status '+app.bpuStatus+' Error*********'+app.bpuStatusError);
            app.logger.error('           Make sure this is not a big deal and force reset here');

          } else if(app.bpuStatus===app.bpuStatusTypes.resetingFailed) {
            app.logger.error('***********Get Status Bpu Status '+app.bpuStatus+' Error*********'+app.bpuStatusError);
            app.logger.error('           Make sure this is not a big deal and force reset here');
          }
        }

        //Return 
        if(typeof callback==='function') callback(resObj);
      });
      
      //Run Experiment
      //Run Experiment
      //Run Experiment
      socket.on(app.socketStrs.bpu_setExp, function(exp, resetTimeout, callback) {
        //Init
        var emitStr=app.socketStrs.bpu_setExp;
        var retStr=emitStr+'Res';
        var resObj={err:null, bpuStatus:app.bpuStatus};

        //Log
        app.logger.info(moduleName+' '+emitStr);
    
        if(app.exp!==null) {
          resObj.err='already has exp';
          //Return 
          if(typeof callback==='function') callback(resObj.err, resObj);
        } else if(app.bpuStatus!==app.bpuStatusTypes.resetingDone) {
          resObj.err='status is not app.bpuStatusTypes.resetingDone its '+app.bpuStatus;
          //Return 
          if(typeof callback==='function') callback(resObj.err, resObj);
        } else if(exp.exp_eventsToRun.length===0) {
          resObj.err='app.exp.exp_eventsToRun.length===0';
          //Return 
          if(typeof callback==='function') callback(resObj.err, resObj);
        } else {
          app.bpuStatus=app.bpuStatusTypes.pendingRun;
          app.exp=exp;
        
          app.exp.exp_eventsToRun.sort(function(objA, objB) {return objB.time-objA.time});
          app.exp_eventsRunTime=app.exp.exp_eventsToRun[0].time;

          app.didConfirmRun=false;
          app.didConfirmTimeoutRun=false;
          setTimeout(function() {
            if(!app.didConfirmRun) {
              app.didConfirmTimeoutRun=true;
              app.script_resetBpu(app, deps, opts, function(err) {
                if(app.bpu===null || app.bpu===undefined) {
                  app.logger.error('socketBpu bpu_setExp reseting issue no app.bpu');
                } else if(err) {
                  app.logger.error('socketBpu bpu_setExp reseting '+err);
                } else {
                  app.logger.debug('socketBpu bpu_setExp READY FOR EXPERIMENT');
                }
              });
            }
          }, resetTimeout);
          //Return 
          if(typeof callback==='function') callback(resObj.err, resObj);
        }
      });
      socket.on(app.socketStrs.bpu_runExp, function(callback) {
        if(!app.didConfirmTimeoutRun && app.exp!==null) {
          app.didConfirmRun=true;
          //If Live Add setleds 
          if(app.exp.group_experimentType==='live') {
            //Set LEDs
            var ledsSet=function(lightData, cb_fn) {
              //Init
              var emitStr=app.socketStrs.bpu_runExpLedsSet;
              var retStr=emitStr+'Res';
              var resObj={err:null, bpuStatus:app.bpuStatus};

              //Log
              //app.logger.info(moduleName+' '+emitStr);
           
              //Run 
              var timeNow=new Date().getTime();
              lightData.setTime=timeNow;
              var doReset=false;
              resObj=app.bpu.ledsSet(lightData, doReset);
              resObj.err=null;
              app.exp.exp_eventsRan.push(resObj);
              //Return 
              if(typeof cb_fn==='function') cb_fn(resObj.err, resObj);
            };
            //Listender
            socket.on(app.socketStrs.bpu_runExpLedsSet, ledsSet);
          }
          
          //Run 
          var options={}; 
          app.logger.debug(moduleName+' script_runExperiment start');
          app.script_runExperiment(app, deps, options, app.exp, function(err) {
            app.logger.debug(moduleName+' script_runExperiment end');
            
            //If Live Add setleds 
            if(app.exp.group_experimentType==='live') {
              socket.removeListener(app.socketStrs.bpu_runExpLedsSet, ledsSet);
            }
            
            if(err) {
              app.logger.error(moduleName+' script_runExperiment '+err);
            } else {
              // if no error set flag for pick, used in get status ping
              if(app.bpuStatus===app.bpuStatusTypes.finalizingDone) {
                app.isExperimentOverAndWaitingForPickup=true;
              }
            } 
          });
          
          //Return 
          if(typeof callback==='function') callback({err:null});
        } else {
          //Return 
          if(typeof callback==='function') callback('already canceled', null);
        }
      });
     
      //Reset Bpu 
      //Reset Bpu 
      //Reset Bpu 
      socket.on(app.socketStrs.bpu_resetBpu, function(isUserCancel, userSessionID) {
        var doReset=true;
        if(isUserCancel) {
          if(app.exp===null || app.exp.session.sessionID!==userSessionID) {
            doReset=false;
          }
        }
        if(doReset) {
          //Init
          var emitStr=app.socketStrs.bpu_resetBpu;
          var retStr=emitStr+'Res';
          var resObj={err:null, bpuStatus:app.bpuStatus};

          //Log
          app.logger.info(moduleName+' '+emitStr);
       
          //Run 
          app.script_resetBpu(app, deps, opts, function(err, data) {
            resObj.resetData=data;
            
            //Return 
            if(typeof callback==='function') callback(resObj.err, resObj);
       
          });
        }
      });

    });
    app.io.on('disconnect', function(data) {
      app.logger.info(moduleName+' app.io.on disconnect');
    });
    
    mainCallback(null);
  }
};


