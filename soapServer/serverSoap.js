var fs=require('fs');
var http=require('http');
var async=require('async');
var clientIO=require('socket.io-client');
var mongoose=require('mongoose');


var decoder=require('../shared/en_de_code_T4Leds.js');
var Identifier='C56A80D928264A0A900B30D610EDCB95';
var PassKey='ZTUzYzU3OGE5NmM2MjZmNDIzNTVhMjlm';

var mainConfig=require('../shared/mainConfig.js');
var myMongoUri=mainConfig.adminFlags.getMongoUri();
var myServerPort=mainConfig.adminFlags.getWebServerPort();
var myServerAddr=mainConfig.adminFlags.getWebServerAddr();
var app={
  Identifier:'C56A80D928264A0A900B30D610EDCB95',
  PassKey:'ZTUzYzU3OGE5NmM2MjZmNDIzNTVhMjlm',
};
app.db=null;
app.log4js=require('log4js');
app.config={
  isDevelopment:false,
  mongoUri:myMongoUri,
};
app.get=function() {
  return 'development';
}
app.config.loginAttempts = {
  forIp: 50,
  forIpAndUser: 7,
  logExpiration: '20m'
};
app.thisPort=8080;
app.serverHandler=require('./handlerSoap.js');

app.client={
  addr:myServerAddr,
  socket:null,
}

app.mainConfig=require('../shared/mainConfig.js');
app.myFuncs=require('../shared/myFunctions.js');
  
