var os=require('os'); 
var fs=require('fs'); 
var async=require('async'); 

//Mongoose Thingy
//Mongoose Thingy
//Mongoose Thingy
var mongoose={};
mongoose.modelsJson=require('../shared/mongoDb/jsonSchema/models.js');
mongoose.models={};
mongoose.savePath='/myData/bpu/fakeMongo';
mongoose.readyPath='/myData/bpu/readyMongo';
mongoose.models.BpuExperiment=function() {
  return JSON.parse(JSON.stringify(mongoose.modelsJson.BpuExperiment));
};
mongoose.setSavePath=function(savePath) {
  mongoose.savePath=savePath;
};
mongoose.getSavePath=function() {
  return mongoose.savePath;
};
mongoose.setReadyPath=function(readyPath) {
  mongoose.readyPath=readyPath;
};
mongoose.getReadyPath=function() {
  return mongoose.readyPath;
};
mongoose.models.BpuExperiment.save=function(exp, callback) {
  fs.writeFile(exp.bpuFakeMongoPath, JSON.stringify(exp, null, 4), function(err) {
    callback(err, exp);
  });
};
mongoose.models.Bpu=function() {
  return JSON.parse(JSON.stringify(mongoose.modelsJson.Bpu));
};
mongoose.models.Group={}
mongoose.models.Group.findOne=function(nameObj, returnsArray, callback) {
  var returnObj=null;
  mongoose.modelsJson.GroupsJson.forEach(function(item) {
    if(nameObj.name===item.name) {
      returnObj=JSON.parse(JSON.stringify(item));  
    }
  });
  if(returnObj===null) {
    callback('dne', null);
  } else {
    callback(null, returnObj);
  }
};
//Regular Init
//Regular Init
//Regular Init
//Regular Init

var BpuAutoLightData=require('../shared/autoUserData.json');
var BpuTestLightData=require('../shared/testLightUserData.json');
var MainConfig=require('../shared/mainConfig.js');

var printName='(server_socket2.js)';
var printOn=true;
var clearConsole=function() {
  if(printOn) {
    console.log('\033c');
  }
};
var mp=function(msg) {
  if(printOn) {
    console.log(printName+'\t'+' mp:'+msg);
  }
};
var mpErr=function(msg, err) {
  if(printOn) {
    console.log(printName+'\t'+'mpErr:'+msg, err);
  }
};

var app={};
app.mainConfig=MainConfig;
app.isInitialized=false;
app.hasConnection=false;
//Main Objecvts
app.bpu=require('./bpu-nomongo.js');
app.db=mongoose;
app.io=null;
app.socket=null;
//Congig
app.config={
  doInternalBpuCheck:false,
  doSkipAuto:false,
  doFakeLeds:false,
  doFakeScripts:false,
  doFakeBpu:false,
  doCamera:false,
};
//Data Locations
app.myDataLocs={};
app.myDataLocs.mainDataDir='/myData';
app.myDataLocs.bpuSaveDir=app.myDataLocs.mainDataDir+'/bpu';
app.myDataLocs.bpuSaveDir_tars=app.myDataLocs.bpuSaveDir+'/tars';
app.myDataLocs.bpuSaveDir_temp=app.myDataLocs.bpuSaveDir+'/temp';
app.myDataLocs.bpuSaveDir_images=app.myDataLocs.bpuSaveDir+'/images';
app.myDataLocs.bpuSaveDir_fakeMongo=app.myDataLocs.bpuSaveDir+'/fakeMongo';
app.myDataLocs.bpuSaveDir_readyMongo=app.myDataLocs.bpuSaveDir+'/readyMongo';
app.db.setSavePath(app.myDataLocs.bpuSaveDir_fakeMongo);

//Bpu Stuff
app.bpuConfig=null;
app.bpuStatusTypes=null;
app.bpuStatuses={
  bpuNull:'bpuNull',
  initializing:'initializing',
  initializingDone:'initializingDone',
  initializingFailed:'initializingFailed',
  expRunning:'exp running',
  expRunningFailed:'exp running failed',
  expRunningDone:'exp running done',
  dataPacking:'data packing',
  dataPackingFailed:'data packing failed',
  dataProcessing: 'data processing',
  dataProcessingFailed:'data processing failed',
  dataReady:'data ready',
};

