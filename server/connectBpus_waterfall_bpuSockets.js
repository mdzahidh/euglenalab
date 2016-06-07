'use strict';
var async=require('async');
var socketIoClient=require('socket.io-client');

var _app=null;

var _recheckFailureTimeout=5*60*1000;  //every 5 minutes reset the failure counts if isOn in bpu
var _lastRecheckFailureTimeout=new Date();
var _firstRun=true;
module.exports=function(app, connectLogger, mainCallback) { 
  if(app===null) {
      mainCallback('app is null');
  } else {
    _app=app;
    var seriesCounter=0;
    
    var outcome={
      mainConfig:null,
      bpuObjs:[],
    };
    
    //1
    var getMainConfigBpusAndUpdateMongo=function(callback) {
      seriesCounter++;
      var opts={
        fName:seriesCounter+'. getMainConfigBpusAndUpdateMongo',
        timeout:1000,
      };
      //Check reset failure timeout
      var doRetryFailureTimeouts=false;
      if(_firstRun || new Date()-_lastRecheckFailureTimeout>_recheckFailureTimeout) {
        _firstRun=false;
        doRetryFailureTimeouts=true;
        _lastRecheckFailureTimeout=new Date();
      }
      //Action func 
      _getMainConfigBpusAndUpdateMongo(opts.timeout, function(err, mainConfig, availableBpus) {
        if(err) {
          return callback(opts.fName+' '+err);
        } else {
          outcome.mainConfig=mainConfig;

          availableBpus.forEach(function(bpuDoc) {
            var foundObj=null;
            var wasFailureLimitReached=false;
            app.bpusConnected.forEach(function(connObj) {
              //See if bpu already connected
              if(bpuDoc.name===connObj.bpuDoc.name) {
                //Check connection failure count
                if(connObj.bpuDoc.socket_connectFailureCount<=20 && 
                    connObj.bpuDoc.socket_pingFailureCount<=20 &&
                    connObj.bpuDoc.socket_getStatusFailureCount<=20) {
                  foundObj=connObj;
                } else if(doRetryFailureTimeouts) {
                  foundObj=connObj;
                } else {
                  wasFailureLimitReached=true;
                }
              }
            });
            if(foundObj!==null && !wasFailureLimitReached) {
              outcome.bpuObjs.push({
                bpuDoc:bpuDoc, 
                socket:foundObj.socket,
              });
            } else {
              if(bpuDoc.socket_connectFailureCount<=20 && 
                    bpuDoc.socket_pingFailureCount<=20 && 
                    bpuDoc.socket_getStatusFailureCount<=20) {
                outcome.bpuObjs.push({
                  bpuDoc:bpuDoc, 
                  socket:null,
                }); 
              } else if(doRetryFailureTimeouts) {
                bpuDoc.socket_connectFailureCount=0;
                bpuDoc.socket_pingFailureCount=0;
                bpuDoc.socket_getStatusFailureCount=0;
                outcome.bpuObjs.push({
                  bpuDoc:bpuDoc, 
                  socket:null,
                });
              }
            }
          });
          connectLogger.trace(opts.fName+' mainConfig:'+(mainConfig!==null));
          connectLogger.trace(opts.fName+' app.bpusConnected:'+app.bpusConnected.length);
          connectLogger.trace(opts.fName+' availableBpus:'+availableBpus.length);
          connectLogger.trace(opts.fName+' outcome.bpuObjs:'+outcome.bpuObjs.length);
          return callback(null);
        }
      });
    };
    //2
    var pingConnectSocketForBpus=function(callback) {
      seriesCounter++;
      var opts={
        fName:seriesCounter+'. pingConnectSocketForBpus', 
        timeout:500,
      };
      //Action to Bind to Items - 
      var connectOrPingSocket=function(cb_fn) {
        var bpuObj=this;
        //Connect if Socket Null 
        if(bpuObj.socket===null) {
          connectLogger.trace(opts.fName+' '+bpuObj.bpuDoc.name+' connect start.');
          _connectSocketForBpu(bpuObj, opts.timeout, function(err, socket) {
            if(err) {
              bpuObj.bpuDoc.socket_connectFailureCount++;
              bpuObj.bpuDoc.socket_connectFailureError=opts.fName+' '+bpuObj.bpuDoc.name+' connect('+bpuObj.bpuDoc.socket_connectFailureCount+') '+err;
              connectLogger.error(bpuObj.bpuDoc.socket_connectFailureError);
            } else {
              bpuObj.bpuDoc.socket_connectFailureCount=0;
              bpuObj.bpuDoc.socket_connectFailureError=null;
              bpuObj.bpuDoc.socket_pingFailureCount=0;
              bpuObj.bpuDoc.socket_pingFailureError=null;
              bpuObj.socket=socket;
            }
            bpuObj.bpuDoc.save(function(err, saveDoc) {
              if(err) {
                connectLogger.error(opts.fName+' '+bpuObj.bpuDoc.name+' connect save '+err);
              } else {
                bpuObj.bpuDoc=saveDoc;
              }
              return cb_fn(null);
            });
          }); 

        //Ping and then connect if ping fails
        } else {
          //ping
          _pingSocketForBpu(bpuObj, opts.timeout, outcome.mainConfig.socketStrs.bpu_ping, function(err) {
            if(err) {
              bpuObj.bpuDoc.socket_pingFailureCount++;
              bpuObj.bpuDoc.socket_pingFailureError=opts.fName+' '+bpuObj.bpuDoc.name+' ping '+err;
              connectLogger.warn(bpuObj.bpuDoc.socket_pingFailureError);
              connectLogger.warn(opts.fName+' '+bpuObj.bpuDoc.name+' attempt connect');
              //connect
              _connectSocketForBpu(bpuObj, opts.timeout, function(err, socket) {
                if(err) {
                  bpuObj.bpuDoc.socket_connectFailureCount++;
                  bpuObj.bpuDoc.socket_connectFailureError=opts.fName+' '+bpuObj.bpuDoc.name+' ping->connect('+bpuObj.bpuDoc.socket_connectFailureCount+')'+err;
                  connectLogger.error(bpuObj.bpuDoc.socket_connectFailureError);
                } else {
                  bpuObj.bpuDoc.socket_connectFailureCount=0;
                  bpuObj.bpuDoc.socket_connectFailureError=null;
                  bpuObj.bpuDoc.socket_pingFailureCount=0;
                  bpuObj.bpuDoc.socket_pingFailureError=null;
                  bpuObj.socket=socket;
                }
                bpuObj.bpuDoc.save(function(err, saveDoc) {
                  if(err) {
                    connectLogger.error(opts.fName+' '+bpuObj.bpuDoc.name+' ping->connect save '+err);
                  } else {
                    bpuObj.bpuDoc=saveDoc;
                  }
                  return cb_fn(null);
                });
              }); 
            } else {
              bpuObj.bpuDoc.socket_pingFailureCount=0;
              bpuObj.bpuDoc.socket_pingFailureError=null;
              bpuObj.bpuDoc.save(function(err, saveDoc) {
                if(err) {
                  connectLogger.error(opts.fName+' '+bpuObj.bpuDoc.name+' ping save '+err);
                } else {
                  bpuObj.bpuDoc=saveDoc;
                }
                return cb_fn(null);
              });
            }
          }); 
        }
      };
      //Build Func Array
      var actionFuncs=[];
      outcome.bpuObjs.forEach(function(item) {actionFuncs.push(connectOrPingSocket.bind(item));});
      //Start parallel
      async.parallel(actionFuncs, function(err) {
        if(err) {
          return callback('async.parallel '+err);
        } else {
          return callback(null);
        }
      });  
    };

    //3
    var getStatusForConnectedBpus=function(callback) {
      var opts={
        fName:seriesCounter+'. getStatusForConnectedBpus', 
        timeout:1000,  
      };
      //Action to Bind to Items - 
      var getBpuStatus=function(cb_fn) {
        var bpuObj=this;
        connectLogger.trace(opts.fName+' '+bpuObj.bpuDoc.name+' get status start.');
        _getStatusOfBpu(bpuObj, opts.timeout, outcome.mainConfig.socketStrs.bpu_getStatus, function(err, resObj) {
          if(err) {
            bpuObj.bpuDoc.socket_getStatusFailureCount++;
            bpuObj.bpuDoc.socket_getStatusFailureError=opts.fName+' '+bpuObj.bpuDoc.name+' getStatus '+err;
            connectLogger.error(bpuObj.bpuDoc.socket_getStatusFailureError);
            bpuObj.bpuDoc.save(function(err, saveDoc) {
              if(err) {
                connectLogger.error(opts.fName+' '+bpuObj.bpuDoc.name+' getStatus save '+err);
              } else {
                bpuObj.bpuDoc=saveDoc;
              }
              return cb_fn(null);
            });
          } else {

            //Check for exp complete status
            if(resObj.expOverId!==null && resObj.expOverId!==undefined) {
              bpuObj.bpuDoc.exp_expsToPickUp.push(resObj.expOverId);
            }

            bpuObj.bpuDoc.socket_getStatusFailureCount=0;
            bpuObj.bpuDoc.socket_getStatusFailureError=null;

            bpuObj.bpuDoc.socket_getStatusResObj=resObj;
            bpuObj.bpuDoc.socket_getStatusLastUpdate=new Date();
            bpuObj.bpuDoc.save(function(err, newDoc) {
              if(err) {
                connectLogger.error(opts.fName+' '+bpuObj.bpuDoc.name+' getStatus save '+err);
              }
              return cb_fn(null);
            });
          }
        });
      };
      //Build Func Array
      var actionFuncs=[];
      outcome.bpuObjs.forEach(function(item) {
        if(item.socket!==null && item.socket!==undefined) {
          actionFuncs.push(getBpuStatus.bind(item));
        }
      });
      //Start parallel
      async.parallel(actionFuncs, function(err) {
        if(err) {
          return callback(opts.funcName+':'+err);
        } else {
          return callback(null);
        }
      });  
    };
    
    //Series Funcs
    var funcs=[];
    funcs.push(getMainConfigBpusAndUpdateMongo);
    funcs.push(pingConnectSocketForBpus);
    funcs.push(getStatusForConnectedBpus);
    //Start WaterFall 
    var funcStartTime=new Date();
    connectLogger.info('start');
    async.series(funcs, function(err) {
      connectLogger.info('end in '+(new Date()-funcStartTime)+' ms');
      //strip bpu objs with no sockets
      var bpuObjsWithSockets=[];
      var bpuStatsForClientBrowser=[];
      outcome.bpuObjs.forEach(function(bpuObj) {
        if(bpuObj.socket!==null) {
          bpuObjsWithSockets.push(bpuObj);
          bpuStatsForClientBrowser.push(bpuObj.bpuDoc);
        }
      });
      mainCallback(err, {mainConfig:outcome.mainConfig, bpuObjs:bpuObjsWithSockets, bpuStatsForClientBrowser:bpuStatsForClientBrowser});
    }); 
  }
};

