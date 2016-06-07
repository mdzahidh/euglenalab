var _Handle='/basicuserlivelab';  //socketHandle for socket connections for the page
var socketStrs={
  setConnection:'/#setConnection',         
  updateBpus:'/#updateBpus',            
  ledsSet:'/#ledsSet',            
  kickFromLab:'/#kickFromLab',                           
};
(function() {
  'use strict';
  //parent app
  app = app || {};
  
  //This Object 
  var me={};
  me.sessionInfo=null;
  me.isInitialized=null;
  me.ledsSetEventCounter=0;
  //expose with to parent with app 
  app.userSocketClient=me;

  //Set connection called from parent client page
  me.setConnection=function(setConnectionCallbackToParent) {
    var didCallback=false;
    setTimeout(function() {
      if(!didCallback) {
        didCallback=true;
        setConnectionCallbackToParent('timed out', null);
      }
    }, 10000);
    
    //Primary Connection
    //Primary Connection
    //Primary Connection
    var bpuAddr=app.mainView.bpu.get('localAddr');
    var addr='http://'+bpuAddr.ip+':'+bpuAddr.serverPort;
    //Primary Connection
    //Primary Connection
    //Primary Connection
    var socket=io.connect();
    //Wait for Set Connection
    socket.on(socketStrs.setConnection, function(serverCallback) {
      if(!didCallback) {
        didCallback=true;
        app.mainView.session.attributes.socketID=socket.id;
        app.mainView.session.attributes.socketHandle=_Handle;
        serverCallback(app.mainView.session);
        console.log(app.mainView.session);
        console.log('sessionID', app.mainView.session.get('sessionID'));
        setConnectionCallbackToParent(null);
      }
    });
    socket.on(socketStrs.kickFromLab, function(cb_fn) {
      app.mainView.kickUser(null, 'socket kick');
    });
    socket.on('connect', function() {}); 
    //Update Info
    socket.on('/#update', function(updateObj) {
      var clientUpdateObj={};
      
      //Queue info for UI update
      clientUpdateObj.queueExps=[];
      clientUpdateObj.liveQueueExp=null;
      clientUpdateObj.textTotalRunTime=0;
      clientUpdateObj.textTotalExps=0;

      //Bpu Info for UI update
      clientUpdateObj.bpuLiveExp=null;
      clientUpdateObj.bpuLiveFinishTime=0;
      clientUpdateObj.bpuTextTotalRunTime=0;
      clientUpdateObj.bpuTextTotalExps=0;
      
      
      //Go through active bpu exps 
      updateObj.bpuExps.forEach(function(bpuExp) {
        if(bpuExp.liveBpuExperiment.group_experimentType==='live') {
          clientUpdateObj.bpuLiveExp=bpuExp;
          clientUpdateObj.bpuLiveFinishTime=bpuExp.liveBpuExperiment.bc_timeLeft;
        } else {
          clientUpdateObj.bpuTextTotalRunTime+=bpuExp.liveBpuExperiment.bc_timeLeft;
          clientUpdateObj.bpuTextTotalExps++;
        }
      });
    
      //console.log(clientUpdateObj.bpuLiveExp, me.ledsSetEventCounter); 
      if(clientUpdateObj.bpuLiveExp===null) {
        app.mainView.kickUser(null, 'update');
      } else {
        app.mainView.setTimeLeftInLabLabel(clientUpdateObj.bpuLiveFinishTime, 0, true);
      }
      //Go through queue bpu exps 
      updateObj.queueExpTags.forEach(function(expTag) {
        if(expTag.session.sessionID!==null && expTag.session.sessionID!==undefined) {
          if(expTag.group_experimentType==='live') {
            clientUpdateObj.liveQueueExp=expTag;
          } else {
            clientUpdateObj.textTotalRunTime+=expTag.exp_eventsRunTime+expTag.exp_lastResort.totalWaitTime;
            clientUpdateObj.textTotalExps++;
          }
        }
      });
    });
    me.ledsSet=function(ledsSetObj) {
      me.ledsSetEventCounter++;
      ledsSetObj.sessionID=app.mainView.session.get('sessionID');
      ledsSetObj.sentTime=new Date().getTime();
      socket.emit(socketStrs.ledsSet, ledsSetObj);
    };
  };
}());
