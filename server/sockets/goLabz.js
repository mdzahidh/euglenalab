'use strict';
var async=require('async');
var handle='/goLabz';
var LOGGER_LEVELS=['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'];
var me={
  name:'goLabz.js',
  logger:null,
  loggerLevel:LOGGER_LEVELS[4],
};
var _app=null;

var _lastClientUpdateObj=null;
exports.setLastClientUpdateObj=function(clientUpdateObj) {
  _lastClientUpdateObj=clientUpdateObj;
};
//Setup
exports.setup=function(app, socket) {
  _app=app;
  //Logger
  me.logger=app.log4js.getLogger(me.name); 
  me.logger.setLevel(me.loggerLevel);
  me.logger.info('init setup '+handle);
  
  //setConnection
  //setConnection
  //setConnection
  socket.on(handle+'/#setConnection', function(sessionInfo, socketCallback) {
    var fName='/#setConnection '+sessionInfo.username+', '+socket.id;
    console.log(handle+'/#setConnection', sessionInfo.sessionID);
    me.logger.info(fName);
    var outcome={};
   
    //Check bpus for user experiments  
    outcome.bpusWithExpBySessionID={}; 
    var checkBpus=function(callback) {
      app.bpusConnected.forEach(function(bpuObj) {
        if(bpuObj.bpuDoc.socket_getStatusResObj.exp!==null && bpuObj.bpuDoc.socket_getStatusResObj.exp!==undefined) {
          outcome.bpusWithExpBySessionID[bpuObj.bpuDoc.socket_getStatusResObj.exp.sessionID]=bpuObj;
        }
      });
      callback(null);
    };
    
    outcome.sess=null; 
    var updateSession=function(callback) {
      var updateObj={
        lastUpdateTime:new Date().getTime(),
        socketID:sessionInfo.socketID,
        socketHandle:sessionInfo.socketHandle,
        user:{
          id:sessionInfo.userID,
          name:sessionInfo.username,
        },
        //Set Outside of Obj Definition
        //liveBpuExperiment:{id:null, tag:null},
        //textBpuExperiments:[],
        //liveBpu:{id:null, index:-1, socketId:null, socket_getStatusResObj:{}}
      };
      if(outcome.bpusWithExpBySessionID[sessionInfo.sessionID]!==null && outcome.bpusWithExpBySessionID[sessionInfo.sessionID]!==undefined) {
        updateObj.liveBpuExperiment={};
        updateObj.liveBpuExperiment.id=null;
        updateObj.liveBpuExperiment.tag=null;
        updateObj.textBpuExperiments=[];
        updateObj.liveBpu={};
        updateObj.liveBpu.id=null;
        updateObj.liveBpu.index=null;
        updateObj.liveBpu.socketId=null;
        updateObj.liveBpu.socket_getStatusResObj={};
      } else {
        //No exps in bpu then reset
        updateObj.liveBpuExperiment={};
        updateObj.liveBpuExperiment.id=null;
        updateObj.liveBpuExperiment.tag=null;
        updateObj.textBpuExperiments=[];
        updateObj.liveBpu={};
        updateObj.liveBpu.id=null;
        updateObj.liveBpu.index=null;
        updateObj.liveBpu.socketId=null;
        updateObj.liveBpu.socket_getStatusResObj={};
      }
      app.db.models.Session.findOneAndUpdate({sessionID:sessionInfo.sessionID}, updateObj, {new:true}, function(err, newSessDoc) {
        if(err) {
          callback('updateSession find err:'+err);
        } else if(newSessDoc===null || newSessDoc===undefined) {
          callback('updateSession newSessDoc DNE in db');
        } else {
          outcome.sess=newSessDoc;
          callback(null);
        }
      });
    };
    outcome.user=null; 
    var updateUser=function(callback) {
      var updateObj={
        sessionID:outcome.sess.sessionID,
        socketID:outcome.sess.socketID,
        socketHandle:outcome.sess.socketHandle,
        liveBpuExperiment:{
          id:outcome.sess.liveBpuExperiment.id,
          tag:outcome.sess.liveBpuExperiment.tag
        },
        liveBpu: {
          id:outcome.sess.liveBpu.id,
          index:outcome.sess.liveBpu.index,
          socketId:outcome.sess.liveBpu.socketId,
          socket_getStatusResObj:outcome.sess.liveBpu.socket_getStatusResObj,
        },
      };
      app.db.models.User.findByIdAndUpdate(outcome.sess.user.id, updateObj, {new:true}, function(err, newUserDoc) {
        if(err) {
          callback('updateUser find err:'+err);
        } else if(newUserDoc===null || newUserDoc===undefined) {
          callback('updateUser DNE in db');
        } else {
          outcome.user=newUserDoc;
          callback(null);
        }
      });
    };

    var updateSocket=function(callback) {
    //Fix Session Info on socket?
      socket.sessionInfo=outcome.sess.toJSON();
      callback(null);
    };
    var getJoinQueueObject=function(callback) {
      //Callback to client with join queue Object
      outcome.joinQueueObj=app.db.models.BpuExperiment.getDataObjToJoinQueue();
      outcome.joinQueueObj.user.id=outcome.user._id;
      outcome.joinQueueObj.user.username=outcome.user.username;
      outcome.joinQueueObj.session.id=outcome.sess._id;
      outcome.joinQueueObj.session.sessionID=outcome.sess.sessionID;
      outcome.joinQueueObj.session.socketID=outcome.sess.socketID;
      outcome.joinQueueObj.session.socketHandle=outcome.sess.socketHandle;
      callback(null);
    };

    //Build Sequence
    var funcs=[];
    funcs.push(checkBpus);
    funcs.push(updateSession);
    funcs.push(updateUser);
    funcs.push(updateSocket);
    funcs.push(getJoinQueueObject);
    async.series(funcs, function(err) {
      if(err) {
        if(socketCallback) socketCallback(err, outcome.joinQueueObj);
      } else {
        if(socketCallback) socketCallback(null, outcome.joinQueueObj);
      }
    });
  });

  //submitExperimentRequest
  //submitExperimentRequest
  //submitExperimentRequest
  socket.on(handle+'/#submitExperimentRequest', function(joinQueueDataArray, socketCallback) {
    var fName='/#submitExperimentRequest';
    var resStr=handle+'/#submitExperimentRequest'+'Res';
    console.log(handle+'/#submitExperimentRequest', joinQueueDataArray[0].session.sessionID);
    if(joinQueueDataArray.length===0) {
      if(socketCallback) socketCallback(['joinQueueDataArray is empty'], null);
    } else { 
      var seriesCnt=0;
      var outcome={
        user:null,
        expSubmits:{},
      };
      var getUser=function(callback) {
        var subName='getUser';
        me.logger.debug(fName+' '+subName+' start');
        app.db.models.User.findById(joinQueueDataArray[0].user.id, {}, function(err, user) {
          if(err) {
            callback(subName+' '+err);
          } else if(user===null || user===undefined) {
            callback(subName+' '+'user dne');
          } else {
            outcome.user=user;
            callback(null);
          }
        });
      };
      var submitExperiments=function(callback) {
        var subName='submitExperiments';
        me.logger.debug(seriesCnt+'. '+fName+' '+subName+' start with '+joinQueueDataArray.length+' experiments');
        //Make Experiment Request 
        var commonUserInfo={
          //Default
          submitDate:new Date(),
          submitPath:me.name,
          userID:outcome.user._id,
          username:outcome.username,
          sessionID:joinQueueDataArray[0].session.sessionID,
          socketHandle:joinQueueDataArray[0].session.socketHandle,
          userGroups:outcome.user.groups,
        };
        //Build submit series funcs
        var submitFuncs=[];
        joinQueueDataArray.forEach(function(data) {
          //User info
          data.user.groups=outcome.user.groups;
          submitFuncs.push(_submitExperiment.bind({joinQueueData:data, commonUserInfo:commonUserInfo, outcome:outcome.expSubmits}));
        });
        //Run Submit
        async.parallel(submitFuncs, function(err) {
          if(err) {
            return callback(fName+' '+subName+' end '+err);
          } else {
            return callback(null);
          }
        });
      };
      //Build Sequence
      var funcs=[];
      funcs.push(getUser);
      funcs.push(submitExperiments);
      me.logger.info(fName+' start');
      async.series(funcs, function(err) {
        me.logger.info(fName+' end');
        if(err) {
          me.logger.error(fName+' '+err);
          if(socketCallback) socketCallback([err], outcome);
        } else {
          var errs=[];
          //Check for submit errors
          Object.keys(outcome.expSubmits).forEach(function(key) {
            if(outcome.expSubmits[key]!=='okay') {
              errs.push(outcome.expSubmits[key]);
            } 
          });
          me.logger.info(fName+' '+'okay');
          if(socketCallback) socketCallback(errs);
        }
      });
    }
  });
};

