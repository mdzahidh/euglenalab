var async=require('async');

//Get Random Stuff for Client Inf
var crypto = require('crypto');
var base64url = require('base64url');
/** Sync */
function randomStringAsBase64Url(size) {
  return base64url(crypto.randomBytes(size));
}
//Mongoose
var mongoose=require('mongoose');
var mongoUri='mongodb://localhost:27017/'+'dev';
//Socket Client
var socketIoClient=require('socket.io-client');
var socketClientServerIP='localhost';
var socketClientServerPort='4200';

var app={
  mainConfig:require('../shared/mainConfig.js'),
};

//Init Functions
app.db=null;
var setupMongoose=function(callback) {
  app.db=mongoose.createConnection(mongoUri);
  app.db.on('error', function(err) {
    callback('init setupMongoose error:'+err);
  });
  app.db.once('open', function () {
    require('./mongoModels')(app, mongoose);
    callback(null);
  });
};
app.socket=null;
var setupClientSocket=function(callback) {
  app.socket=socketIoClient.connect('http://'+socketClientServerIP+':'+socketClientServerPort);
  app.socket.on('connect', function() {
    console.log('connection:'+app.socket.id);
  });
  callback(null);
};
app.joinQueueDataObj=null;
var getSubmitData=function(callback) {
  app.joinQueueDataObj=app.db.models.BpuExperiment.getDataObjToJoinQueue();
  callback(null);
};
//Init Function
var init=function(callbackToMain) {
  //Build Init Series 
  var initSeriesFuncs=[];
  initSeriesFuncs.push(setupMongoose);
  initSeriesFuncs.push(setupClientSocket);
  initSeriesFuncs.push(getSubmitData);
  //Run Init Series
  async.series(initSeriesFuncs, function(err) {
    if(err) {
      callbackToMain('initSeries end err:'+err);
    } else {
      callbackToMain(null);
    }
  });
};

var submitLiveExpOnWebServer=function(joinQueueDataArray, callbackToClient) {
  //Web server builds a new exp for each sumbit package in array
  //...saves them to the db
  //...saves a tag to listExperiment
  //...returns array of failed submissions
  var outcome={
    failed:[],
  };
  var actionFunc=function(actionCallback) {
    var submitObj=this;
    var newExp=app.db.models.BpuExperiment();

    newExp.user.id=submitObj.user.id;
    newExp.user.name=submitObj.user.name;
    newExp.user.groups=submitObj.user.groups;
    
    newExp.session.id=submitObj.session.id;
    newExp.session.sessionID=submitObj.session.sessionID;
    newExp.session.socketID=submitObj.session.socketID;
   
    newExp.group_experimentType=submitObj.group_experimentType;
    newExp.exp_wantsBpuName=submitObj.exp_wantsBpuName;
    
    newExp.exp_eventsToRun=submitObj.exp_eventsToRun;
    newExp.exp_eventsToRun.sort(function(objA, objB) {return objB.time-objA.time;});
    newExp.exp_eventsRunTime=newExp.exp_eventsToRun[0].time;
    
    newExp.exp_metaData=submitObj.exp_metaData;

    newExp.exp_submissionTime=new Date().getTime();
    var validationObj=app.db.models.BpuExperiment.validate(newExp);
    if(validationObj.isValid) {
      newExp.save(function(err, savedExp) {
        if(err) {
          outcome.failed.push({joinQueueData:submitObj, err:err});
          actionCallback(null);
        } else {
          var expTag=savedExp.getExperimentTag();
          app.db.models.ListExperiment.addNewExpTagToList(expTag, function(err) {
            if(err) {
              outcome.failed.push({joinQueueData:submitObj, err:err});
              actionCallback(null);
            } else {
              actionCallback(null);
            }
          });
        }
      });
    } else {
      outcome.failed.push({joinQueueData:submitObj, err:validationObj.err});
      actionCallback(null);
    }
  };
  //Build Actions 
  var actionFuncs=[]; 
  joinQueueDataArray.forEach(function(submitObj) {
    actionFuncs.push(actionFunc.bind(submitObj)); 
  });
  //Start Actions 
  async.parallel(actionFuncs, function(err) {
    if(err) {
      callbackToClient(err, null);
    } else if(outcome.failed.length>0) {
      callbackToClient('some failed', outcome.failed);
    } else {
      callbackToClient(null, null);
    }
  });
};
var submitLiveExpOnBrowser=function(type, wantsBpuName) {
  var fakePageData={
    url:'/account/joinlabwithdata/',
  };
  var _Handle='/account/joinlabwithdata';  //socketHandle is set per client socket js,, ideally matches the page url
  //Fake User
  var fakeUserInfo={
    _id:app.db.models.User()._id,
    username:'user'+randomStringAsBase64Url(4),
    groups:['default'], 
  };
  var fakeSessionInfo={
    _id:app.db.models.Session()._id,
    sessionID:randomStringAsBase64Url(24),
    socketID:app.socket.id, 
  };
  //User Clicks Submit Live Button on Join Lab Page
  var joinQueueData=JSON.parse(JSON.stringify(app.joinQueueDataObj));
  joinQueueData.group_experimentType=type;
  var joinQueueDataObjects=[joinQueueData];
  //Extra info is added to every joinqueue data object
  joinQueueDataObjects.forEach(function(obj) {
    obj.user.id=fakeUserInfo._id;
    obj.user.name=fakeUserInfo.username;
    obj.user.groups=fakeUserInfo.groups;
    
    obj.session.id=fakeSessionInfo._id;
    obj.session.sessionID=fakeSessionInfo.sessionID;
    obj.session.socketID=fakeSessionInfo.socketID;
    
    obj.exp_metaData.group_experimentType=obj.group_experimentType;
    obj.exp_wantsBpuName=wantsBpuName;
    
    obj.exp_metaData.clientCreationDate=new Date();
    obj.exp_metaData.userUrl=fakePageData.url;
    obj.exp_metaData.tag='no tag set';
    obj.exp_metaData.description='no description set';
  });
  //Array of submit packages are submitted through socket-client.js
  //Check Each Pack is again check...redundent
  joinQueueDataObjects.forEach(function(obj) {
    if(obj.group_experimentType==='live') {
      var zeroEvt=JSON.parse(JSON.stringify(obj.zeroLedEvent));
      var lastEvt=JSON.parse(JSON.stringify(obj.zeroLedEvent));
      lastEvt.time=obj.liveUserLabTime;
      obj.exp_eventsToRun.push(zeroEvt);
      obj.exp_eventsToRun.push(lastEvt);
    }
    //Sesison ID is updated with lastest from socket setconnection...we could update this on the client page.. 
    //obj.session.id=fakeSessionInfo._id;
    //obj.session.sessionID=fakeSessionInfo.sessionID;
    //obj.session.socketID=fakeSessionInfo.socketID;
    obj.session.socketHandle=_Handle;
  });
  //Emitted join array of exp sumbission to webserver
  submitLiveExpOnWebServer(joinQueueDataObjects, function(err, failures) {
    if(err) {
      console.log('submitLiveExpOnBrowser.submitLiveExpOnWebServer err', err);
      failures.forEach(function(failure) {
        console.log(failure.joinQueueData.session.sessionID, failure.err);
      });
    } else {
      console.log('submitLiveExpOnBrowser.submitLiveExpOnWebServer');
    }
  });
};

//Init Controller and RUn Loop
init(function(err) {
  if(err) {
    console.log('init err:'+err);
  } else {
    var type='live';
    var wantsBpuName=null;
    submitLiveExpOnBrowser(type, wantsBpuName);
  }
});
