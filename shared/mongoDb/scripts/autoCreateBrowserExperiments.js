var fs=require('fs');
var async=require('async');
var mongoose=require('mongoose');
var BpuTestLightData=require('./testLightUserData.json');
var socketHandler=require('./browserClientSocketHandler.js');

var ioClient=require('socket.io-client');

var app={};
app.db=null;
app.config={
  isDevelopment:false,
  mongoUri:'mongodb://localhost:27017/drywall-client',
};
if(app.config.isDevelopment) {
  app.config.mongoUri+='-dev';
}
app.get=function() {
  return 'development'
}
app.config.loginAttempts = {
  forIp: 50,
  forIpAndUser: 7,
  logExpiration: '20m'
};

app.init=function(mainCallback) {
  var outcome={};
  var setupDatabase=function(callback) {
    app.db=mongoose.createConnection(app.config.mongoUri);
    app.db.on('error', function(err) {
      return callback('setupDatabase:'+'mongoose connection err:'+err);
    });
    app.db.once('open', function () {
      require('../schema/models')(app, mongoose);
      app.joinQueueDataObj=app.db.models.BpuExperiment.getDataObjToJoinQueue();
      return callback(null);
    });
  };
  var setupSocket=function(callback) {
    app.socketAddr='http://'+'localhost'+':'+'5000';  
    app.socket=ioClient(app.socketAddr, {multiplex:false, reconnection:false});
    app.socket.on('connect', function() {
      var user={
        _id:'55baca55f8eb77ad6ed1caab',
        username:'casey',
        socketID:null,
        sessionID:'12345678',
      };
      app.socket.user=user;
      user.socketID=app.socket.id;
      socketHandler.connected(app, user, app.socket, function(err) {
        return callback(err);
      });
    });
  };

  var asyncFinally=function(err) {
    var addExperiment=function() {
      //Join Queue Object
      var useBpu='eug1'; 
      var joinQueueReqData=buildDataObjToJoinQueue(
        {
          _id:app.socket.user._id,
          username:app.socket.user.username,
          sessionID:app.socket.user.sessionID,
          socketID:app.socket.user.socketID,
        }
      );
      joinQueueReqData.exp_wantsBpuName=useBpu;
      joinQueueReqData.experimentType.isLive=true;
      socketHandler.accountJoinQueue(app, app.socket.user, joinQueueReqData, app.socket, function(joinObj) {
        console.log('main: ', joinObj);
      });
    };
    if(err) {
      console.log('Error: '+err);
    } else {
      addExperiment();
    }
  };
  async.waterfall([
    setupDatabase,
    setupSocket,
  ], asyncFinally);
};
app.init();
//Funcitons
var getRandomIntInclusive=function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
var dateFromObjectId=function(objectId) {
  return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
};
var buildDataObjToJoinQueue=function(user, experimentType) {
  var joinQueueData=JSON.parse(JSON.stringify(app.joinQueueDataObj));
  joinQueueData.user.id=user._id;
  joinQueueData.user.username=user.username;
  joinQueueData.user.sessionID=user.sessionID;
  joinQueueData.user.socketID=user.socketID;
  return joinQueueData;
};
