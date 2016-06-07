var os=require('os'); 
var async=require('async'); 
var mongoose=require('mongoose');

var BpuTestLightData=require('../shared/autoUserData.json');
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

//mmongo exp id and tar file location, mServer connect to get the list and download data.
// on mserver connect and data ready, pull all files and elete from location and db.

//add prioity queue to main sever for all bpus

var app={};
app.io=null;

app.bpu=require('./bpu2.js');
app.socket=null;
app.db=null;

app.config={
  isDevelopment:true,
  mongoUri:'mongodb://localhost:27017/bpu',
  doInternalBpuCheck:false,
  doSkipAuto:false,
  doFakeLeds:true,
  doFakeScripts:false,
  doFakeBpu:false,
  doCamera:false,
};
if(app.config.isDevelopment) {
  app.config.mongoUri+='-dev';
}
app.isInitialized=false;

app.bpuConfig=null;
app.bpuStatusTypes=null;

app.bpuStatuses={
  initializing:'initializing',
  initializingDone:'initializingDone',
  expRunning:'exp running',
  dataPacking:'data packing',
  dataPackingFailed:'data packing failed',
  dataProcessing: 'data processing',
  dataProcessingFailed:'data processing failed',
  dataReady:'data ready',
};
app.bpu.setBpuStatuses(app.bpuStatuses);
var fn_serverHandler=function(req, res) {
  mp('socket.on fn_serverHandler');
};

var fn_connectionHandler=function() {
  //Emits From Bpu 
  app.socket.myEmits={
    initDone:function(data) {
      app.socket.emit('/mServer/#initDone', data);
    },
    dataComplete:function(data) {
      app.socket.emit('/mServer/#dataComplete', data);
    },
    dataReady:function(data) {
      app.socket.emit('/mServer/#dataReady', data);
    },
  };
  //Responses From Here
  app.socket.myEmitsRes={
    createBpuRes:function(data) {
      app.socket.emit('/mServer/#createBpuRes', data);
    },
    addExpRes:function(data, from) {
      app.socket.emit('/mServer/#addExpRes', data);
    },
    getStatusRes:function(data) {
      app.socket.emit('/mServer/#getStatusRes', data);
    },
    ledsSetRes:function(data) {
      app.socket.emit('/mServer/#ledsSetRes', data);
    },
  };
  
  //Default
  app.socket.on('disconnect', function(data) {
    mp('socket.on disconnect');
    app.socket=null;
  });

  //Rx From Clients
  app.socket.on('createBpu', function(data) {
    var retObj={
      accecpted:false, 
      processingTime:-1, 
      bpuStatus:app.bpu.getStatus(),
      bpuState:app.bpu.getState(),
      err:null,
    };
    if(app.bpu.getState()==='initializing') {
      retObj.err='already initializing';
      app.socket.myEmitsRes.createBpuRes(retObj);
    } else {
      app.bpu.setDoFullStop();
      retObj.processingTime=30000;
      retObj.err='wait for another callback here';
      app.socket.myEmitsRes.createBpuRes(retObj);
    }
  });
  app.socket.on('addExp', function(exp) {
    var retObj={
      accecpted:false, 
      processingTime:-1, 
      bpuStatus:app.bpu.getStatus(),
      bpuState:app.bpu.getState(),
      err:null,
      msg:null,
      mongoAddr:app.bpuConfig.localAddr+':27017',
      _id:null,
    };
    retObj.mongoAddr='localhost:27017';
    if(app.bpu.getState()==='initializing') {
      clearConsole();
      getNewExperiment(exp, function(err, newExp) {
        if(err) {
          retObj.err='getNewExperiment err:'+err;
        } else {
          retObj.accecpted=true;
          retObj.processingTime=newExp.runTime+60000;
          retObj._id=newExp._id;
          app.bpu.runExp(app, newExp, function(err) {
            app.bpu.resetState();
            var retObj={
              accecpted:true, 
              processingTime:-1, 
              bpuStatus:app.bpu.getStatus(),
              bpuState:app.bpu.getState(),
              err:null,
              msg:null,
            };
            if(err) {
              if(err==='did full stop') {
                retObj.msg='did full stop okay';
              } else {
                retObj.err='runExp err:'+err;
                mpErr('runExp err:'+err); 
              }
            } else {
              retObj.msg='got exp callback okay';
            }
            app.socket.myEmitsRes.addExpRes(retObj, 'socket addExp getNewExperiment runExp'); 
          });
        }
        app.socket.myEmitsRes.addExpRes(retObj, 'socket addExp getNewExperiment');
      });
    } else {
      retObj.err='state not initializing';
      app.socket.myEmitsRes.addExpRes(retObj, 'socket addExp');
    }
  });
  app.socket.on('getStatus', function() {
    var retObj={
      accecpted:true, 
      processingTime:-1, 
      bpuStatus:app.bpu.getStatus(),
      bpuState:app.bpu.getState(),
      err:null,
    };
    app.socket.myEmitsRes.getStatusRes(retObj);
  });
  app.socket.on('ledsSet', function(lightData) {
    var retObj={
      accecpted:true, 
      processingTime:-1, 
      bpuStatus:app.bpu.getStatus(),
      bpuState:app.bpu.getState(),
      err:null,
    };
    app.socket.myEmitsRes.ledsSetRes(retObj);
  });
};