var _submitExperiment=function(callback) { //Async Function
  var joinQueueData=this.joinQueueData;
  var commonUserInfo=this.commonUserInfo;
  var outcome=this.outcome;
  //Make Experiment Request 
  var tempMeta=null; 
  var group_experimentType=null;
  var exp_eventsToRun=null;
  var exp_wantsBpuName=null;
  var exp_metaData=commonUserInfo;
  var exp_liveSocketHandle=null;
  //Check Specific Bpu
  if(isValidBpuName(joinQueueData.exp_wantsBpuName, _app.bpusConnected)) {
    exp_wantsBpuName=joinQueueData.exp_wantsBpuName;
  }
  //Check Live
  if(joinQueueData.group_experimentType==='live') {
    group_experimentType='live';
    exp_eventsToRun=[
      {time:0},
      {time:_app.mainConfig.liveUserLabTime}
    ];
    //check for socket handle for live experiments
    if(commonUserInfo.socketHandle) {
      exp_liveSocketHandle=commonUserInfo.socketHandle;
    } else {
      exp_liveSocketHandle=handle;
    } 
  } else {
    group_experimentType='text';
    exp_eventsToRun=joinQueueData.exp_eventsToRun;
  }
  //Add Submit Meta Data
  tempMeta={};
  if(joinQueueData.exp_metaData) {
    Object.keys(joinQueueData.exp_metaData).forEach(function(key) {
      tempMeta[key]=joinQueueData.exp_metaData[key];
    });
  }
  //Over write user meta data with commonUserInfo 
  Object.keys(commonUserInfo).forEach(function(key) {
    tempMeta[key]=commonUserInfo[key];
  });

  //Final Check, create exp doc and add exp tag to list
  if(exp_eventsToRun!==null || exp_eventsToRun!==undefined || exp_eventsToRun.length<2) {
    //Compile Meta, over write default with previously stringified client side meta data
    Object.keys(tempMeta).forEach(function(key) { 
      exp_metaData[key]=tempMeta[key];
    });
   
    //Create Exp 
    var newExp=_app.db.models.BpuExperiment();
    
    newExp.user.id=joinQueueData.user.id;
    newExp.user.name=joinQueueData.user.username;
    newExp.user.sessionID=joinQueueData.user.sessionID;
    newExp.user.socketID=joinQueueData.user.socketID;
    newExp.user.groups=joinQueueData.user.groups;
    newExp.exp_liveSocketHandle=exp_liveSocketHandle;
    newExp.group_experimentType=group_experimentType;
    newExp.exp_eventsToRun=exp_eventsToRun;
    newExp.exp_metaData=exp_metaData;
    newExp.exp_wantsBpuName=exp_wantsBpuName;
    newExp.sessionID=joinQueueData.session.sessionID;
    
    console.log('newExp._id', newExp._id); 
    console.log('newExp.sessionID', newExp.sessionID); 
    newExp.exp_submissionTime=new Date();
    //Save Exp and add to list
    newExp.save(function(err, savedExp) {
      if(err) {
          outcome[newExp._id]='addNewExpToList save failed for '+err;
          callback('addNewExpToList save failed for '+err);
      } else if(savedExp===null || savedExp===undefined) {
          outcome[newExp._id]='addNewExpToList save failed for '+'saved exp is dne';
          callback('addNewExpToList save failed for '+'saved exp is dne');
      } else {
        _app.db.models.ListExperiment.addNewExpToList(savedExp, function(err) {
          if(err) {
            outcome[newExp._id]=handle+' addNewExpToList '+'submit err:'+err;
            newExp.exp_statusMessage.push(handle+' '+'submit err:'+err);
            newExp.exp_status='failed';
            newExp.save();
            callback('addNewExpToList '+err);
          } else {
            outcome[newExp._id]='okay';
            newExp.exp_status='submited';
            newExp.save();
            callback(null);
          }
        });
      }
    });
  } else {
    outcome[commonUserInfo.user.id]='need eventsToRun with at least two events';
    callback('need eventsToRun with at least two events');
  } 
};
//submitExperimentRequest functions
var isValidBpuName=function(bpuName, appBpusConnected) {
  var retBool=false;
  if(typeof bpuName==='string' && bpuName.length>=4) {
    var first3=bpuName.substr(0, 3);
    var eugNumber=bpuName.substr(3, bpuName.length-3);
    if(!isNaN(Number(eugNumber))) {
      if(appBpusConnected!==null && appBpusConnected!==undefined && typeof appBpusConnected.some==='function') {
        if(appBpusConnected.some(function(bpuObj) {return bpuName===bpuObj.bpuDoc.name;})) {
          retBool=true;
        }
      }
    }
  }
  return retBool;
};
