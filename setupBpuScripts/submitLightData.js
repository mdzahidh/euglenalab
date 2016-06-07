//Deps
var os=require('os');
var async=require('async');
var exec=require('child_process').exec;
var socketIoClient=require('socket.io-client');
var Mongoose=require('mongoose');

//Constants
var _ScriptName='submitLightData.js';
//Init Arguments
var _lightDataJsonPath='./testLightData/submit_lightdata.json';
var _serverAddr='http://'+'192.168.1.218'+':'+'8090';
var _mongoUri='mongodb://localhost:27017/'+'dev';
var _mongoSchemaModels='/home/mserver/dev-processingFeature/shared/mongoDb/schema/models.js';

var bpu_ping='/bpu/#ping';
var bpu_getStatus='/bpu/#getStatus';
var bpu_runExp='/bpu/#runExp';
var bpu_runExpLedsSet='/bpu/runExp/#ledsSet';
var bpu_resetBpu='/bpu/#resetBpu';

var _socketSubmitEmitStr=bpu_runExp;
var _socketSubmitResStr=_socketSubmitEmitStr+'Res';

//Init Flags 
var _doSkipConnectToServer=false;
var _doSkipPullLightData=false;
var _doSkipMongoConnection=false;
var _doSkipBuildMongoExpDoc=false;
var _doSkipSubmitExp=false;

//Run Arguments
//Run Flags

//Series Funcs
var outcome={};
outcome.serverSocket=null;
var connectToServer=function(callback) {
  var startDate=new Date();
  var funcName='connectToServer';

  console.log(funcName+' start');

  var serverAddr=this.serverAddr || 'http://'+'192.168.1.218'+':'+'8090';
  outcome.serverSocket=socketIoClient(serverAddr, {multiplex:false, reconnection:false});

  var _expsRequests=[];
  outcome.serverSocket.on('connect', function () {
    console.log(funcName+' end with connect');
    setTimeout(function() {
      if(callback) return callback(null);
    }, 1000);
  });
  outcome.serverSocket.on('disconnect', function(msg) {
    console.log(funcName+' disconnect');
    outcome.serverSocket.disconnect();
    outcome.serverSocket.close();
  });
};

outcome.submitLightData={};
var readLightDataJson=function(callback) {
  var startDate=new Date();
  var funcName='readLightDataJson';
  var lightDataJsonPath=this.lightDataJsonPath || './testLightData/submit_lightdata.json';
  
  console.log(funcName+' start');
  
  var submitLightData={
    eventsToRun:[], 
    metaData:{
      tag:'submit_lightdata.json',
      description:'testing bpu processing'
    }
  }; 
  var catchErr=null;
  try {
    var submitLightDataJson=require(lightDataJsonPath);
    //Find events to run and make relative
    submitLightDataJson.eventsToRun.sort(function(objA, objB) {return objA.time-objB.time;});
    var zeroTime=submitLightDataJson.eventsToRun[0].time;
    submitLightDataJson.eventsToRun.forEach(function(ld) {
      submitLightData.eventsToRun.push({
        time:ld.time-zeroTime, 
        radius:ld.radius,
        angle:ld.angle,
        topValue:ld.topValue,
        rightValue:ld.rightValue,
        bottomValue:ld.bottomValue,
        leftValue:ld.leftValue
      });
    });
  } catch(err) {
    catchErr=err;
  } finally {
    if(catchErr) {
      return callback(funcName+' catchErr:'+catchErr);
    } else {
      console.log(funcName+' end');
      outcome.submitLightData=submitLightData;
      return callback(null);
    }
  }
};

outcome.mongoDb=null;
var connectToMongo=function(callback) {
  var startDate=new Date();
  var funcName='connectToMongo';
  var mongoUri=this.mongoUri || 'mongodb://localhost:27017/'+'dev';
  var mongoSchemaModels=this.mongoSchemaModels || '/home/mserver/dev-processingFeature/shared/mongoDb/schema/models.js';
  console.log(funcName+' start');

  var app={
    //Mongoose Models Legacy 
    get:function() {return 'development';},
    config:{
      isDevelopment:true,
      loginAttempts:{
        forIp: 50,
        forIpAndUser: 7,
          logExpiration: '20m'
      }
    },
    db:null,
    //Mongo schemas from server need log4js 
    log4js:require('log4js'),
  };

  app.db=Mongoose.createConnection(mongoUri);
  require(mongoSchemaModels)(app, Mongoose);
  app.db.on('error', function(err) {
    callback(funcName+' start mongoose connection error:'+err);
  });
  app.db.once('open', function () {
    console.log(funcName+' end');
    outcome.mongoDb=app.db;
    return callback(null);
  });
};