var init=function() {
  connectToMongo(function(err) {
    console.log('soapServer.js mongoose open on '+app.config.mongoUri+' with err:'+err);
    connectToServer(function(err) {
      console.log('soapServer.js socket connect to '+app.client.addr+' with err:', err);
      buildServer(function(err) {
        console.log('soapServer.js Listening on Port '+app.thisPort+ ' with err:'+err);
      });
    });
  });
};
//HTTP Server Listener
var buildServer=function(callback) {
  //Fail Response 
  function respondFailNew(res, reqType, err) {
    console.log('soapServer.js respondFail for reqType:'+reqType+' with err:'+err);
    /* 
    res.writeHead(200, {
      "Content-Type":"text/xml; charset=utf-8;",
      "Content-Length":Buffer.byteLength(err, 'utf8'),
    });
    res.write('Error: '+err);
    res.end();
    */
  } 
  function respondFail(res, reqType, err) {
    console.log('soapServer.js respondFail for reqType:'+reqType+' with err:'+err);
    res.writeHead(200, {
      "Content-Type":"text/xml; charset=utf-8;",
      "Content-Length":Buffer.byteLength(err, 'utf8'),
    });
    res.write('Error: '+err);
    res.end();
  } 
  //Pass Response 
  function respondPass(res, reqType, msg, response) {
    console.log('soapServer.js respondPass for reqType:'+reqType+' with msg:'+msg);
    res.writeHead(200, {
      "Content-Type":"text/xml; charset=utf-8;",
      "Content-Length":Buffer.byteLength(response, 'utf8'),
    });
    var printResponse=false;
    if(!printResponse && response.length>10000) {
      console.log('\t'+'xml response length:'+response.length);
    } else {
      console.log(response);
    }
    try {
      res.write(response);
      res.end();
    } catch(err) {
      console.log('respondPass try caught err:'+err);
    }
  } 
  var server=http.createServer(function(req, res) {
    console.log('...................................................');
    /*
    app.db.models.SoapReq.getNew(req, function(err, soapReq) {
      if(err) {
        respondFailNew(res, 'Not Found', err);
      } else {
        soapReq.save(function(err, dat) {
          if(!soapReq.auth.didPass) {
            respondFailNew(res, 'Not Found', soapReq.auth.err);
          } else if(!soapReq.reqObj.didPass) {
            respondFailNew(res, soapReq.reqObj.type, soapReq.reqObj.err);
          } else {
            console.log(soapReq);
          }
        });
      }
    });
    */
    var reqType='not determined yet'; 
    //Timeout 
    var timeoutInterval=10000; 
    var didTimeout=false;
    var didRespond=false;
    var soapTm=setTimeout(function() {
      if(!didRespond) {
        didTimeout=true;
        respondFail(res, reqType, 'from timeout ping main server timed out in '+timeoutInterval+' ms');
      }
    }, timeoutInterval);
    
    var checkTmAndCallback=function(err, cb) {
      if(err) {
        cb(err);
      } else if(didTimeout) {
        cb('checkTmAndCallback stop');
      } else {
        cb(null);
      }
    };
    //Waterfall
    var outcome={
      reqObj:null,
      bpuObjs:null,
      minTimeBpuData:null,
      resXml:null,
    };
    var basicReqCheck=function(cb_fn) {
      app.serverHandler.checkReq(app, req, function(err, reqObj) {
        console.log('\n'+'*********************');
        if(reqObj===null || reqObj.type===undefined || reqObj===null || reqObj.type===undefined) {
          err='req obj stuff was null';
          console.log('basicReqCheck type '+'null'+' with err:'+err);
        } else {
          outcome.reqObj=reqObj;
          reqType=reqObj.type;
          console.log('basicReqCheck type '+reqObj.type+' with err:'+err);
        }
        checkTmAndCallback(err, cb_fn);
      });
    };
    var getBpuData=function(cb_fn) {
      app.client.myEmits.setConnection({}, function(err, bpuObjs) {
        console.log('\n\n'+'***********'+'getBpuData'+'********');
        console.log('getBpuData count ', bpuObjs.length);
        outcome.bpuObjs=bpuObjs;
        var bpuCnt=0;
        if(outcome.bpuObjs.forEach!==null && outcome.bpuObjs.forEach!==undefined) {
          outcome.bpuObjs.forEach(function(bpuObj) {
            bpuCnt++;
            bpuObj.processingTimePerExperiment=60000;
            bpuObj.effectiveQueueLength=bpuObj.currentList.length;
            bpuObj.estWait=0;
            bpuObj.runningExpTag=null;
            if(bpuObj.currentList.forEach!==null || bpuObj.currentList.forEach!==undefined && bpuObj.currentList.length>0) {
              bpuObj.currentList.sort(function(a, b) {return new Date(a.creationDate)-new Date(b.creationDate);});
            }
            if((bpuObj.currentStatus!==null && bpuObj.currentStatus!==undefined) && 
              bpuObj.currentStatus.bpuStatus===mainConfig.bpuStatusTypes.expRunning ||
              bpuObj.currentStatus.bpuStatus===mainConfig.bpuStatusTypes.dataPacking ||
              bpuObj.currentStatus.bpuStatus===mainConfig.bpuStatusTypes.dataProcessing) {
              var runnExpTag={
                expId:bpuObj.currentStatus.expId,
                isRunOver:false,
                isCanceled:false,
                isRunning:true,
                isWaitingToRun:false,
                runTime:bpuObj.currentStatus.runTime,
                timeToFinish:bpuObj.currentStatus.timeLeft+bpuObj.processingTimePerExperiment,
                timeToLive:0,
              };
              bpuObj.estWait+=runnExpTag.timeToFinish;
              bpuObj.runningExpTag=runnExpTag;
            } else if(bpuObj.currentStatus.bpuStatus===mainConfig.bpuStatusTypes.expRunningDone) {
              var runnExpTag={
                expId:bpuObj.currentStatus.expId,
                isRunOver:false,
                isCanceled:false,
                isRunning:true,
                isWaitingToRun:false,
                runTime:bpuObj.currentStatus.runTime,
                timeToFinish:bpuObj.processingTimePerExperiment,
                timeToLive:0,
              }
              bpuObj.estWait+=runnExpTag.timeToFinish;
              bpuObj.runningExpTag=runnExpTag;
            }
            var doPrint=false;
            if(doPrint) {
              console.log('bpuCnt'+'\t'+'bpuName'+'\t'+'bpuStatus'+'\t'+'queueLength');
              console.log(bpuCnt+'\t'+bpuObj.name+'\t'+bpuObj.currentStatus.bpuStatus+'\t'+'\t'+bpuObj.effectiveQueueLength);
              console.log('expCnt'+'\t'+'soapId'+'\t'+'runTime'+'\t'+'timeLeft'+'\t'
                +'timeToLive'+'\t'+'timeToFinish'+'\t'+'diff'+'\t'+'proctime'+'\t'
                +'isWaitingToRun'+'\t'+'isRunning'+'\t'+'isRunOver'+'\t'+'isCanceled');
              var expCnt=0;
              bpuObj.currentList.forEach(function(expTag) {
                expCnt++;
                var runTime=Number(expTag.runTime);
                var timeLeft=Number(expTag.timeLeft);
                expTag.timeToLive=bpuObj.estWait;
                expTag.timeToFinish=+expTag.timeToLive+runTime+bpuObj.processingTimePerExperiment;
                bpuObj.estWait+=runTime+bpuObj.processingTimePerExperiment;
                console.log(expCnt+'\t'
                  +expTag.soapExperimentId+'\t'
                  +expTag.runTime+'\t'
                  +expTag.timeLeft+'\t'+'\t'
                  +expTag.timeToLive+'\t'+'\t'
                  +expTag.timeToFinish+'\t'+'\t'
                  +Number(expTag.timeToFinish-expTag.timeToLive)+'\t'
                  +Number(expTag.timeToFinish-expTag.timeToLive-expTag.runTime)+'\t'+'\t'
                  +expTag.isWaitingToRun+'\t'+'\t'
                  +expTag.isRunning+'\t'+'\t'
                  +expTag.isRunOver+'\t'+'\t'
                  +expTag.isCanceled
                );
              });
            }
          });
          console.log(outcome.bpuObjs.length);
          if(outcome.bpuObjs.length===1) {
            outcome.minTimeBpuData=outcome.bpuObjs[0];
            console.log('minTimeBpuData '+outcome.minTimeBpuData.name+' estWait:'+outcome.minTimeBpuData.estWait+' effectiveQueueLength:'+outcome.minTimeBpuData.effectiveQueueLength);
          } else if(outcome.bpuObjs.length>1) {
            outcome.bpuObjs.sort(function(a, b) {return a.estWait-b.estWait});
            outcome.minTimeBpuData=outcome.bpuObjs[0];
            console.log('minTimeBpuData '+outcome.minTimeBpuData.name+' estWait:'+outcome.minTimeBpuData.estWait+' effectiveQueueLength:'+outcome.minTimeBpuData.effectiveQueueLength);
          } else {
            err='no bpus';
          }
        } else {
          err='no bpus';
        }
        checkTmAndCallback(err, cb_fn);
      });
    };
    var checkSubmit=function(cb_fn) {
      if(outcome.reqObj.type==='Submit' || outcome.reqObj.type==='Validate') {
        var joinQueueData=app.db.models.BpuExperiment.getDataObjToJoinQueue();
        
        joinQueueData.user.username='nwgclient001';
        joinQueueData.experimentType.isSoap=true;
        
        joinQueueData.experimentData.soap.id=outcome.reqObj.experimentID;
        joinQueueData.experimentData.soap.type=outcome.reqObj.type;
        decoder.decode(outcome.reqObj.experimentSpecification, function(err, dataObj) {
          var hackForTimeZero=function() {
          //TODO:HACK remove
            if(dataObj.forEach!==null || dataObj.forEach!==undefined) {
              dataObj.sort(function(a, b) {return a.time-b.time;});
              if(dataObj[0].time>0) {
                dataObj.push({time:0, topValue:0, rightValue:0, bottomValue:0, leftValue:0})
              }
            }
          };
          hackForTimeZero();
          joinQueueData.experimentData.soap.eventsToRun=dataObj;
          app.client.myEmits.joinQueue(joinQueueData, function(err, resData) {
            outcome.reqObj.accepted=resData.didPass;
            outcome.reqObj.errorMessage=resData.err;
            outcome.reqObj.estRuntime=resData.estRuntime;
            outcome.reqObj.submitTag=resData.tag;
            checkTmAndCallback(err, cb_fn);
          });
        });
      } else {
        checkTmAndCallback(null, cb_fn);
      }
    };
    var processReqWithBpuData=function(cb_fn) {
      console.log('\n'+'processReqWithBpuData...');
      app.serverHandler.processReq(app, outcome.reqObj, outcome.bpuObjs, outcome.minTimeBpuData, function(errNoXml, err, resXml) {
        if(errNoXml) {
          checkTmAndCallback(errNoXml, cb_fn);
        } else {
          outcome.resXml=resXml;
          checkTmAndCallback(null, cb_fn);
        }
      });
    };
    var asyncFinally=function(err) {
      console.log('asyncFinally with err:'+err);
      didRespond=true;
      if(!didTimeout) {
        didRespond=true;
        if(err) {
          respondFail(res, reqType, err);
        } else {
          respondPass(res, reqType, 'okay', outcome.resXml);
        }
      }
    };
    async.waterfall([
      basicReqCheck,
      getBpuData,
      checkSubmit,
      processReqWithBpuData,
    ], asyncFinally);
  });
  server.listen(app.thisPort, function() {
    callback(null);
  });
};
//Internal Socket Client 
var clientConnected=false;
var connectToServer=function(callback) {
  console.log(app.client.addr);
  app.client.socket=clientIO(app.client.addr, {multiplex:false});
  app.client.socket.on('connect', function () {
    if(!clientConnected) {
      clientConnected=true;
      app.client.myEmits.setConnection({msg:'this object set in emit function'}, function(err, bpuData) {
        if(err) {
          callback(err);
        } else {
          callback(null);
        }
      });
    }
  });
  app.client.socket.on('disconnect', function(msg) {
    console.log('\n'+'soapServer.js on disconnect', app.client.addr);
  });
  app.client.socket.on('/soapServer/#updateBpus', function(bpusStatus) {
    app.client.socket.emit('/soapServer/#updateBpusRes');
  });
  //Emits 
  app.client.myEmits={
    setConnection:function(data, cb_fn) {
      var data={
        username:'nwgclient001',
        sessionID:app.Identifier,
        socketID:app.client.socket.id,
      };
      var emitStr='/soapServer/#setConnection';
      var resStr=emitStr+'Res';
      var resFunc=function(bpuData) {
        app.client.socket.removeListener(resStr, resFunc);
        if(cb_fn) cb_fn(null, bpuData);
      }
      app.client.socket.on(resStr, resFunc);
      app.client.socket.emit(emitStr, data);
    },
    joinQueue:function(data, cb_fn) {
      var emitStr='/soapServer/#joinQueue';
      var resStr=emitStr+'Res';
      var resFunc=function(bpuData) {
        app.client.socket.removeListener(resStr, resFunc);
        if(cb_fn) cb_fn(null, bpuData);
      }
      app.client.socket.on(resStr, resFunc);
      app.client.socket.emit(emitStr, data);
    },
  };
};
//Connect To Db
var connectToMongo=function(callback) {
  app.db=mongoose.createConnection(app.config.mongoUri);
  app.db.on('error', function(err) {
    callback(err);
  });
  app.db.once('open', function () {
    require('../shared/mongoDb/schema/models')(app, mongoose);
    callback(null);
  });
};
init();