app.socketDisconnectionState={
  bpuStatus:null,
  date:null,
};

var fn_serverHandler=function(req, res) {
  mp('socket.on fn_serverHandler');
};

var fn_connectionHandler=function() {
  //Emits From Bpu 
  app.socket.myInternalEmits={
    dataReady:function(from) {
      app.socket.emit('/mServer/#dataReady', app.bpuStatuses.dataReady);
      app.socket.emit('/livejoylab/#dataReady', {bpuStatus:app.bpuStatuses.dataReady, fileName:app.bpu.getTheOnlyExperiment().bpuFakeMongoFilename});
    },
    expRunningDone:function(from) {
      app.socket.emit('/livejoylab/#expRunningDone', app.bpuStatuses.expRunningDone);
    },
  };
  //Responses From Here
  app.socket.myEmitResponses={
    pingRes:function(data) {
      app.socket.emit('/mServer/#pingRes', data);
    },
    addExpRes:function(data, from) {
      app.socket.emit('/mServer/#addExpRes', data);
    },
    getStatusRes:function(data) {
      app.socket.emit('/mServer/#getStatusRes', data);
    },
    resetBpuRes:function(data) {
      app.socket.emit('/mServer/#resetBpuRes', data);
    },
  };
  
  //Default
  app.socket.on('disconnect', function(data) {
    mp('socket.on disconnect');
    app.socketDisconnectionState.bpuStatus=app.bpu.myStatus();
    app.socketDisconnectionState.date=new Date();
    app.socket.disconnect();
    app.socket=null;
  });
  
  //Rx From Clients
  app.socket.on('ping', function() {
    app.socket.myEmitResponses.pingRes({res:'pong'});
  });
  app.socket.on('ledsSet', function(lightData) {
    var timeNow=new Date().getTime();
    lightData.setTime=timeNow;
    lightData.askTime=timeNow;
    var newLd=app.bpu.ledsSet(lightData)
    app.bpu.addToEventsRan(newLd);
  });
  app.socket.on('getStatus', function() {
    var retObj={
      bpuStatus:app.bpu.myStatus(),
      timeLeft:0,
      expId:null,
      isOver:false,
      isReady:false,
    };
    var activeExp=app.bpu.getTheOnlyExperiment();
    if(activeExp) {
      retObj.timeLeft=Math.max(0, activeExp.experimentInfo.runTime-(new Date().getTime()-activeExp.experimentInfo.startTime));
      retObj.username=activeExp.username;
      retObj.expId=activeExp.expId;
      retObj.runTime=activeExp.experimentInfo.runTime;
      retObj.isCanceled=activeExp.experimentInfo.isCanceled;
      retObj.isOver=activeExp.experimentInfo.isOver;
      retObj.isReady=activeExp.experimentInfo.isReady;
    } 
    if(!app.isInitialized) {
      retObj.bpuStatus=app.bpuStatuses.initializing;
    }
    app.socket.myEmitResponses.getStatusRes(retObj);
  });
  app.socket.on('addExp', function(exp) {
    exp.eventsToRun.sort(function(a, b) {
      return a.time-b.time;
    });
    var runTime=exp.eventsToRun[exp.eventsToRun.length-1].time-exp.eventsToRun[0].time;
    exp.experimentInfo.runTime=runTime;
    var retObj={
      accecpted:false, 
      bpuStatus:app.bpu.myStatus(),
    };
    var cont=function() {
      if(app.bpu.myStatus()===app.bpuStatuses.initializingDone) {
        setNewExperiment(exp, function(err, newExp) {
          if(err) {
            retObj.err='setNewExperiment err:'+err;
          } else {
            retObj.accepted=true;
            retObj.processingTime=newExp.experimentInfo.runTime+60000;
            retObj.bpuFakeMongoPath=newExp.bpuFakeMongoPath
            retObj.bpuFakeMongoFilename=newExp.bpuFakeMongoFilename
            retObj._id=newExp._id;
            app.bpu.runExp(app, newExp, function(err) {
              var retObj={
                bpuStatus:app.bpu.myStatus(),
              };
              if(err) {
                mpErr('runExp err:'+err); 
                retObj.err=err;
                if(app.socket!==null && app.socket!==undefined) {
                  app.socket.myInternalEmits.dataReady(retObj, 'socket addExp runExp callback err');
                }
              } else {
                if(app.socket!==null && app.socket!==undefined) {
                  app.socket.myInternalEmits.dataReady(retObj, 'socket addExp runExp callback no err');
                }
              }
            });
          }
          app.socket.myEmitResponses.addExpRes(retObj, 'socket addExp setNewExperiment');
        });
      } else {
        retObj.err='status not initializingDone';
        retObj.msg='must do a force reset or wait';
        app.socket.myEmitResponses.addExpRes(retObj, 'socket addExp');
      }
    };
    if(retObj.bpuStatus===app.bpuStatuses.bpuNull) {
      app.bpu.initialize(app, function(err) {
        cont();
      });
    } else {
      cont();
    }
  });
  app.socket.on('resetBpu', function(data) {
    mp('socket.on resetBpu');
    var resetBpu=function(cb_fn) {
      var options={
        fName:'resetBpu',
        timeoutInterval:30000,
      };
      asyncFunctionTemplate(options, app.bpu.resetBpu, function(err) {
        cb_fn(null);
      });
    };
    resetBpu(function() {
      if(app.socket!==null && app.socket!==undefined) {
        app.socket.myEmitResponses.resetBpuRes({});
        clearConsole();
        mp('BPU RESET OKAY, READY FOR NEXT EXPERIMENT');
      }
    });
  });
};



