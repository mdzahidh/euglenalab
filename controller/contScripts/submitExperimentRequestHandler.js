var async=require('async');
exports=module.exports=function(app, socketServerInfo, joinQueueDataArray, callbackToClient) {
  var outcome={};
  outcome.session=null;

  var _findSubmitSession=function(callbackToMainFunction) {
    var sessionID=null;
    var userName = null;
    var groups = null;

    if(socketServerInfo.arePassKeysOpen) {
      if(joinQueueDataArray.length>0 && joinQueueDataArray[0].session && joinQueueDataArray[0].session.sessionID!==null) {
        sessionID=joinQueueDataArray[0].session.sessionID;
        var firstItem = joinQueueDataArray[0];
        if ( (firstItem.user !==null) && (firstItem.user.name !== null ) ) {
          if ( firstItem.user.groups !== null ) {
            userName = firstItem.user.name;
            groups = firstItem.user.groups;
          }
          else{
            return callbackToMainFunction('No group');
          }
        }
        else{
          return callbackToMainFunction('No user');
        }
      }
    } else {
      sessionID=socketServerInfo.PassKeys[0];
    }


    app.db.models.Session.findOne({sessionID:sessionID}, {}, function(err, session) {
      if(err) {
        callbackToMainFunction('_findSubmitSession '+err);
      } else if(session===null || session===undefined) {

        session=app.db.models.Session();
        session.sessionID = sessionID;

        session.user.name= userName;
        session.user.groups= groups;

        session.save(function(err, savedDoc) {
          if(err) {
            callbackToMainFunction('_findSubmitSession save '+err);
          } else {
            outcome.session=savedDoc;
            callbackToMainFunction(null);
          }
        });
      } else {
        outcome.session=session;
        callbackToMainFunction(null);
      }
    });
  };

  outcome.validationObjs=[];
  outcome.validationPassedCnt=0;
  var _parseJoinQueueDataArray=function(callbackToMainFunction) {
    var parseJoinQueueData=function(cb_parseJoinQueueData) {
      var joinQueueData=this.joinQueueData;
      var newBpuExp=app.db.models.BpuExperiment();

      var validationObj={};
      validationObj.errs=[];
      //Check Server Info
      if(!socketServerInfo.arePassKeysOpen) {
        var foundPassKey=false;
        for(var ind=0;ind<socketServerInfo.PassKeys.length;ind++) {
          if(socketServerInfo.PassKeys[ind]===outcome.session.sessionID) {
            foundPassKey=true;
            break;
          }
        }
        if(!foundPassKey) {
          validationObj.errs.push('arePassKeysOpen:false and passkey not found');
        }
      }

      //User
      if(outcome.session.user) {
        if(typeof outcome.session.user.id==='string') {
          newBpuExp.user.id=new app.runParams.mongooseObjID(outcome.session.user.id);
        } else {
          newBpuExp.user.id=outcome.session.user.id;
        }
        newBpuExp.user.name=outcome.session.user.name;
        if(outcome.session.user.groups) newBpuExp.user.groups=outcome.session.user.groups;
        else validationObj.errs.push('no user groups');
      } else {
        validationObj.errs.push('no user');
      }
      //Session
      if(outcome.session) {

        if(outcome.session.id) {
          if(typeof outcome.session.id==='string') {
            newBpuExp.session.id=new app.runParams.mongooseObjID(outcome.session.id);
          } else {
            newBpuExp.session.id=outcome.session.id;
          }
        }
        else validationObj.errs.push('no session id');
        if(outcome.session.sessionID) newBpuExp.session.sessionID=outcome.session.sessionID;
        else validationObj.errs.push('no session sessionID');
        newBpuExp.session.socketID=outcome.session.socketID;
        newBpuExp.session.socketHandle=outcome.session.socketHandle;

      } else {
        validationObj.errs.push('no session');
      }
      //Other
      if(joinQueueData.group_experimentType) newBpuExp.group_experimentType=joinQueueData.group_experimentType;
      else validationObj.errs.push('no group_experimentType');
      newBpuExp.exp_wantsBpuName=joinQueueData.exp_wantsBpuName;

      newBpuExp.exp_metaData=joinQueueData.exp_metaData;

      newBpuExp.bc_serverInfo=socketServerInfo;

      //Many Check on events to run
      if(joinQueueData.exp_eventsToRun) {
        if(joinQueueData.exp_eventsToRun.forEach) {
            newBpuExp.exp_eventsToRun=joinQueueData.exp_eventsToRun;
        } else {
          validationObj.errs.push('exp_eventsToRun is not array');
        }
      } else {
        validationObj.errs.push('no exp_eventsToRun');
      }

      //Validate New Experiment and finalize and save
      validationObj.expInfo=app.db.models.BpuExperiment.validate(newBpuExp);

      validationObj._id=newBpuExp._id;
      validationObj.group_experimentType=newBpuExp.group_experimentType;
      validationObj.exp_wantsBpuName=newBpuExp.exp_wantsBpuName;
      validationObj.exp_metaData=newBpuExp.exp_metaData;

      validationObj.wasSaved=false;
      validationObj.saveErr=null;

      validationObj.wasTagged=false;
      validationObj.tagErr=null;
      if(validationObj.expInfo.isValid && validationObj.errs.length===0) {

        newBpuExp.exp_eventsToRun=joinQueueData.exp_eventsToRun;
        newBpuExp.exp_eventsRunTime=joinQueueData.exp_eventsRunTime;
        newBpuExp.tag=newBpuExp.getExperimentTag();
        newBpuExp.exp_submissionTime=new Date().getTime();
        newBpuExp.save(function(err, savedExp) {
          if(err) {
            validationObj.saveErr='could not save new exp err:'+err;
            outcome.validationObjs.push(validationObj);
            cb_parseJoinQueueData(null);
          } else {
            validationObj.wasSaved=true;
            app.db.models.ListExperiment.addNewExpTagToList(savedExp.tag, function(err) {

              if(err) {
                validationObj.tagErr='could not save new exp tag err:'+err;
                outcome.validationObjs.push(validationObj);
                cb_parseJoinQueueData(null);
              } else {
                validationObj.wasTagged=true;
                outcome.validationPassedCnt++;
                outcome.validationObjs.push(validationObj);
                cb_parseJoinQueueData(null);
              }
            });
          }
        });
      } else {
        outcome.validationObjs.push(validationObj);
        cb_parseJoinQueueData(null);
      }
    };
    //Build Series
    var parallelFuncs=[];
    joinQueueDataArray.forEach(function(joinQueueData) {
      parallelFuncs.push(parseJoinQueueData.bind({joinQueueData:joinQueueData}));
    });
    //Run Series
    async.parallel(parallelFuncs, function(err) {
      if(err) {
        callbackToMainFunction('parallel end err:'+err);
      } else {
        callbackToMainFunction(null);
      }
    });
  };

  //Build Series
  var seriesFuncs=[];
  seriesFuncs.push(_findSubmitSession);
  seriesFuncs.push(_parseJoinQueueDataArray);
  //Run Series
  async.series(seriesFuncs, function(err) {
    if(err) {
      callbackToClient('bc series end '+err, outcome.validationObjs);
    } else {
      if(outcome.validationObjs.length===0) {
        callbackToClient('no validation objects', outcome.validationObjs);
      } else if(outcome.validationPassedCnt===0) {
        callbackToClient('no validation objects passed', outcome.validationObjs);
      } else {
        callbackToClient(null, outcome.validationObjs);
      }
    }
  });
};