var getNewExperiment=function(expSpecs, callback) {
  var newExp=app.db.models.BpuExperiment();
  newExp.expId=expSpecs.expId;
  newExp.username=expSpecs.username;
  newExp.usergroups=expSpecs.usergroups;
  
  if(expSpecs.isLive) {
    newExp.isLive=expSpecs.isLive
  } else if(expSpecs.isArray) {
    newExp.isArray=expSpecs.isArray;
  } else if(expSpecs.isAuto) {
    newExp.isAuto=expSpecs.isAuto;
  }

  var setBpuInfo=function(cb_fn) {
    newExp.bpuInfo={
      nameBpu:app.bpuConfig.name,
    };
    cb_fn(null, 'setBpuInfo ok');
  };
  var setGroupFlags=function(cb_fn) {
    var compiledSettings={};
    Object.keys(newExp._doc.groupSettings).forEach(function(key) {
      if(key.search('_')===-1) {
        compiledSettings[key]=false;
      }
    });
    var groups=JSON.parse(JSON.stringify(expSpecs.usergroups));
    var didFindOneGroup=false;
    var findNext=function() {
      if(groups.length>0) {
        var grp=groups.shift();
        app.db.models.Group.findOne({name:grp}, 'settings', function(err, data) {
          if(data && data.settings) {
            didFindOneGroup=true;
            keys=Object.keys(data._doc.settings);
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
          cb_fn(null, 'setGroupFlags ok');
        } else {
          cb_fn('groups not recogized', null);
        }
      }
    };
    if(groups.length>0) {
      findNext();
    } else {
      cb_fn('no groups', null);
    }
  };

  var setDebugSettings=function(cb_fn) {
    newExp.debugSettings={
      doSkipAuto:app.config.doSkipAuto,
      doFakeLeds:app.config.doFakeLeds,
      doFakeScripts:app.config.doFakeScripts,
      doFakeBpu:app.config.doFakeBpu,
      doCamera:app.config.doCamera,
    };
    cb_fn(null, 'setDebugSettings ok');
  };
  
  var setExperimentInfo=function(cb_fn) {
    app.bpu.checkLightDataArray({eventsToRun:expSpecs.eventsToRun}, function(err, lightData) {
      newExp.eventsToRun=lightData;
      newExp.experimentInfo={
        runTime:lightData[lightData.length-1].time,
        timeLeft:lightData[lightData.length-1].time,
        endRunDate:null,
        collectionDate:null,
      };
      cb_fn(err, 'setExperimentInfo ok');
    });
  };

  var asyncFinally=function(err) {
    if(err) {
      mpErr('getNewExperiment asyncFinally err:', err);
      callback(err, null);
    } else {
      app.isInitialized=true;
      mp('getNewExperiment asyncFinally okay.\n');
      newExp.save(function(err, dat) {
        if(err) {
          mpErr('getNewExperiment asyncFinally could not save err:'+err);
        }
        callback(null, newExp);
      });
    }
  };

  async.parallel([
    setBpuInfo,
    setGroupFlags,
    setDebugSettings,
    setExperimentInfo,
  ], asyncFinally);
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
var init=function() {
  var getConfig=function(callback) {
    var options={
      fName:'getConfig',
      timeoutInterval:5000,
    };
    var action=function(cb_fn) { 
      var netFaces=os.networkInterfaces();
      var err='getConfig not found';
      var thisIP=netFaces.eth0[0].address;
      MainConfig.bpus.forEach(function(item) {
        if(item.localAddr.ip===thisIP) {
          err=null;
          app.bpuConfig=item;
          app.bpuConfig.maxTextFileTime=MainConfig.maxTextFileTime;
          app.bpuConfig.minTextFileTime=MainConfig.minTextFileTime;
          app.bpuStatusTypes=MainConfig.bpuStatusTypes;
        }
      });
      cb_fn(null);
    };
    asyncFunctionTemplate(options, action, function(err) {
      return callback(err);
    });
  };
  var setupDatabase=function(callback) {
    var options={
      fName:'setupDatabase',
      timeoutInterval:5000,
    };
    var action=function(cb_fn) { 
      app.db=mongoose.createConnection(app.config.mongoUri);
      app.db.on('error', function(err) {
        cb_fn(options.fName+':'+'mongoose connection err:'+err);
      });
      app.db.once('open', function () {
        require('./models')(app, mongoose);
        cb_fn(null);
      });
    };
    asyncFunctionTemplate(options, action, function(err) {
      return callback(err);
    });
  };
  
  var internalBpuCheck=function(callback) {
    if(app.config.doInternalBpuCheck) {
      var options={
        fName:'internalBpuCheck',
        timeoutInterval:60000,
      };
      var action=function(cb_fn) {
        var data={
          expId:'internalBpuCheck',
          username:'internalBpuCheck',
          usergroups:['default', 'admin'],
          isArray:true, 
          eventsToRun:JSON.parse(JSON.stringify(BpuTestLightData)),
        };
        getNewExperiment(data, function(err, newExp) {
          if(err) {
            cb_fn('getNewExperiment err:'+err);
          } else {
            app.bpu.internalCheck(app, newExp, function(err) {
              app.bpu.resetState();
              if(err) {
                cb_fn('internalBpuCheck err:'+err); 
              } else {
                cb_fn(null); 
              }
            });
          }
        });
      };
      asyncFunctionTemplate(options, action, function(err) {
        return callback(err);
      });
    } else {
      app.bpu.setStatus(app.bpuStatuses.initializingDone);
      return callback(null); 
    }
  };

  var createServer=function(callback) {
    var options={
      fName:'createServer',
      timeoutInterval:5000,
    };
    var action=function(cb_fn) { 
      var err='createServer failed';
      var server=require('http').createServer(fn_serverHandler);
      mp('\t\tcreateServer addr:'+app.bpuConfig.localAddr.ip+':'+app.bpuConfig.localAddr.serverPort);
      server.listen(app.bpuConfig.localAddr.serverPort, app.bpuConfig.localAddr.ip);
      app.io=require('socket.io')(server);
      app.io.on('connection', function(socket) {
        if(app.socket===null) {
          mp('init connection id:'+socket.id);
          app.socket=socket;
          fn_connectionHandler();
        } else { 
          mpErr('init connection', 'app.bpu alread exists');
        }
      });
      cb_fn(null);
    };
    asyncFunctionTemplate(options, action, function(err) {
      return callback(err);
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
    setupDatabase,
    createServer,
    internalBpuCheck,
  ], asyncFinally);
};
init();