var init=function() {
  var getConfig=function(callback) {
    var options={
      fName:'getConfig',
      timeoutInterval:5000,
    };
    var action=function(cb_fn) { 
      var netFaces=os.networkInterfaces();
      var thisIP=netFaces.eth0[0].address;
      var fake=null
      var found=null
      MainConfig.bpus.forEach(function(item) {
        if(item.localAddr.ip===thisIP) {
          found=item;
        } else if(item.name==='fake') {
          fake=item;
        }
      });
      if(found!==null) {
        app.bpuConfig=found;
        app.bpuConfig.maxTextFileTime=MainConfig.maxTextFileTime;
        app.bpuConfig.minTextFileTime=MainConfig.minTextFileTime;
        app.bpuStatusTypes=MainConfig.bpuStatusTypes;
        cb_fn(null);
      } else if(fake!==null) {
        app.bpuConfig=fake;
        app.bpuConfig.maxTextFileTime=MainConfig.maxTextFileTime;
        app.bpuConfig.minTextFileTime=MainConfig.minTextFileTime;
        app.bpuStatusTypes=MainConfig.bpuStatusTypes;
        cb_fn(null);
      } else {
        cb_fn('could not find bpu config in main config by ip address of fake')
      }
    };
    asyncFunctionTemplate(options, action, function(err) {
      return callback(err);
    });
  };
 
  var createServer=function(callback) {
    var options={
      fName:'createServer',
      timeoutInterval:15000,
    };
    var action=function(cb_fn) { 
      var err='createServer failed';
      var server=require('http').createServer(fn_serverHandler);
      mp('\t\tcreateServer addr:'+app.bpuConfig.localAddr.ip+':'+app.bpuConfig.localAddr.serverPort);
      console.log(app.bpuConfig.localAddr.serverPort, app.bpuConfig.localAddr.ip);
      server.listen(app.bpuConfig.localAddr.serverPort, app.bpuConfig.localAddr.ip);
      app.io=require('socket.io')(server);
      app.io.on('connection', function(socket) {
        if(app.socket===null) {
          mp('init connection id:'+socket.id);
          app.hasConnection=true;
          app.socket=socket;
          fn_connectionHandler();
        } else { 
          mpErr('init connection', 'app.bpu already exists');
        }
      });
      cb_fn(null);
    };
    asyncFunctionTemplate(options, action, function(err) {
      return callback(err);
    });
  };
  
  var resetBpu=function(callback) {
    var options={
      fName:'resetBpu',
      timeoutInterval:20000,
    };
    app.bpu.initialize(app, function(err) {
      if(err) {
        callback('init resetBpu err:'+err);
      } else {
        asyncFunctionTemplate(options, app.bpu.resetBpu, function(err) {
          return callback(err);
        });
      }
    });
  };

  var asyncFinally=function(err) {
    if(err) {
      mpErr('init asyncFinally err:', err);
    } else {
      app.isInitialized=true;
      mp('init asyncFinally okay. Initialization Complete. Waiting for connection');
    }
  };

  async.waterfall([
    getConfig,
    createServer,
    resetBpu,
  ], asyncFinally);
};
var setNewExperiment=function(newExp, callback) {
  var savePath=mongoose.getSavePath();
  var saveName=newExp._id+'_'+newExp.username+'.json';
  savePath=savePath+'/'+saveName;
  newExp.bpuFakeMongoFilename=saveName;
  newExp.bpuFakeMongoPath=savePath;
  
  newExp.bpuInfo={
    nameBpu:app.bpuConfig.name,
    useBpu:newExp.bpuInfo.useBpu,
  };
  
  newExp.debugSettings={
    doSkipAuto:app.config.doSkipAuto,
    doFakeLeds:app.config.doFakeLeds,
    doFakeScripts:app.config.doFakeScripts,
    doFakeBpu:app.config.doFakeBpu,
    doCamera:app.config.doCamera,
  };
 
  var setGroupFlags=function(cb_fn) {
    var compiledSettings={};
    Object.keys(newExp.groupSettings).forEach(function(key) {
      if(key.search('_')===-1) {
        compiledSettings[key]=false;
      }
    });
    //Filter Groups by bpu
    var tempGroups=JSON.parse(JSON.stringify(newExp.usergroups));
    var groups=[];
    tempGroups.forEach(function(tg) {
      app.bpuConfig.allowedGroups.forEach(function(ag) {
        if(tg===ag) {
          groups.push(tg);
        }
      });
    });
    //Set Group permissions
    var didFindOneGroup=false;
    var findNext=function() {
      if(groups.length>0) {
        var grp=groups.shift();
        app.db.models.Group.findOne({name:grp}, 'settings', function(err, data) {
          if(data && data.settings) {
            didFindOneGroup=true;
            keys=Object.keys(data.settings);
            keys.forEach(function(key) {
              if(!compiledSettings[key] && data.settings[key]) {
                compiledSettings[key]=data.settings[key];
              }
            });
          }
          findNext();
        });
      } else {
        if(didFindOneGroup) {
          newExp.groupSettings=compiledSettings;
          cb_fn(null);
        } else {
          cb_fn('groups not recogized');
        }
      }
    };
    if(groups.length>0) {
      findNext();
    } else {
      cb_fn('no groups');
    }
  };

  setGroupFlags(function(err) {
    if(err) {
      callback(err, null);
    } else {
      app.db.models.BpuExperiment.save(newExp, function(err, dat) {
        if(err) {
          callback('setNewExperiment asyncFinally could not save err:'+err, null);
        }
        callback(null, newExp);
      });
    }
  });
};
var asyncFunctionTemplate=function(options, action, callback) {
  mp('running '+options.fName+', timeout in '+options.timeoutInterval);
  var tm=setTimeout(function() {
    var err=options.fName+':'+'timed out';
    mp('\t\t'+options.fName+' finished with err:('+err+')\n');
    callback(err);
  }, options.timeoutInterval);
  action(function(err) {
    if(tm!==null) {
      clearTimeout(tm);
      tm=null;
      mp('\t\t'+options.fName+' finished with err:('+err+')\n');
      callback(err);
    }
  });
};
init();