outcome.expDoc=null;
var buildMongoExpDoc=function(callback) {
  var startDate=new Date();
  var funcName='buildMongoExpDoc';

  console.log(funcName+' start');

  var newExp=outcome.mongoDb.models.BpuExperiment();
  newExp.group_experimentType='text';
  newExp.exp_eventsToRun=outcome.submitLightData.eventsToRun;
  newExp.exp_metaData=outcome.submitLightData.metaData;
  console.log(outcome.submitLightData.metaData);
  console.log(newExp.exp_metaData);
  newExp.exp_eventsToRun.sort(function(objA, objB) {return objA.time-objB.time;});
  var expEvent={
    time: newExp.exp_eventsToRun[1].time-10, 
    topValue: 200, 
    rightValue: -10, 
    bottomValue: 'v30', 
    leftValue: 400 
  };
  newExp.exp_eventsToRun.push(expEvent);

  newExp.exp_eventsToRun.push({time: -1000, topValue: 0, rightValue: 0, bottomValue: 0, leftValue: 0});
  newExp.exp_eventsToRun.push({time: 0, topValue: 0, rightValue: 0, bottomValue: 0, leftValue: 0});
  newExp.exp_eventsToRun.push({time: 5*60*1000+1, topValue: 0, rightValue: 0, bottomValue: 0, leftValue: 0});
  outcome.expDoc=newExp;
  return callback(null);
};

outcome.submitRetObj=null;
var submitExp=function(callback) {
  var startDate=new Date();
  var funcName='submitExp';
  console.log(funcName+' do '+_socketSubmitEmitStr);
  if(_socketSubmitEmitStr===bpu_ping) {
    console.log(funcName+' emit '+bpu_ping);
    outcome.serverSocket.emit(bpu_ping, function(err, retObj) {
      console.log(_socketSubmitEmitStr, err, retObj);
      if(err) {
        return callback(err);
      } else {
        outcome.pingRetObj=retObj;
        return callback(null);
      }
    });
  } else if(_socketSubmitEmitStr===bpu_runExpLedsSet) {
    console.log(funcName+' emit '+bpu_runExpLedsSet);
    var lightData={topValue:100, rightValue:0, bottomValue:0, leftValue:0};
    outcome.serverSocket.emit(bpu_runExpLedsSet, lightData, function(err, retObj) {
      console.log(_socketSubmitEmitStr, err, retObj);
      if(err) {
        return callback(err);
      } else {
        outcome.runExpLedsSetObj=retObj;
        return callback(null);
      }
    });
  } else if(_socketSubmitEmitStr===bpu_getStatus) {
    console.log(funcName+' emit '+bpu_getStatus);
    outcome.serverSocket.emit(_socketSubmitEmitStr, function(err, retObj) {
      console.log(_socketSubmitEmitStr, err, retObj);
      if(err) {
        return callback(err);
      } else {
        outcome.getStatusRetObj=retObj;
        return callback(null);
      }
    });
  } else if(_socketSubmitEmitStr===bpu_resetBpu) {
    console.log(funcName+' emit '+bpu_resetBpu);
    outcome.serverSocket.emit(bpu_resetBpu, function(err, retObj) {
      console.log(_socketSubmitEmitStr, err, retObj);
      if(err) {
        return callback(err);
      } else {
        outcome.resetBpuRetObj=retObj;
        return callback(null);
      }
    });
  } else if(_socketSubmitEmitStr===bpu_runExp) {
    outcome.serverSocket.emit(bpu_runExp, outcome.expDoc.toJSON(), function(err, retObj) {
      console.log(_socketSubmitEmitStr, err, retObj);
      if(err) {
        return callback(err);
      } else {
        outcome.runExpRetObj=retObj;
        return callback(null);
      }
    });
  } else {
  }
};

//Series Funcs
var funcs=[];
if(!_doSkipConnectToServer) funcs.push(connectToServer.bind({serverAddr:_serverAddr}));
if(!_doSkipPullLightData) funcs.push(readLightDataJson.bind({lightDataJsonPath:_lightDataJsonPath}));
if(!_doSkipMongoConnection) funcs.push(connectToMongo.bind({mongoUri:_mongoUri, mongoSchemaModels:_mongoSchemaModels}));
if(!_doSkipBuildMongoExpDoc) funcs.push(buildMongoExpDoc.bind({}));
if(!_doSkipSubmitExp) funcs.push(submitExp.bind({}));

var startDate=new Date();
console.log(_ScriptName+' start:'+startDate);
async.series(funcs, function(err) {
  console.log(_ScriptName+' end:'+(new Date()-startDate)+' ms');
  if(err) {
    console.log(_ScriptName+' ERROR:'+err);
  } else {
    console.log(_ScriptName+' OKAY');
  }
}); 
