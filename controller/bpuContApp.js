var socketIo=require('socket.io');
var socketIoClient=require('socket.io-client');
var async=require('async');
var log4js=require('log4js');
var mongoose = require('mongoose');
//Constants
var _Name='bpuController';
var StartDate=new Date();
//Main Object
var app={
  initParams:{
    //Logger //ALL, TRACE, DEBUG, INFO, WARN, ERROR, FATAL, OFF
    loggerName:_Name,

    loggerLevel:'ERROR',
    //Mongo/Mongoose DB
    mongoUri:require('../shared/mainConfig.js').adminFlags.getMongoUri(), // production, dev, stage
    socketClientServerIP:'localhost',
    socketClientServerPort:require('../shared/mainConfig.js').adminFlags.getControllerPort(),
  },
  runParams:{
    mongooseObjID:mongoose.Types.ObjectId,
    doClearConsole:false,

    runCounter:0,
    SocketTimeoutTillReset:30,
    //doPrintMemHeader:true,
    doPrintMemHeader:true,
    doPrintExpErrors:true,
    doPrintCheckBpusErrors:true,
    doPrintLiveActivateErrors:true,
    errorRemoveMs:60000,
    maxErrorPrint:5,
    runLoopInterval:1000,
    liveUserConfirmTimeout:15000,
    lastScripterSendDate:new Date(),
    doSendScripters:true,
    ScripterSendInterval: 30*60*1000,
    nextToSendBpuName:null,
  },
  runData:{
    firstMemObj:null,
    currMemObj:null,
    addExpToBpuErrors:[],
    activateLiveUserErrors:[],
    checkBpusErrors:[],
    runningQueueTimesPerBpuName:{},
  },

  //Files
  funcs:require('../shared/myFunctions.js'),
  mainConfig:require('../shared/mainConfig.js'),
  //Socket Functions
  submitExperimentRequestHandler:require('./contScripts/submitExperimentRequestHandler.js'),

  //Sub Objects
  logger:null,
  db:null,
  bpuObjects:{},
  socketConnections:[],

  listExperimentDoc:null,
  newExpTagObj:{},
  keeperExpDocs:[],

  //Store Session Memory
  memDoc:{
    last:{},
    diff:{}
  },

  bpuLedsSetFuncs:{},
  bpuLedsSetMatch:{},

  Auth:{
    C422691AA38F9A86EC02CB7B55D5F542:{
      Name:'radiantllama',
      Identifier:'C422691AA38F9A86EC02CB7B55D5F542',
      arePassKeysOpen:false,
      PassKeys:[
        'i4bP9hXwNA3WuH0p6m0TCUIA9Wtz0Ydu',
      ],
      socketID:null,
      serverInfo:null,
    },
    b3cagcde2684ebd2cba325555ec2703b:{
      Name:'InternalWeb1',
      Identifier:'b3cagcde2684ebd2cba325555ec2703b',
      arePassKeysOpen:true,
      PassKeys:[],
      socketID:null,
      serverInfo:null,
    },
    b3cagcde2684ebd2cba325555ec2703c:{
      Name:'InternalWeb2',
          Identifier:'b3cagcde2684ebd2cba325555ec2703c',
          arePassKeysOpen:true,
          PassKeys:[],
          socketID:null,
          serverInfo:null,
    },
  },
};

//Init Series Functions
var setupLogger=function(callback) {
  app.logger=log4js.getLogger(app.initParams.loggerName);
  app.logger.setLevel(app.initParams.loggerLevel);
  callback(null);
};
var setupMongoose=function(callback) {
  console.log('Using database at: ' + app.initParams.mongoUri);
  app.db=mongoose.createConnection(app.initParams.mongoUri);
  app.db.on('error', function(err) {
    callback('init setupMongoose error:'+err);
  });
  app.db.once('open', function () {
    require('./mongoModels')(app, mongoose);
    callback(null);
  });
};
function _objectHasAuthKey(obj, key) {
  if(obj[key]!==null && obj[key]!==undefined &&
    typeof obj[key]==='string' && obj[key].length===32) {
      return true;
  } else {
    return false;
  }
};

var setupSocketClientServer=function(callback) {
  //Create Socket Server
  var server=require('http').createServer(function(req, res) {
    app.logger.warn(moduleName+' fn_serverHandler');
  });
  app.logger.debug('setupSocketClientServer@'+app.initParams.socketClientServerIP+':'+app.initParams.socketClientServerPort);
  console.log('setupSocketClientServer@'+app.initParams.socketClientServerIP+':'+app.initParams.socketClientServerPort);
  server.listen(app.initParams.socketClientServerPort, app.initParams.socketClientServerIP);
  app.socketClientIo=socketIo(server);
  app.socketClientIo.on('connection', function(socket) {
    app.logger.info('socketClientIo:'+'connection:'+'socketid:'+socket.id);
    console.log('socketClientIo:'+'connection:'+'socketid:'+socket.id);
    app.socketConnections.push(socket);
    socket.on('setConnection', function(serverInfo, cbfn_setConn) {
      _verifyServerSocketConnection(serverInfo, function(err) {
        if(err) {
          console.log('setConnection _verifyServerSocketConnection end err', err);
          socket.disconnect();
          socket.close();
          cbfn_setConn(err, null);
        } else {
          if(app.Auth[serverInfo.Identifier].socketID!==null) {
            console.log('remove old socket for Auth');
            if(app.socketConnections.length>0) {
              app.socketConnections.forEach(function(otherSocket) {
                if(otherSocket.id===app.Auth[serverInfo.Identifier].socketID) {
                  console.log('Duplicate server info: Disconnecting');
                  otherSocket.disconnect();
                }
              });
            }
          }

          app.Auth[serverInfo.Identifier].socketID=socket.id;
          var retData={};
          retData.Identifier=app.Auth[serverInfo.Identifier].Identifier;
          retData.Name=app.Auth[serverInfo.Identifier].Name;
          retData.arePassKeysOpen=app.Auth[serverInfo.Identifier].arePassKeysOpen;
          retData.PassKeys=app.Auth[serverInfo.Identifier].PassKeys;

          cbfn_setConn(null, retData);

          //Setup socket funcs
          socket.on('getJoinQueueDataObj', function(serverInfo, callback) {
            _verifyServerSocketConnection(serverInfo, function(err) {
              if(err) {
                console.log('getJoinQueueDataObj _verifyServerSocketConnection end err', err);
                socket.disconnect();
                socket.close();
                socket=null;
                cbfn_setConn(err, null);
              } else {
                callback(null, app.db.models.BpuExperiment.getDataObjToJoinQueue());
              }
            });
          });
          socket.on(app.mainConfig.socketStrs.bpu_runExpLedsSet, function(lightData) {
            if(app.bpuLedsSetMatch[lightData.sessionID]) {
              app.bpuLedsSetMatch[lightData.sessionID](lightData);
            }
          });
          socket.on('getExp', function(serverInfo, expId, callbackToClient) {
            //pull exp by id
            callbackToClient('not implemented', null);
          });
          socket.on(app.mainConfig.socketStrs.bpuCont_submitExperimentRequest, function(serverInfo, joinQueueDataArray, callbackToClient) {
            _verifyServerSocketConnection(serverInfo, function(err) {
              if(err) {
                console.log('submitExperimentRequest _verifyServerSocketConnection end err', err);
                socket.disconnect();
                socket.close();
                socket=null;
                cbfn_setConn(err, null);
              } else {
                app.submitExperimentRequestHandler(app, serverInfo, joinQueueDataArray, callbackToClient);
              }
            });
          });
        }
      });
    });
  });
  callback(null);
};
var getListExperiment=function(callback) {
  app.db.models.ListExperiment.getInstanceDocument(function(err, listDoc) {
    if(err) {
      callback('init getListExperiment error:'+err);
    } else {
      app.listExperimentDoc=listDoc;
      callback(null);
    }
  });
};

