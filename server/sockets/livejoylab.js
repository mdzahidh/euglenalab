'use strict';
var async=require('async');
var handle='/livejoylab';
var LOGGER_LEVELS=['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'];
var me={
  name:'livejoylab.js',
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
  userSocket.on(handle+userSocketStrings.user_setConnection, function(sessionInfo, socketCallback) {
    var fName=handle+userSocketStrings.user_setConnection+' '+sessionInfo.username+', '+userSocket.id;
    me.logger.info(fName);
    var userBpuObj=null;
    for(var ind=0;ind<app.bpusConnected.length;ind++) {
      if(''+app.bpusConnected[ind].bpuDoc._id===''+sessionInfo.bpuID) {
        userBpuObj=app.bpusConnected[ind];
        break;
      }
    }
    if(userBpuObj!==null) { 
      if(userBpuObj.bpuDoc!==null) { 
        if(userBpuObj.socket!==null) { 
            //Callback to client with join queue Object
            var setLedsData=app.db.models.BpuExperiment.getDataObjToSetLeds();
            setLedsData.metaData.username=sessionInfo.username;
            setLedsData.metaData.expID=sessionInfo.liveBpuExperimentID;
            setLedsData.metaData.bpuID=sessionInfo.bpuID;
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
            if(socketCallback) socketCallback(null, {setLedsObj:setLedsData});
        } else {
          me.logger.error(fName+' userBpuObj.socket!==null');
          if(socketCallback) socketCallback('no bpu socket available', null);
        }
      } else {
        me.logger.error(fName+' userBpuObj.bpuDoc!==null');
        if(socketCallback) socketCallback('no bpu doc available', null);
      }
    } else {
      me.logger.error(fName+' userBpuObj!==null');
      if(socketCallback) socketCallback('no bpu obj available', null);
    }
  });
};

