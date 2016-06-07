var socketHandle='/livejoylab';  //socketHandle for socket connections for the page
var socketStrs={
  
  setConnection:socketHandle+'/#setConnection',         //initializes connection with sever by sending username
  
  updateBpus:socketHandle+'/#updateBpus',            //updates client exps and bpus
  ledsSet:socketHandle+'/#ledsSet',            //updates client exps and bpus
 
  ping:socketHandle+'/#ping',                           //General Purpose
  kickFromLab:socketHandle+'/#kickFromLab',                           //General Purpose
};
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
        me.connectionInfo={
          username:me.options.username, userID:me.options.userID, 
          sessionID:me.options.sessionID, 
          bpuID:me.options.bpuID, 
          liveBpuExperimentID:me.options.liveBpuExperimentID,
          socketID:me.mySocket.id, socketHandle:socketHandle,
        };
        //Ping
        me.mySocket.on(socketStrs.ping, function(cb_fn) {
          if(cb_fn && typeof cb_fn==='function') cb_fn();
        });
        //Set Connection
        me.mySocket.emit(socketStrs.setConnection, me.connectionInfo, function(err, resObj) {
          app.mainView.roughLabStartDate=new Date();
          if(err) {
            setConnectionCallbackToParent(err, null);
          } else {
            if(resObj.setLedsObj===null || resObj.setLedsObj===undefined) {
              resObj.setLedsObj={
                time:null, topValue: null, rightValue: null, bottomValue: null, leftValue: null,
                metaData: { 
                  username: me.connectionInfo.username,
                  userID: me.connectionInfo.userID,
                  expID: me.connectionInfo.liveBpuExperimentID,
                  bpuID: me.connectionInfo.bpuID, 
                  sessionID: me.connectionInfo.sessionID, 
                }
              };
            } else {
              resObj.setLedsObj.metaData.username=me.connectionInfo.username;
              resObj.setLedsObj.metaData.userID=me.connectionInfo.userID;
              resObj.setLedsObj.metaData.expID=me.connectionInfo.liveBpuExperimentID;
              resObj.setLedsObj.metaData.bpuID=me.connectionInfo.bpuID;
              resObj.setLedsObj.metaData.sessionID=me.connectionInfo.sessionID;
            }
            setConnectionCallbackToParent(null, resObj.setLedsObj);
          }

          //kick user from lab socket listener
          me.mySocket.on(socketStrs.kickFromLab, function(cb_fn) {
            app.mainView.kickUser();
          });

        });
      }
    });
  };

  //Parent Call start Update Bpus
  me.startUpdateBpus=function() {
    //Create Socket call
    me.mySocket.on(socketStrs.updateBpus, function(updateObj) {
      me.lastBpuUpdate=new Date();
      if(updateObj.bpusPackage && updateObj.bpusPackage.forEach && updateObj.bpusPackage.length>0) {
        updateObj.bpusPackage.forEach(function(bpuPack) {
          //Check bpu exps for user data
          if(bpuPack.username===app.mainView.user.get('username')) {
            if(bpuPack.type==='live') {
              var timeLeft=bpuPack.expTimeLeft;
              var secondsLeft=Math.round(bpuPack.expTimeLeft/1000);
              app.mainView.setTimeLeftInLabLabel(timeLeft, 0, true);
              app.mainView.wasTimeSetFromUpdate=true;
            }
          }
        });
      }
    });
  };
  me.ledsSet=function(ledsSetObj) {
    ledsSetObj.sentTime=new Date().getTime();
    me.mySocket.emit(socketStrs.ledsSet, ledsSetObj, function(err, resObj) {
      //console.log('set leds err:'+err);
      //console.log('set leds resObj', resObj);
    });
  };
}());