//Main Functions
var _getMainConfigBpusAndUpdateMongo=function(timeout, callback) {
  var didCallback=false;
  setTimeout(function() {
    if(!didCallback) {
      didCallback=true;
      callback('timed out', null, null);
    }
  }, timeout);
  _app.db.models.Bpu.setMainConfigBpus(function(err, mainConfigAndBpus) {
    if(!didCallback) {
      didCallback=true;
      if(err) {
        callback('Bpu.setMainConfigBpus '+err, null, null);
      } else if(mainConfigAndBpus.mainConfig===null || mainConfigAndBpus.mainConfig===undefined) {
        callback('Bpu.setMainConfigBpus '+'no mainConfig object', null, null);
      } else if(mainConfigAndBpus.savedBpus.length===0) {
        callback('Bpu.setMainConfigBpus '+'no bpus in mainConfig', null, null);
      } else {
        //Filter Config bpus by isOn 
        var availableBpus=mainConfigAndBpus.savedBpus.filter(function(bpu) {return bpu.isOn;}); 
        if(availableBpus.length===0) {
          callback('Bpu.setMainConfigBpus '+'no isOn Bpus after filter', null, null);
        } else {
          callback(null, mainConfigAndBpus.mainConfig, availableBpus);
        }
      }
    }
  });
};
var _connectSocketForBpu=function(bpuObj, timeout, callback) {
  var didCallback=false;
  setTimeout(function() {
    if(!didCallback) {
      didCallback=true;
      callback('timed out', null);
    }
  }, timeout);
  
  var addr='http://'+bpuObj.bpuDoc.localAddr.ip+':'+bpuObj.bpuDoc.localAddr.serverPort;  
  var socket=socketIoClient(addr, {multiplex:false, reconnection:false});
  socket.on('connect', function () {
    if(!didCallback) {
      didCallback=true;
      socket.bpuName=bpuObj.bpuDoc.name;
      socket.connectDate=new Date();
      callback(null, socket);
    }
  });
  socket.on('disconnect', function(msg) {
    socket.disconnect();
    socket.close();
  });
};
var _pingSocketForBpu=function(bpuObj, timeout, emitStr, callback) {
  if(bpuObj.socket) {
    var didCallback=false;
    setTimeout(function() {
      if(!didCallback) {
        didCallback=true;
        callback('timed out', null);
      }
    }, timeout);
    bpuObj.socket.emit(emitStr, function(err, resObj) {
      if(!didCallback) {
        didCallback=true;
        callback(err, resObj);
      }
    });
  } else {
    callback('no socket for bpu', null);
  }
};
var _getStatusOfBpu=function(bpuObj, timeout, emitStr, callback) {
  if(bpuObj.socket) {
    var didCallback=false;
    var aasdf=setTimeout(function() {
      if(!didCallback) {
        didCallback=true;
        callback('timed out', null);
      }
    }, timeout);
    bpuObj.socket.emit(emitStr, function(err, resObj) {
      if(!didCallback) {
        didCallback=true;
        callback(err, resObj);
      }
    });
  } else {
    callback('no socket for bpu', null);
  }
};
