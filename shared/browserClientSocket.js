var clientIO=require('socket.io-client');
var BpuAutoLightData=require('./autoUserData.json');
var BpuTestLightData=require('./testLightUserData.json');
var eventsToRun=BpuAutoLightData;
var isConnected=false;
var app=null;
var exampleExp={
  username:'casey',
  eventsToRun:eventsToRun,
  isLive:false,
  isArray:true,
  isAuto:false,
};

exports.setApp=function(pApp) {
  app=pApp;
}

exports.connect=function(ip, callback) {
  app.mainView.mySocket.socket=clientIO(ip, {multiplex:false});
  console.log('connecting to '+ip);
  app.mainView.mySocket.socket.on('connect', function () {
    app.mainView.user.attributes.socketID=app.mainView.mySocket.socket.id;
    isConnected=true;
    console.log('socket.on connect');
    app.mainView.mySocket.socket.on('/livejoylab/#setConnectionRes', function(systemStatus) {
      console.log(new Date().getTime()+':'+'/livejoylab/#setConnectionRes');//, systemStatus);
      var user={
        username:app.mainView.user.attributes.username,
        socketID:app.mainView.mySocket.socket.id,
        sessionID:app.mainView.user.attributes.sessionID,
      }
      myEmits.joinQueue({exp:exampleExp, user:user});
    });
    app.mainView.mySocket.socket.on('/livejoylab/#joinQueueRes', function(stats) {
      console.log(new Date().getTime()+':'+'/livejoylab/#joinQueueRes', stats);
    });
    var setConnectionData={
      sessionID:app.mainView.user.attributes.sessionID,
      username:app.mainView.user.attributes.username,
    }; 
    myEmits.setConnection(setConnectionData);
  });
};

var myEmits={
  setConnection:function(sessionID) {app.mainView.mySocket.socket.emit('/livejoylab/#setConnection', sessionID);},
  setArduino:function(lightValues) {
    app.mainView.mySocket.socket.emit('/livejoylab/#setArduino', {
      expId:app.mainView.expId,
      lightValues:lightValues,
    });
  },
  joinQueue:function(data) {app.mainView.mySocket.socket.emit('/livejoylab/#joinQueue', data);},
  queuryQueue:function(data) {app.mainView.mySocket.socket.emit('/livejoylab/#queuryQueue', data);},
  noActivity:function(data) {app.mainView.mySocket.socket.emit('/livejoylab/#noActivity', data);},
  pingRes:function() {app.mainView.mySocket.socket.emit('/livejoylab/#pingRes');},
};
exports.myEmits=myEmits;
