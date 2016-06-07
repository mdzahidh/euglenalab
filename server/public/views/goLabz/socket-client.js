var socketHandle='/goLabz';  //socketHandle for socket connections for the page
var socketStrs={
  
  setConnection:socketHandle+'/#setConnection',         //initializes connection with sever by sending username
  
  updateBpus:socketHandle+'/#updateBpus',            //updates client exps and bpus
 
  submitExperimentRequest:socketHandle+'/#submitExperimentRequest',    //Send join queue object to server, then start join queue sequence if okay
  
  ping:socketHandle+'/#ping',                           //General Purpose
  activateLiveUser:socketHandle+'/#activateLiveUser',                       //Join Queue Sequence
  sendUserToLiveLab:socketHandle+'/#sendUserToLiveLab',       //push live user to lab url
};
var _joinLabConfirmAlertCalled=false;
(function() {
  'use strict';
  //parent app
  app = app || {};
  
  //This Object 
  var me={};
  me.lastPing=new Date();
  me.lastBpuUpdate=null;
  me.mySocket=null;
  me.options=null;
  me.connectionInfo=null;
  //expose with to parent with app 
  app.userSocketClient=me;

  //Set connection called from parent client page
  me.setConnection=function(options, setConnectionCallbackToParent) {
    me.options=options;
    var didCallback=false;
    var resTimeout=setTimeout(function() {
      if(!didCallback) {
        didCallback=true;
        callback('timed out', null);
      }
    }, me.options.timeoutInterval);
    me.mySocket=io.connect();

    //Connection
    //Connection
    //Connection
    me.mySocket.on('connect', function() {
      if(!didCallback) {
        didCallback=true;
        clearTimeout(resTimeout);
        me.connectionInfo=options.connectionInfo;
        me.connectionInfo.socketID=me.mySocket.id;
        me.connectionInfo.socketHandle=socketHandle;
        //Ping
        me.mySocket.on(socketStrs.ping, function(cb_fn) {
          if(cb_fn && typeof cb_fn==='function') cb_fn();
        });
        //Set Connection
        console.log('conn', me.connectionInfo.sessionID); 
        me.mySocket.emit(socketStrs.setConnection, me.connectionInfo, function(err, joinQueueDataObj) {
          if(err) {
            setConnectionCallbackToParent(err, null);
          } else {
            console.log('connd', joinQueueDataObj.session.sessionID);
            setConnectionCallbackToParent(null, joinQueueDataObj);
          }
        });
      }
    });
    me.mySocket.on('reconPing', function(socketCallback) {
      me.mySocket.emit(socketStrs.setConnection, me.connectionInfo);
      if(socketCallback) socketCallback(me.connectionInfo);
    });

    //Activate Live User/Prompt for Join Confirm
    me.mySocket.on(socketStrs.activateLiveUser, function(reqObj, callbackToServer) {
      console.log('activateLiveUser', reqObj.sessionID);
      var resData={didConfirm:false};
      var doSkipConfirmation=false;
      var confirmTimeout=15000;
      if(reqObj.doSkipConfirmation!==null && reqObj.doSkipConfirmation!==undefined) doSkipConfirmation=reqObj.doSkipConfirmation;
      if(reqObj.confirmTimeout!==null && reqObj.confirmTimeout!==undefined) confirmTimeout=reqObj.confirmTimeout;
      if(!doSkipConfirmation) {
        _joinLabConfirmAlert(confirmTimeout, function(err, didConfirm) {
          resData.didConfirm=didConfirm;
          resData.err=err;
          if(callbackToServer) callbackToServer(err, resData);
        });
      } else {
        resData.didConfirm=true;
        if(callbackToServer) callbackToServer(null, resData);
      }
    });
    //Send Live User to lab
    me.mySocket.on(socketStrs.sendUserToLiveLab, function(reqObj, callbackToServer) {
      console.log('sendUserToLiveLab', reqObj.sessionID);
      if(callbackToServer) callbackToServer(null);
      location.href='/golabzjoylab/';
    });
  };

  //Parent Call start Update Bpus
  me.startUpdateBpus=function() {
    //Create Socket call
    me.mySocket.on(socketStrs.updateBpus, function(updateObj) {
      me.lastBpuUpdate=new Date();
      app.mainView.updateFromServer(updateObj);
    });
  };

  //Parent Call to Start Join Queue Sequence
  me.startJoinQueueSequence=function(joinQueueDataArray, isLive, callback) {
    //Fix socket id for each experiment
    joinQueueDataArray.forEach(function(obj) {obj.user.socketID=me.mySocket.id;});
    //Start fucntion below
    _joinQueueSequence(app, me.mySocket, joinQueueDataArray, isLive, callback);
  };
}());

var _joinQueueSequence=function(app, socket, joinQueueData, isLive, mainCallback) {
  var fName='_joinQueueSequence';
  var subName='1. _submitExperimentRequest';
  app.mainView.updateJoinQueueSequence('Submiting Experiment');
  var timeout=5000;
  console.log('_joinQueueSequence', joinQueueData[0].session.sessionID);
  _submitExperimentRequest(socket, joinQueueData, timeout, function(errs) {
    var updateString=joinQueueData.length+' exps submitted.';
    if(errs!==null && errs.length>0) {
      console.log(fName+' end '+subName+' submit err:'+errs.length);
      updateString+=errs.length+' errors.';
      errs.forEach(function(subErr) {
        updateString+=';'+subErr;
      });
    } else {
      updateString+=' No errors';
    }
    app.mainView.userExpInfo.isSubmitting=false;
    if(joinQueueData.length-errs.length>0) {
      if(isLive) {
        updateString+=' Wait for live join.';
        app.mainView.updateJoinQueueSequence(updateString);
      } else {
        updateString+=' Wait for update.';
        app.mainView.updateJoinQueueSequence(updateString);
        mainCallback(null);
      }
    } else {
      updateString+=' None Passed';
      app.mainView.updateJoinQueueSequence(updateString);
      mainCallback(null);
    }
  });
};
//Submit exp req to queue
var _submitExperimentRequest=function(socket, joinQueueData, timeout, callback) {
  var fName='_submitExperimentRequest';
  var didCallback=false;
  var resTimeout=setTimeout(function() {
    if(!didCallback) {
      didCallback=true;
      callback('timed out in '+timeout, null);
    }
  }, timeout);
  socket.emit(socketStrs.submitExperimentRequest, joinQueueData, function(err, joinQueueResData) { 
    if(!didCallback) {
      clearTimeout(resTimeout);
      didCallback=true;
      callback(err, joinQueueResData);
    }
  });
};
//Pop up and time out
var _joinLabConfirmAlert=function(confirmTimeout, callback) {
  if(_joinLabConfirmAlertCalled) {
    callback('join lab confirm aleart already called', false);
  } else {
    _joinLabConfirmAlertCalled=true;
    var didCallback=false;
    var resTimeout=setTimeout(function() {
      if(!didCallback) {
        didCallback=true;
        _joinLabConfirmAlertCalled=false;
        callback('timed out', null);
      }
    }, confirmTimeout);
    //Alert 
    var confirmTime=Math.round(confirmTimeout/1000);
    if(confirm('Go To Lab.' +new Date()+'\n'+confirmTime+' seconds to confirm.')===true) {
      if(!didCallback) {
        didCallback=true;
        _joinLabConfirmAlertCalled=false;
        callback(null, true);
      }
    } else {
      if(!didCallback) {
        didCallback=true;
        _joinLabConfirmAlertCalled=false;
        callback(null, false);
      }
    }
  }
};