//Init Function
var init=function(callbackToMain) {
  //Build Init Series
  var initSeriesFuncs=[];
  initSeriesFuncs.push(setupLogger);
  initSeriesFuncs.push(setupMongoose);
  initSeriesFuncs.push(setupSocketClientServer);
  initSeriesFuncs.push(getListExperiment);
  //initSeriesFuncs.push(addFakeExpsToListExpDoc);
  //Run Init Series
  async.series(initSeriesFuncs, function(err) {
    if(err) {
      callbackToMain('initSeries end err:'+err);
    } else {
      callbackToMain(null);
    }
  });
};

//Run Loop with Run Functions
var loop=function() {
  if(app.runParams.doClearConsole) app.funcs.clearConsole();
  var startDate=new Date();

  var saveMemInfo=function(callback) {
    //Temp Current Mem Info
    app.runData.currMemObj=process.memoryUsage();
    //Socket Connections
    app.memDoc.socketConns=app.socketConnections.length;
    //High Mem
    if(app.memDoc.last.heapUsed>app.memDoc.highMem) app.memDoc.high=app.memDoc.last.heapUsed;
    //Set Diff between first and current
    app.memDoc.diff.rss=app.runData.currMemObj.rss-app.runData.firstMemObj.rss;
    app.memDoc.diff.heapTotal=app.runData.currMemObj.heapTotal-app.runData.firstMemObj.heapTotal;
    app.memDoc.diff.heapUsed=app.runData.currMemObj.heapUsed-app.runData.firstMemObj.heapUsed;
    //Save current
    app.memDoc.last.rss=app.runData.currMemObj.rss;
    app.memDoc.last.heapTotal=app.runData.currMemObj.heapTotal;
    app.memDoc.last.heapUsed=app.runData.currMemObj.heapUsed;
    //Set Time
    app.memDoc.lastDate=startDate;
    return callback(null);
  };

  var printMemHeader=function(callback) {
    var memDiv=1024*1024;
    app.logger.info('H     Current Date:\t'+  app.memDoc.lastDate);
    app.logger.info('H       Sock Conns:\t'+  app.memDoc.socketConns);
    app.logger.info('H         Up  Time:\t'+  (Math.round((app.memDoc.lastDate-StartDate)/1000)));
    app.logger.info('H         High Mem:\t'+  Math.round((app.memDoc.highMem)/(memDiv)));
    app.logger.info('H Curr(rss,tot,use):\t'+ '('+
        Math.round(app.memDoc.last.rss/(memDiv))+
        ','+Math.round(app.memDoc.last.heapTotal/(memDiv))+
        ','+Math.round(app.memDoc.last.heapUsed/(memDiv))+
        ')');
    app.logger.info('H Diff(rss,tot,use):\t'+ '('+
        Math.round((app.memDoc.diff.rss)/(memDiv))+
        ','+Math.round((app.memDoc.diff.heapTotal)/(memDiv))+
        ','+Math.round((app.memDoc.diff.heapUsed)/(memDiv))+
        ')'+'\n');
    return callback(null);
  };

  var printExpErrors=function(callback) {
    //Sort, oldest first
    app.runData.addExpToBpuErrors.sort(function(objA, objB) {return objA.time-objB.time;});
    if(app.runData.addExpToBpuErrors.length===0) {
      app.logger.info('H addExp errors:\t'+  app.runData.addExpToBpuErrors.length+'\n');
    } else {
      app.logger.info('H addExp errors:\t'+  app.runData.addExpToBpuErrors.length);
      //Errors for adding exp to bpu-- this process is async with loop
      for(var ind=0;ind<app.runData.addExpToBpuErrors.length;ind++) {
        var errObj=app.runData.addExpToBpuErrors[ind];
        if(ind<app.runParams.maxErrorPrint || true) {
          var ageMs=startDate-errObj.time;
          if(ageMs<app.runParams.errorRemoveMs) {
            if(app.runData.addExpToBpuErrors.length-1===ind || app.runParams.maxErrorPrint-1===ind && app.runData.addExpToBpuErrors.length!==1) {
              app.logger.error('H Error addExp:'+(Math.floor(ageMs/1000))+' '+errObj.err);
            } else {
              app.logger.error('H Error addExp:'+(Math.floor(ageMs/1000))+' '+errObj.err+'\n');
            }
          } else {
            app.runData.addExpToBpuErrors.splice(ind, 1);
            ind--;
          }
        } else {
          break;
        }
      }
    }
    return callback(null);
  };
  var printLiveActivateErrors=function(callback) {
    //Sort, oldest first
    app.runData.activateLiveUserErrors.sort(function(objA, objB) {return objA.time-objB.time;});
    if(app.runData.activateLiveUserErrors.length===0) {
      app.logger.info('H liveAct errors:\t'+  app.runData.activateLiveUserErrors.length+'\n');
    } else {
      app.logger.error('H liveAct errors:\t'+  app.runData.activateLiveUserErrors.length);
      //Errors for adding exp to bpu-- this process is async with loop
      for(var ind=0;ind<app.runData.activateLiveUserErrors.length;ind++) {
        var errObj=app.runData.activateLiveUserErrors[ind];
        if(ind<app.runParams.maxErrorPrint || true) {
          var ageMs=startDate-errObj.time;
          if(ageMs<app.runParams.errorRemoveMs) {
            if(app.runData.activateLiveUserErrors.length-1===ind || app.runParams.maxErrorPrint-1===ind) {
              app.logger.error('H Error liveAct:'+(Math.floor(ageMs/1000))+' '+errObj.err+'\n');
            } else {
              app.logger.error('H Error liveAct:'+(Math.floor(ageMs/1000))+' '+errObj.err+'\n');
            }

          } else {
            app.runData.activateLiveUserErrors.splice(ind, 1);
            ind--;
          }

        } else {
          break;
        }
      }
    }
    return callback(null);
  };
  var printCheckBpusErrors=function(callback) {
    //Sort, oldest first
    app.runData.checkBpusErrors.sort(function(objA, objB) {return objA.time-objB.time;});
    if(app.runData.checkBpusErrors.length===0) {
      app.logger.info('H chkBpu errors:\t'+  app.runData.checkBpusErrors.length+'\n');
    } else {
      app.logger.error('H chkBpu errors:\t'+  app.runData.checkBpusErrors.length);
      //Errors for adding exp to bpu-- this process is async with loop
      for(var ind=0;ind<app.runData.checkBpusErrors.length;ind++) {
        var errObj=app.runData.checkBpusErrors[ind];
        if(ind<app.runParams.maxErrorPrint || true) {
          var ageMs=startDate-errObj.time;
          if(ageMs<app.runParams.errorRemoveMs) {
            if(app.runData.checkBpusErrors.length-1===ind || app.runParams.maxErrorPrint-1===ind) {
              app.logger.error('H Error chkBpu:'+(Math.floor(ageMs/1000))+' '+errObj.err+'\n');
            } else {
              app.logger.error('H Error chkBpu:'+(Math.floor(ageMs/1000))+' '+errObj.err+'\n');
            }

          } else {
            app.runData.checkBpusErrors.splice(ind, 1);
            ind--;
          }

        } else {
          break;
        }
      }
    }
    return callback(null);
  };
  //Two Funcs
  var getBpus=function(callback) {
    var query=app.db.models.Bpu.find({
      isOn:true,
    });
    query.select('isOn bpuStatus index name magnification allowedGroups localAddr publicAddr bpu_processingTime session liveBpuExperiment performanceScores');
    query.exec(function(err, docs) {
      if(err) {
        return callback('getBpus error:'+err);
      } else {
        docs.forEach(function(bpuDoc) {
          //Object Already Exists
          if(app.bpuObjects[bpuDoc.name]) {
            app.bpuObjects[bpuDoc.name].doc=bpuDoc;
          } else {
            app.bpuObjects[bpuDoc.name]={
              doc:bpuDoc,
              socket:null,
              socketTimeouts:0,
              queueTime:0,
              checkMsgs:[],
              isSocketOkay:false,
            };
          }

        });
        return callback(null);
      }
    });
  };
  var checkBpus=function(callback) {
    //Sub func -- individual bpu socket functions
    var fn_connectBpu=function(bpuObj, cb_connectBpu) {
      //Create New Socket
      if(bpuObj.socket===null) {
        bpuObj.socket=socketIoClient('http://'+bpuObj.doc.localAddr.ip+':'+bpuObj.doc.localAddr.serverPort, {multiplex:false, reconnection:true});
        bpuObj.socket.on('connect', function () {
        });
        bpuObj.socket.on('disconnect', function(msg) {
          bpuObj.socket.disconnect();
          bpuObj.socket.close();
          delete bpuObj.socket;
          bpuObj.socketTimeouts=0;
          bpuObj.socket=null;
        });
        app.bpuLedsSetFuncs[bpuObj.doc.name]=function(setLedsData) {
          bpuObj.socket.emit(app.mainConfig.socketStrs.bpu_runExpLedsSet, setLedsData);
        };
        setTimeout(function() {
          cb_connectBpu(null);
        }, 500);
      } else {
        if(bpuObj.socketTimeouts>app.runParams.SocketTimeoutTillReset) {
          bpuObj.socket.disconnect();
          delete bpuObj.socket;
          bpuObj.socketTimeouts=0;
          bpuObj.socket=null;
          cb_connectBpu('reset socket');
        } else {
          cb_connectBpu(null);
        }
      }
    };
    var fn_clearBpuExp=function(bpuObj, cb_clearBpuExp) {
      if(bpuObj.getStatusResObj.expOverId!==null && bpuObj.getStatusResObj.expOverId!==undefined) {
        if(bpuObj.doc.bpuStatus===app.mainConfig.bpuStatusTypes.finalizingDone) {
          var updateObj={
            exp_serverClearTime:new Date().getTime(),
            exp_status:'servercleared',
          };
          app.db.models.BpuExperiment.findByIdAndUpdate(bpuObj.getStatusResObj.expOverId, updateObj, function(err, savedExpDoc) {
            if(err) {
              app.runData.addExpToBpuErrors.push({time:new Date(), err:bpuObj.doc.name+' fn_clearBpuExp BpuExperiment.findByIdAndUpdate '+err});
              cb_clearBpuExp(bpuObj.doc.name+' fn_clearBpuExp BpuExperiment.findByIdAndUpdate '+err);
            } else {
              cb_clearBpuExp(null);
            }
          });
        } else {
          app.runData.addExpToBpuErrors.push({
            time:new Date(),
            err:bpuObj.doc.name+' fn_clearBpuExp '+'has expOverId:'+bpuObj.getStatusResObj.expOverId+' but status is '+bpuObj.doc.bpuStatus+'!='+app.mainConfig.bpuStatusTypes.finalizingDone
          });
          cb_clearBpuExp(bpuObj.doc.name+' fn_clearBpuExp '+'has expOverId:'+bpuObj.getStatusResObj.expOverId+' but status is '+bpuObj.doc.bpuStatus+'!='+app.mainConfig.bpuStatusTypes.finalizingDone);
        }
      } else {
        cb_clearBpuExp(null);
      }
    };

    //Main Func //Loop through each bpu
    var checkBpu=function(checkBpuCallback) {
      var bpuObj=this;
      //Timeout
      var didCallback=false;
      setTimeout(function() {
        if(!didCallback) {
          didCallback=true;
          bpuObj.socketTimeouts++;
          app.logger.error('timed out '+bpuObj.socketTimeouts);
          app.runData.addExpToBpuErrors.push({time:new Date(), err:bpuObj.doc.name+' fn_connectBpu '+'timed out '+bpuObj.socketTimeouts});
          return checkBpuCallback(null);
        }
      }, 1000);

      bpuObj.checkMsgs=[];
      //Check Socket Connnection
      bpuObj.checkMsgs.push({isErr:false, time:new Date().getTime(), msg:'SocketNull?'+(bpuObj.socket===null)+' timeoutCounter:'+bpuObj.socketTimeouts});
      fn_connectBpu(bpuObj, function(err) {
        if(!didCallback) {
          if(err) {
            didCallback=true;
            bpuObj.socketTimeouts++;
            bpuObj.checkMsgs.push({isErr:true, time:new Date().getTime(), msg:'fn_connectBpu '+err});
            bpuObj.doc.bpuStatus = app.mainConfig.bpuStatusTypes.offline;
            app.runData.addExpToBpuErrors.push({time:new Date(), err:bpuObj.doc.name+' fn_connectBpu '+err});
            return checkBpuCallback(null);

          } else if(!bpuObj.socket.connected) {
            didCallback=true;
            bpuObj.socketTimeouts++;
            bpuObj.doc.bpuStatus = app.mainConfig.bpuStatusTypes.offline;
            bpuObj.checkMsgs.push({isErr:true, time:new Date().getTime(), msg:'!bpuObj.socket.connected'});
            app.runData.addExpToBpuErrors.push({time:new Date(), err:bpuObj.doc.name+' fn_connectBpu '+'!bpuObj.socket.connected'});
            return checkBpuCallback(null);
          } else {

          //Get Status
            bpuObj.socket.emit(app.mainConfig.socketStrs.bpu_getStatus, function(resObj) {
              if(!didCallback) {
                didCallback=true;
                bpuObj.isSocketOkay=true;
                bpuObj.checkMsgs.push({isErr:false, time:new Date().getTime(), msg:'Status='+bpuObj.doc.bpuStatus});

                bpuObj.socketTimeouts=0;
                bpuObj.queueTime=0;

                //Save Res Obj on temp obj
                bpuObj.getStatusResObj=resObj;

                //bpuStatus
                bpuObj.doc.bpuStatus=resObj.bpuStatus;

                //Check for active Exp
                if(resObj.exp!==null && resObj.exp!==undefined) {
                  var expOverIdNull=(bpuObj.getStatusResObj.expOverId!==null && bpuObj.getStatusResObj.expOverId!==undefined);
                  bpuObj.checkMsgs.push({isErr:false, time:new Date().getTime(), msg:'id:'+resObj.exp._id+', Exp=(user:'+resObj.exp.user.name+', timeLeft:'+resObj.expTimeLeft+', expOverIdNull?'+expOverIdNull+')'});
                  bpuObj.doc.liveBpuExperiment.id=resObj.exp._id;
                  bpuObj.doc.liveBpuExperiment.group_experimentType=resObj.exp.group_experimentType;
                  bpuObj.doc.liveBpuExperiment.bc_timeLeft=resObj.expTimeLeft;
                  bpuObj.doc.liveBpuExperiment.username=resObj.exp.user.name;
                  bpuObj.doc.liveBpuExperiment.sessionID=resObj.exp.session.sessionID;

                  //Include current experiment in queue time
                  bpuObj.queueTime=bpuObj.doc.liveBpuExperiment.bc_timeLeft;

                  //Clear set leds function
                  if(app.bpuLedsSetMatch[bpuObj.doc.liveBpuExperiment.sessionID] &&
                      bpuObj.doc.bpuStatus!==app.mainConfig.bpuStatusTypes.running && bpuObj.doc.bpuStatus!==app.mainConfig.bpuStatusTypes.pendingRun) {
                    delete app.bpuLedsSetMatch[bpuObj.doc.liveBpuExperiment.sessionID];
                  }

                //No Active exp
                } else {
                  bpuObj.doc.liveBpuExperiment.id=null;
                  bpuObj.doc.liveBpuExperiment.group_experimentType='text';
                  bpuObj.doc.liveBpuExperiment.bc_timeLeft=0;
                  bpuObj.doc.liveBpuExperiment.sessionID=null;
                  bpuObj.doc.liveBpuExperiment.username=null;
                }

                //Check for exp over
                fn_clearBpuExp(bpuObj, function(err) {
                  if(err) {
                    bpuObj.checkMsgs.push({isErr:true, time:new Date().getTime(), msg:'fn_clearBpuExp '+err});
                  }

                  //Check if scripter needs to run
                  var statMsg=[];
                  statMsg.push({
                    name:'scripterPopulation',
                    age:startDate.getTime()-bpuObj.doc.performanceScores.scripterPopulationDate,
                    msg:'Pop ran '+bpuObj.doc.performanceScores.scripterPopulation+' '
                  });
                  statMsg.push({
                    name:'scripterActivity',
                    age:startDate.getTime()-bpuObj.doc.performanceScores.scripterActivityDate,
                    msg:'Act ran '+bpuObj.doc.performanceScores.scripterActivity+' '
                  });
                  statMsg.push({
                    name:'scripterResponse',
                    age:startDate.getTime()-bpuObj.doc.performanceScores.scripterResponseDate,
                    msg:'Res:'+bpuObj.doc.performanceScores.scripterResponse+' '
                  });
                  statMsg.sort(function(objA, objB) {return objA.age-objB.age;});
                  var cnt=0;
                  statMsg.forEach(function(stat) {
                    bpuObj.checkMsgs.push({isErr:false, time:new Date().getTime()+cnt*100, msg:stat.msg+Math.round(stat.age/1000)+' secs ago'});
                  });


                  var lastSend=startDate.getTime()-bpuObj.doc.performanceScores.bc_lastSendDate;

                  var nextSendMS=app.runParams.ScripterSendInterval-statMsg[statMsg.length-1].age;

                  if(nextSendMS<0 && lastSend>app.runParams.ScripterSendInterval) {

                    if(app.runParams.doSendScripters) {
                      app.db.models.Bpu.submitTextExpWithUser({name:bpuObj.doc.name}, {name:statMsg[statMsg.length-1].name, groups:['scripter']}, function(err, expTag) {
                        if(err) {
                          bpuObj.checkMsgs.push({isErr:true, time:new Date().getTime(), msg:'submitTextExpWithUser err:'+err});
                        }
                        bpuObj.doc.performanceScores.bc_lastSendDate=startDate.getTime();
                        bpuObj.doc.save(function(err, newDoc) {
                          if(err) {
                            bpuObj.checkMsgs.push({isErr:true, time:new Date().getTime(), msg:'save err:'+err});
                          }
                          return checkBpuCallback(null);
                        });
                      });
                    } else {
                      return checkBpuCallback(null);
                    }
                  } else {
                    return checkBpuCallback(null);
                  }
                });
              } else {
                app.runData.addExpToBpuErrors.push({time:new Date(), err:bpuObj.doc.name+' fn_connectBpu '+'getstatus called back but already timed out'});
              } //end of !didCallback
            });//socket get status
          }
        }   //end of !didCallback
      }); //connect bpu
    }; //end of main func

    //Build Parallel
    var runParallelFuncs=[];
    var keys=Object.keys(app.bpuObjects);
    keys.sort(function(objA, objB) {return app.bpuObjects[objA].doc.index-app.bpuObjects[objB].doc.index;});
    keys.forEach(function(key) {
      app.bpuObjects[key].isSocketOkay=false;
      runParallelFuncs.push(checkBpu.bind(app.bpuObjects[key]));
    });
    //Run Parallel
    app.logger.info('runParallel start checkBpus on '+runParallelFuncs.length);
    async.parallel(runParallelFuncs, function(err) {
      //Print Compiled Bpu Info
      var keys=Object.keys(app.bpuObjects);
      keys.sort(function(objA, objB) {return app.bpuObjects[objA].doc.index-app.bpuObjects[objB].doc.index;});
      keys.forEach(function(key) {
        app.logger.info(app.bpuObjects[key].doc.name);
        app.bpuObjects[key].checkMsgs.sort(function(objA, objB) {return objA.time-objB.time;});
        app.bpuObjects[key].checkMsgs.forEach(function(msgObj) {
          if(msgObj.isErr) {
            app.logger.error('\t'+msgObj.msg);
          } else {
            app.logger.info('\t'+msgObj.msg);
          }
        });
      });
      if(err) {
        app.logger.error('runParallel end checkBpus on '+runParallelFuncs.length+' in '+(new Date()-startDate)+' err:'+err+'\n');
      } else {
        app.logger.info('runParallel end checkBpus on '+runParallelFuncs.length+' in '+(new Date()-startDate)+'\n');
      }
      return callback(null);
    });
  };

  //Pulls ListExperiment doc each time
  var checkExpsAndResort=function(callback) {

    //Checks each experiment tag in listExperiment doc
    var ExpRejectMax=10;
    var cnt=0;                              //cnts expTags for cnsole logging
    app.keeperExpDocs=[];                   //BpuExperiments are pulled from db for each expTag, they are kept though the rest of the loop
    app.runData.runningQueueTimesPerBpuName={};     //Experiments are sorted into bpus, running bpu time is need for scoring, not used outside of this function
    //Set Bpus runtime in runningQueueTimesPerBpuName  to zero
    Object.keys(app.bpuObjects).forEach(function(key) {
      var bpuObj=app.bpuObjects[key];
      //Set Queue Time
      if(app.runData.runningQueueTimesPerBpuName[bpuObj.doc.name]===null || app.runData.runningQueueTimesPerBpuName[bpuObj.doc.name]===undefined) {
        if(bpuObj.doc.liveBpuExperiment) {
          app.runData.runningQueueTimesPerBpuName[bpuObj.doc.name]=bpuObj.doc.liveBpuExperiment.bc_timeLeft;
        } else {
          app.runData.runningQueueTimesPerBpuName[bpuObj.doc.name]=0;
        }
      }
    });
    var checkExpAndResort=function(checkExpCallback) {
      cnt++;
      var expTag=this;
      app.logger.trace(cnt+':checkExpAndResort:(sess:'+expTag.session.sessionID+', id:'+expTag.id+'):'+expTag.group_experimentType+':(age:'+(startDate.getTime()-expTag.exp_submissionTime)+')');
      app.logger.trace(cnt+':checkExpAndResort:(user:'+expTag.user.name+', bpu:'+expTag.exp_wantsBpuName+')');
      app.db.models.BpuExperiment.findById(expTag.id, function(err, expDoc) {

        //Failed
        if(err) {
          err=cnt+':checkExpAndResort BpuExperiment.findById error:'+err;
          app.logger.error(err);
          expTag.exp_lastResort.rejectionCounter++;
          expTag.exp_lastResort.rejectionReason=err;
          checkExpCallback(null);

        //Failed
        } else if(expDoc===null || expDoc===undefined) {
          err=cnt+':checkExpAndResort BpuExperiment.findById error:'+'expDoc===null || expDoc===undefined';
          app.logger.error(err);
          expTag.exp_lastResort.rejectionCounter++;
          expTag.exp_lastResort.rejectionReason=err;
          checkExpCallback(null);

        //Canceled
        } else if(expDoc.exp_isCanceled) {
          err=cnt+':checkExpAndResort BpuExperiment.findById error:'+'expDoc.exp_isCanceled';
          app.logger.error(err);
          expTag.exp_lastResort.rejectionCounter=ExpRejectMax;
          expTag.exp_lastResort.rejectionReason=err;
          checkExpCallback(null);

        //Incorrect status, should alreay be out of queue
        } else if(expDoc.exp_status!=='queued' && expDoc.exp_status!=='submited' && expDoc.exp_status!=='created') {
          err=cnt+':checkExpAndResort BpuExperiment.findById error:'+'Incorrect status, should alreay be out of queue';
          app.logger.error(err);
          expTag.exp_lastResort.rejectionCounter=ExpRejectMax;
          expTag.exp_lastResort.rejectionReason=err;
          checkExpCallback(null);

        //Okay -- we have the doc, expTag is removed and the expDoc is used from now on
        } else {
          //add exptag to expDoc
          expDoc.tag=app.newExpTagObj[expDoc._id];
          //Remove expTag from main object
          delete app.newExpTagObj[expDoc._id];

          //reset expDoc last resort
          expDoc.exp_lastResort.canidateBpus=[];
          expDoc.exp_lastResort.bpuName=null;
          expDoc.exp_lastResort.waitTime=0;
          expDoc.exp_resortTime=startDate.getTime();
          //Get Bpus In Groups
          Object.keys(app.bpuObjects).forEach(function(key) {
            var bpuObj=app.bpuObjects[key];
            if(bpuObj.isSocketOkay) {
              //Filter bpus by experiment user groups
              for(var bgnd=0;bgnd<bpuObj.doc.allowedGroups.length;bgnd++) {
                for(var ugnd=0;ugnd<expDoc.user.groups.length;ugnd++) {
                  if(bpuObj.doc.allowedGroups[bgnd]===expDoc.user.groups[ugnd]) {
                    //Score Bpu
                    var scoreObj=bpuObj.doc.scoreBpu(app.runData.runningQueueTimesPerBpuName[bpuObj.doc.name]);
                    scoreObj.bpuName=bpuObj.doc.name;
                    scoreObj.totalWaitTime=app.runData.runningQueueTimesPerBpuName[bpuObj.doc.name];
                    //Check Specific Bpu and add to exps canidate bpus list
                    if(expDoc.exp_wantsBpuName!==null) {
                      if(bpuObj.doc.name===expTag.exp_wantsBpuName) {
                        expDoc.exp_lastResort.canidateBpus.push(scoreObj);
                      }
                    } else {
                      expDoc.exp_lastResort.canidateBpus.push(scoreObj);
                    }
                  }
                }
              }
            }
          });

        //Only one canidated bpu
          if(expDoc.exp_lastResort.canidateBpus.length===1) {
            //choose bpu from score and wait time
            expDoc.exp_lastResort.bpuName=expDoc.exp_lastResort.canidateBpus[0].bpuName;
            expDoc.exp_lastResort.totalWaitTime=expDoc.exp_lastResort.canidateBpus[0].totalWaitTime;
            //Update running bpu queue time
            app.runData.runningQueueTimesPerBpuName[expDoc.exp_lastResort.canidateBpus[0].bpuName]+=expDoc.exp_eventsRunTime;



        //Many Canidates, do secondary check for bpus with similar score and sort by waittime instead

          } else if(expDoc.exp_lastResort.canidateBpus.length>1) {
            //Sort By final Score
            expDoc.exp_lastResort.canidateBpus.sort(function(objA, objB) {return objB.finalScore-objA.finalScore;});
            //choose bpu from score and wait time
            var zeroScore=expDoc.exp_lastResort.canidateBpus[0].finalScore;
            var scoreInt=0.2;
            var sameScoreObjs=expDoc.exp_lastResort.canidateBpus.filter(function(scoreObj) {
              if(scoreObj.finalScore<=zeroScore+scoreInt && scoreObj.finalScore>=zeroScore-scoreInt) return true;
              else return false;
            });
            if(sameScoreObjs.length>0) {
              //Sort similar final scores by wait time.
              sameScoreObjs.sort(function(objA, objB) {return objA.totalWaitTime-objB.totalWaitTime;});
              expDoc.exp_lastResort.bpuName=sameScoreObjs[0].bpuName;
              expDoc.exp_lastResort.totalWaitTime=sameScoreObjs[0].totalWaitTime;

              app.runData.runningQueueTimesPerBpuName[sameScoreObjs[0].bpuName]+=expDoc.exp_eventsRunTime;
            } else {
              //Sort similar final scores by wait time.
              expDoc.exp_lastResort.bpuName=expDoc.exp_lastResort.canidateBpus[0].bpuName;
              expDoc.exp_lastResort.totalWaitTime=expDoc.exp_lastResort.canidateBpus[0].totalWaitTime;

              app.runData.runningQueueTimesPerBpuName[expDoc.exp_lastResort.canidateBpus[0].bpuName]+=expDoc.exp_eventsRunTime;
            }
          }
          if(true) {
            app.logger.trace(cnt+':checkExpAndResort:(sess:'+expTag.session.sessionID+', id:'+expTag.id+'):'+expTag.group_experimentType+':(cans:'+expDoc.exp_lastResort.canidateBpus.length+')');
            expDoc.exp_lastResort.canidateBpus.forEach(function(canBpu) {
              app.logger.trace(canBpu.bpuName+' '+canBpu.finalScore+' '+canBpu.totalWaitTime);
            });
          }
          app.keeperExpDocs.push(expDoc);
          checkExpCallback(null);
        }
      });//end for BpuExperiment.findById
    };


    //Get new Exps from database and build series function array
    app.db.models.ListExperiment.findById(app.listExperimentDoc._id, {newExps:1}, function(err, newListExperimentDoc) {
      if(err) {
        app.logger.error('checkExpsAndResort ListExperiment.findById error:'+err);
        return callback('checkExpsAndResort ListExperiment.findById error:'+err);
      } else if(err) {
        app.logger.error('checkExpsAndResort ListExperiment.findById error:'+'newListExperimentDoc dne');
        return callback('checkExpsAndResort ListExperiment.findById error:'+'newListExperimentDoc dne');
      } else {

        //Create Master expTag obj
        app.newExpTagObj={};
        var bpuScripterTracker={};
        var idSubmissionTimeArray=[];

        //Pull New Experiments from db
        while(newListExperimentDoc.newExps.length>0) {
          var expTag=newListExperimentDoc.newExps.shift();
          if(expTag.user.name==='scripterPopulation' || expTag.user.name==='scripterActivity' || expTag.user.name==='scripterResponse') {
            if(expTag.exp_wantsBpuName!==null && expTag.exp_wantsBpuName!==undefined) {
              if(bpuScripterTracker[expTag.exp_wantsBpuName]===null || bpuScripterTracker[expTag.exp_wantsBpuName]===undefined) {
                bpuScripterTracker[expTag.exp_wantsBpuName]=expTag;
              } else if(bpuScripterTracker[expTag.exp_wantsBpuName].submissionTime<expTag.submissionTime) {
                bpuScripterTracker[expTag.exp_wantsBpuName]=expTag;
              }
            }
          } else {
            app.newExpTagObj[expTag.id]=expTag;
            idSubmissionTimeArray.push({id:expTag.id, subTime:expTag.exp_submissionTime, username:expTag.user.name});
          }
        }
        //Save db doc with removed new experiments
        newListExperimentDoc.save(function(err, saveDoc) {

          //Pull New Experiments from current docuemnt
          while(app.listExperimentDoc.newExps.length>0) {
            var expTag=app.listExperimentDoc.newExps.shift();
            if(expTag.user.name==='scripterPopulation' || expTag.user.name==='scripterActivity' || expTag.user.name==='scripterResponse') {
              if(expTag.exp_lastResort.bpuName!==null && expTag.exp_lastResort.bpuName!==undefined) {
                if(bpuScripterTracker[expTag.exp_wantsBpuName]===null || bpuScripterTracker[expTag.exp_wantsBpuName]===undefined) {
                  bpuScripterTracker[expTag.exp_wantsBpuName]=expTag;
                } else if(bpuScripterTracker[expTag.exp_wantsBpuName].submissionTime<expTag.submissionTime) {
                  bpuScripterTracker[expTag.exp_wantsBpuName]=expTag;
                }
              }
            } else {
              app.newExpTagObj[expTag.id]=expTag;
              idSubmissionTimeArray.push({id:expTag.id, subTime:expTag.exp_submissionTime, username:expTag.user.name});
            }
          }

          //add bpu exps from this doc to expTag Obj
          Object.keys(app.listExperimentDoc._doc).forEach(function(key) {
            if(key[0]!=='_' && (key.search('eug')>-1)) {
              while(app.listExperimentDoc[key].length>0) {
                var expTag=app.listExperimentDoc[key].shift();
                if((expTag.user.name==='scripterPopulation' || expTag.user.name==='scripterActivity' || expTag.user.name==='scripterResponse') &&
                  expTag.exp_lastResort.bpuName!==null && expTag.exp_lastResort.bpuName!==undefined) {
                  if(bpuScripterTracker[expTag.exp_wantsBpuName]===null || bpuScripterTracker[expTag.exp_wantsBpuName]===undefined) {
                    bpuScripterTracker[expTag.exp_wantsBpuName]=expTag;
                  } else if(bpuScripterTracker[expTag.exp_wantsBpuName].submissionTime<expTag.submissionTime) {
                    bpuScripterTracker[expTag.exp_wantsBpuName]=expTag;
                  }
                } else {
                  app.newExpTagObj[expTag.id]=expTag;
                  idSubmissionTimeArray.push({id:expTag.id, subTime:expTag.exp_submissionTime, username:expTag.user.name});
                }
              }
            }
          });
          //check lost list for removal
          for(var ind=0;ind<app.listExperimentDoc._lostList.length;ind++) {
            if((startDate.getTime()-app.listExperimentDoc._lostList[ind].exp_submissionTime)-(1*24*60*60*1000)>0) {
              app.listExperimentDoc._lostList.splice(ind, 1);
              ind--;
            }
          }

          idSubmissionTimeArray.sort(function(objA, objB) {return objA.subTime-objB.subTime;});
          var initialTime=null;
          if(idSubmissionTimeArray.length>0) {
            initialTime=idSubmissionTimeArray[0].subTime;
          }
          //Add Scripters and move to front
          Object.keys(bpuScripterTracker).forEach(function(key) {
            var expTag=bpuScripterTracker[key];
            if(initialTime!==null) {
              expTag.exp_submissionTime=initialTime;
            }
            app.newExpTagObj[expTag.id]=expTag;
            idSubmissionTimeArray.push({id:expTag.id, subTime:expTag.exp_submissionTime, username:expTag.user.name});
          });

          //Build Series
          idSubmissionTimeArray.sort(function(objA, objB) {return objA.subTime-objB.subTime;});
          var runSeriesFuncs=[];
          var Limit=10;
          var limiter=0;
          for(var jnd=0;jnd<idSubmissionTimeArray.length;jnd++) {
            if(limiter<Limit) {
              runSeriesFuncs.push(checkExpAndResort.bind(app.newExpTagObj[idSubmissionTimeArray[jnd].id]));
            } else {
              break;
            }
            limiter++;
          }
          //Run series
          app.logger.info('runSeries start checkExpsAndResort on '+runSeriesFuncs.length);
          async.series(runSeriesFuncs, function(err) {
            app.logger.trace('runSeries end checkExpsAndResort tags:'+Object.keys(app.newExpTagObj).length+', exps:'+app.keeperExpDocs.length);
            if(err) {
              app.logger.error('runSeries end checkExpsAndResort on '+runSeriesFuncs.length+' in '+(new Date()-startDate)+' err:'+err+'\n');
            } else {
              app.logger.info('runSeries end checkExpsAndResort on '+runSeriesFuncs.length+' in '+(new Date()-startDate)+'\n');
            }
            return callback(null);
          });
        });
      }
    });
  };


  var sendExpsToBpus=function(callback) {
    var cnt=0;
    var sendExpToBpu=function(sendExpToBpuCallback) {
      cnt++;
      var exp=this.exp;
      var bpuObj=this.bpuObj;
      app.logger.trace(cnt+':sendExpToBpu '+bpuObj.doc.name+':'+exp.group_experimentType+':'+exp.id+' on Socket?null:'+(bpuObj.socket===null));
      _addExpToBpu(app, exp, bpuObj.doc, bpuObj.socket, function(err, session) {
        if(err) {
          err=cnt+':sendExpsToBpus _addExpToBpu error:'+err;
          app.runData.addExpToBpuErrors.push({time:new Date(), err:err});
          app.logger.error(err);
        } else {
          bpuObj.doc.session.id=session.id;
          bpuObj.doc.session.sessionID=session.sessionID;
          bpuObj.doc.session.socketID=session.socketID;
        }
      });
      sendExpToBpuCallback(null);
    };

    //Find next Experiment per bpu
    app.keeperExpDocs.sort(function(objA, objB) {return objA.exp_submissionTime-objB.exp_submissionTime;});
    var expPerBpu={};
    for(var ind=0;ind<app.keeperExpDocs.length;ind++) {
      if(expPerBpu[app.keeperExpDocs[ind].exp_lastResort.bpuName]===null || expPerBpu[app.keeperExpDocs[ind].exp_lastResort.bpuName]===undefined) {
        var bpuExp=app.keeperExpDocs.splice(ind, 1)[0];
        ind--;
        expPerBpu[bpuExp.exp_lastResort.bpuName]=bpuExp;
        if(Object.keys(expPerBpu).length>=Object.keys(app.bpuObjects).length) break;
      }
    }
    //Build Parallel - Match Available Bpus with Queue Experiments
    var runParallelFuncs=[];
    Object.keys(app.bpuObjects).forEach(function(key) {
      //bpu has exp in queue?
      if(expPerBpu[key]) {
        //can send to bpu
        if(app.bpuObjects[key].doc.bpuStatus===app.mainConfig.bpuStatusTypes.resetingDone) {
          runParallelFuncs.push(sendExpToBpu.bind({bpuObj:app.bpuObjects[key], exp:expPerBpu[key]}));

        //put back in keeper docs to return to queue
        } else {
          app.keeperExpDocs.push(expPerBpu[key]);
        }
      }
    });
    expPerBpu=null;

    //Run Parallel
    app.logger.info('runParallel start sendExpsToBpus on '+runParallelFuncs.length);
    async.parallel(runParallelFuncs, function(err) {
      if(err) {
        app.logger.error('runParallel end sendExpsToBpus on '+runParallelFuncs.length+' in '+(new Date()-startDate)+' err:'+err+'\n');
      } else {
        app.logger.info('runParallel end sendExpsToBpus on '+runParallelFuncs.length+' in '+(new Date()-startDate)+'\n');
      }
      return callback(null);
    });
  };
  var checkUpdateListExperiment=function(callback) {
    //Add left over newExpTags into this listExpDoc
    while(Object.keys(app.newExpTagObj).length>0) {
      var expTag=app.newExpTagObj[Object.keys(app.newExpTagObj)[0]];
      app.listExperimentDoc.newExps.push(expTag);
      delete app.newExpTagObj[Object.keys(app.newExpTagObj)[0]];
    }

    //Add sorted pub docs to this listExpDoc
    while(app.keeperExpDocs.length>0) {
      var expDoc=app.keeperExpDocs.shift();
      var newTag=expDoc.getExperimentTag();
      app.listExperimentDoc[newTag.exp_lastResort.bpuName].push(newTag);
    }
    //Save to database
    app.listExperimentDoc.save(function(err, savedDoc) {
      return callback(null);
    });
  };

  var updateClientSocketConnections=function(callback) {
    var timeNow=new Date().getTime();
    app.logger.debug('updateClientSock:'+app.socketConnections.length);
    if(app.socketConnections.length>0) {
      var bpuDocs=[];
      Object.keys(app.bpuObjects).forEach(function(key) {
        bpuDocs.push(app.bpuObjects[key].doc.toJSON());
      });
      app.socketConnections.forEach(function(socket) {
        if(socket.connected) {
          socket.emit('update', bpuDocs, app.listExperimentDoc.toJSON(), app.runData.runningQueueTimesPerBpuName);
        }

      });
      previousUpdateEmit=timeNow;
    }
    return callback(null);
  };
  //Build Series
  var runSeriesFuncs=[];
  runSeriesFuncs.push(saveMemInfo);
  if(app.runParams.doPrintMemHeader) runSeriesFuncs.push(printMemHeader);
  if(app.runParams.doPrintExpErrors) runSeriesFuncs.push(printExpErrors);
  if(app.runParams.doPrintLiveActivateErrors) runSeriesFuncs.push(printLiveActivateErrors);
  if(app.runParams.doPrintCheckBpusErrors) runSeriesFuncs.push(printCheckBpusErrors);

  runSeriesFuncs.push(getBpus);
  runSeriesFuncs.push(checkBpus);
  runSeriesFuncs.push(checkExpsAndResort);
  runSeriesFuncs.push(sendExpsToBpus);
  runSeriesFuncs.push(checkUpdateListExperiment);
  runSeriesFuncs.push(updateClientSocketConnections);
  //Run Series
  async.series(runSeriesFuncs, function(err) {
    app.runParams.runCounter++;
    if(err) {
      app.logger.error('runSeries end in '+(new Date()-startDate)+' err:'+err);
    } else {
      app.logger.debug('runSeries end in '+(new Date()-startDate));
      setTimeout(function() {loop();}, app.runParams.runLoopInterval);
    }
  });
};


