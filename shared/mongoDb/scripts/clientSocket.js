var clientIO=require('socket.io-client');
var fs=require('fs');

//General Functions
var getRandomIntInclusive=function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
var dateFromObjectId=function(objectId) {
  return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
};

//Light Data
var lightDataFilename='./testLightUserData.json';
var getLightDataFromFile=function(callback) {
  fs.readFile(lightDataFilename, function (err, data) {
    if(err) throw 'getLightDataFromFile err:'+err;
    var lightData=JSON.parse(data);
    callback(err, lightData);
  });
};
var getLightDataFromJson=function(callback) {
  return require(lightDataFilename);
};

//Experiment 
var getExpLikeBrowser=function(username, sessionID, socketID, eventsToRun, isLive, isArray) {
  var exp={
    user:{
      name:username,
      sessionID:sessionID,
      socketID:socketID,
    },
    exp:{
      expId:null, 
      username:username, 
      isLive:isLive, 
      isArray:isArray, 
      isAuto:false, 
      autoType:null,
      eventsToRun:eventsToRun,
    },
  };
};


//Socket
var socketAddr='http://localhost:4000'
var socket=clientIO(socketAddr, {multiplex:false});
socket.on('connect', function () {
  console.log('socket connect', socket.id);
  console.log(socket.io.engine.id); 
});

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
