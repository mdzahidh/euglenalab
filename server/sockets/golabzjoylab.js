'use strict';
var async=require('async');
var handle='/golabzjoylab';
var LOGGER_LEVELS=['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'];
var me={
  name:'golabzjoylab.js',
  logger:null,
  loggerLevel:LOGGER_LEVELS[0],
};
var _app=null;

//Setup
exports.setup=function(app, userSocket, bpuSocketStrings, userSocketStrings) {
  _app=app;
  //Logger
  me.logger=app.log4js.getLogger(me.name); 
  me.logger.setLevel(me.loggerLevel);
  me.logger.info('init setup '+handle);
  
  //setConnection
  //setConnection
  //setConnection
  userSocket.on(handle+userSocketStrings.user_setConnection, function(connectionInfo, setConnectionCallback) {
    var fName=handle+userSocketStrings.user_setConnection+' '+connectionInfo.username+', '+userSocket.id;
    me.logger.info(fName);
    app.db.models.Session.findOne({sessionID:connectionInfo.sessionID}, function(err, sessDoc) {
      if(err) {
        setConnectionCallback('Session find err:'+err);
      } else if(sessDoc===null || sessDoc===undefined) {
        setConnectionCallback('Session DNE in db');
      } else {
        sessDoc.socketID=connectionInfo.socketID;
        sessDoc.socketHandle=connectionInfo.socketHandle;
        sessDoc.user.id=connectionInfo.userID;
        sessDoc.user.name=connectionInfo.username;
        sessDoc.lastUpdateTime=new Date().getTime();
        sessDoc.save(function(err, saveDoc) {
          if(err===null && saveDoc!==null && saveDoc!==undefined) userSocket.sessionInfo=saveDoc.toJSON();
          //Get BpuExp
          app.db.models.BpuExperiment.findById(userSocket.sessionInfo.liveBpuExperiment.id, function(err, expDoc) {
            var userBpuObj=null; 
            if(err) {
              setConnectionCallback('BpuExperiment.findById err:'+err);
            } else if(expDoc===null) {
              setConnectionCallback('BpuExperiment.findById DNE in db');
            } else {            
              //Find Bpu Socket
              for(var ind=0;ind<app.bpusConnected.length;ind++) {
                var bpuObj=app.bpusConnected[ind];
                if(bpuObj.bpuDoc!==null  && bpuObj.bpuDoc!==undefined && userSocket.sessionInfo!==null && userSocket.sessionInfo!==undefined) {
                  if(bpuObj.bpuDoc.name===expDoc.exp_lastResort.bpuName) {
                    console.log(bpuObj.bpuDoc.name, expDoc.exp_lastResort.bpuName, bpuObj.bpuDoc.socket_getStatusResObj);
                    userBpuObj=bpuObj;
                    break;
                  }
                } 
              }
              if(userBpuObj!==null) { 
                if(userBpuObj.bpuDoc!==null) { 
                  if(userBpuObj.socket!==null) { 
                      //Callback to client with join queue Object
                      var setLedsData=app.db.models.BpuExperiment.getDataObjToSetLeds();
                      setLedsData.metaData.userID=expDoc.user.id;
                      setLedsData.metaData.expID=expDoc._id+'';
                      setLedsData.metaData.bpuID=userBpuObj.bpuDoc._id;
                      //ledsSet
                      //ledsSet
                      //ledsSet
                      var setLedsFunc=function(setLedsData, socketCallback) {
                        userBpuObj.socket.emit(bpuSocketStrings.bpu_runExpLedsSet, setLedsData, function(bpuSocketErr, bpuSocketResData) {
                        });
                        if(socketCallback) socketCallback(null, {test:'test'});
                      };
                      userSocket.removeListener(handle+userSocketStrings.user_ledsSet, setLedsFunc);
                      userSocket.on(handle+userSocketStrings.user_ledsSet, setLedsFunc);
                      if(setConnectionCallback) setConnectionCallback(null, {setLedsObj:setLedsData});
                  } else {
                    me.logger.error(fName+' userBpuObj.socket!==null');
                    if(setConnectionCallback) setConnectionCallback('no bpu socket available', null);
                  }
                } else {
                  me.logger.error(fName+' userBpuObj.bpuDoc!==null');
                  if(setConnectionCallback) setConnectionCallback('no bpu doc available', null);
                }
              } else {
                me.logger.error(fName+' userBpuObj!==null');
                if(setConnectionCallback) setConnectionCallback('no bpu obj available', null);
              }
            }
          });
        });
      }
    });
  });
};