//Init Controller and RUn Loop
init(function(err) {
  if(err) {
    console.log('init err:'+err);
  } else {
    if(app.runParams.runCounter===0) {
      app.runData.firstMemObj=process.memoryUsage();
    }
    loop();
  }
});




var _addExpToBpu=function(app, exp, bpuDoc, bpuSocket, mainCallback) {
  var confirmTimeout=15000;
  var outcome={};
  outcome.sess=null;

  var getSession=function(cb_fn) {

    app.db.models.Session.findById(exp.session.id, function(err, sessDoc) {
      if(err) {
        cb_fn('getSession err:'+err);
      } else if(sessDoc===null) {
        cb_fn('getSession err:'+'sessDoc is null');
      } else {
        outcome.sess=sessDoc;
        cb_fn(null);
      }
    });
  };
  var sendExperimentToBpu=function(cb_fn) {
    var didCallback=false;
    setTimeout(function() {
      if(!didCallback) {
        didCallback=true;
        cb_fn('sendExperimentToBpu timed out');
      }
    }, 1500);
    if(bpuSocket===null || bpuSocket===undefined) {
      if(!didCallback) {
        didCallback=true;
        cb_fn('bpu socket is null');
      }
    } else {
      exp.exp_metaData.magnification=bpuDoc.magnification;
      console.log('events to run', exp.exp_eventsToRun);
      bpuSocket.emit(app.mainConfig.socketStrs.bpu_setExp, exp, confirmTimeout+1000, function(err) {
        if(!didCallback) {
          didCallback=true;
          if(err) {
            cb_fn('sendExperimentToBpu err:'+err);
          } else {
            //Save Exp
            var expUpdateObj={
              liveBpu: {
                id:bpuDoc._id,
                name:bpuDoc.name,
                index:bpuDoc.index,
                socketId:bpuDoc.soc,
              },
              exp_lastResort:exp.exp_lastResort,
              bc_startSendTime:exp.bc_startSendTime,
              bc_isLiveSendingToLab:true,
              exp_status:'addingtobpu',
              exp_metaData:exp.exp_metaData,
            };
            app.db.models.BpuExperiment.findByIdAndUpdate(exp.id, expUpdateObj, {new:true}, function(err, savedExp) {
              if(err) {
                app.logger.error('sendExperimentToBpu BpuExperiment.findByIdAndUpdate err:'+err);
                cb_fn(null);
              } else if(savedExp===null) {
                app.logger.error('sendExperimentToBpu BpuExperiment.findByIdAndUpdate err:'+'savedExp is null');
                cb_fn(null);
              } else {
                expDoc=savedExp;
                var sessUpdateObj={
                  liveBpuExperiment: {
                    id:expDoc.id,
                    tag:expDoc.getExperimentTag(),
                  },
                  bc_startSendTime:expDoc.bc_startSendTime,
                  bc_isLiveSendingToLab:true,
                };
                app.db.models.Session.findByIdAndUpdate(exp.session.id, sessUpdateObj, {new:true}, function(err, sessDoc) {
                  if(err) {
                    app.logger.error('sendExperimentToBpu Session.findByIdAndUpdate err:'+err);
                    cb_fn(null);
                  } else if(expDoc===null) {
                    app.logger.error('sendExperimentToBpu Session.findByIdAndUpdate err:'+'sessDoc is null');
                    cb_fn(null);
                  } else {
                    outcome.sess=sessDoc;
                    cb_fn(null);
                  }
                });
              }
            });
          }
        }
      });
    }//end of socket null check
  };
  var activateLiveUser=function(cb_fn) {

    async.some(app.socketConnections, function(clientSocket,callback) {

      if (clientSocket.connected){
        console.log('Activating live user to: ' + clientSocket.id);
        clientSocket.emit('activateLiveUser', outcome.sess, app.runParams.liveUserConfirmTimeout, function(userActivateResData) {
          if(userActivateResData.err || !userActivateResData.didConfirm) {
            return callback(false)
          } else {
            app.bpuLedsSetMatch[outcome.sess.sessionID]=app.bpuLedsSetFuncs[bpuDoc.name];
            bpuSocket.emit(app.mainConfig.socketStrs.bpu_runExp, function(bpuRunResObj) {
              if(bpuRunResObj.err) {
                app.runData.activateLiveUserErrors.push({time:new Date(), err:'app.mainConfig.socketStrs.bpu_runExp callback err:'+bpuRunResObj.err});
                return callback(false);
              } else {
                clientSocket.emit('sendUserToLiveLab', outcome.sess, function(userSendResObj) {
                  if(userSendResObj.err) {
                    app.runData.activateLiveUserErrors.push({time:new Date(), err:'app.mainConfig.socketStrs.bpu_runExp sendUserToLiveLab callback err:'+userSendResObj.err});
                    return callback(false);
                  } else {
                    console.log('Someone confirmed and user sent to live lab')
                    return callback(true);
                  }
                });
              }
            });
          }
        });
      }
      else{
        return callback(false);
      }

    }, function(someoneConfirmed){

        if (someoneConfirmed===false){
          console.log('********* Nobody Confirmed **********');
          // app.runData.activateLiveUserErrors.push({time:new Date(), err:'activateLiveUser sess:'+outcome.sess.sessionID+
          //   ', user:'+outcome.sess.user.name
          //   });

          var isUserCancel=true;
          bpuSocket.emit(app.mainConfig.socketStrs.bpu_resetBpu, isUserCancel, outcome.sess.sessionID, function(err) {
            app.runData.activateLiveUserErrors.push({time:new Date(), err:'activateLiveUser bpu callback on reset'});
          });
      }
      cb_fn(null);
    });


  };
  var runExpForNonLiveUser=function(cb_fn) {
    bpuSocket.emit(app.mainConfig.socketStrs.bpu_runExp, function(bpuResObj) {
      if(bpuResObj.err) {
      }
    });
    cb_fn(null);
  };

  //Build funcs
  var seriesFuncs=[];
  seriesFuncs.push(getSession);
  seriesFuncs.push(sendExperimentToBpu);
  if(exp.group_experimentType==='live') seriesFuncs.push(activateLiveUser);
  else seriesFuncs.push(runExpForNonLiveUser);

  // Start Series
  async.series(seriesFuncs, function(err) {
    if(err) {
      mainCallback('_addExpToBpu '+err, null);
    } else {
      mainCallback(null, outcome.sess);
    }
  });
};

var _verifyServerSocketConnection=function(serverInfo, callback) {
  var err=null;
  if(typeof serverInfo==='object') {
    if(serverInfo.Identifier && typeof serverInfo.Identifier==='string') {
      if(app.Auth[serverInfo.Identifier] && app.Auth[serverInfo.Identifier].Identifier===serverInfo.Identifier) {
      } else {err='serverInfo Indentifier is incorrect';}
    } else {err='serverInfo Identifier DNE';}
  } else {err='serverInfo is not object';}
  callback(err);
};
