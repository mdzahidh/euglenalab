exports=module.exports=function(app, deps, mainCallback) {
  var moduleName='initializeBpu.js';
  
  //Assert Deps 
  if(app===null) {mainCallback('need app object');
  
  } else if(app.mainConfig===null) {mainCallback('need app.mainConfig object');
  
  } else if(app.script_socketBpu===null) {mainCallback('need app.script_socketBpu object');
  } else if(app.script_fakeMongo===null) {mainCallback('need app.script_fakeMongo object');
  } else if(app.script_resetBpu===null) {mainCallback('need app.script_resetBpu object');
  } else if(app.script_runExperiment===null) {mainCallback('need app.script_runExperiment object');
  
  } else if(app.async===null) {mainCallback('need app.async module');

  } else if(deps.exec===null) {mainCallback('need exec module');
  } else if(deps.socketIo===null) {mainCallback('need socketIo module');
  } else if(deps.fs===null) {mainCallback('need fs module');
  } else if(deps.os===null) {mainCallback('need os object');
  
  } else {
    
    var num=0;
    
    //Get Bpu Config From Main Config
    //Get Bpu Config From Main Config
    //Get Bpu Config From Main Config
    var getConfig=function(callback) {
      num++;
      var fName=num+' getConfig';
      app.logger.debug(moduleName+' '+fName+' '+'start');
      //Find bpu config by ip
      var thisIP=deps.os.networkInterfaces().eth0[0].address;
      for(var ind=0;ind<app.MainConfig.bpus.length;ind++) {
        if(app.MainConfig.bpus[ind].localAddr.ip===thisIP) {
          app.bpuStatusTypes=app.MainConfig.bpuStatusTypes;
          app.bpuStatus=app.bpuStatusTypes.initializing;
          app.bpuConfig=app.MainConfig.bpus[ind];
          app.socketStrs=app.MainConfig.socketStrs;
          app.logger.trace(moduleName+' '+fName+' '+app.MainConfig.bpus[ind].name+', '+app.MainConfig.bpus[ind].localAddr.ip+' FOUND');
          break;
        } else {
          app.logger.trace(moduleName+' '+fName+' '+app.MainConfig.bpus[ind].name+', '+app.MainConfig.bpus[ind].localAddr.ip);
        }
      } 
      //Finish
      if(app.bpuConfig===null || app.bpuConfig===undefined) {
        return callback(fName+':no bpu config found for ip '+thisIP);
      } else {
        return callback(null);
      }
    };

    //Create Socket Server
    //Create Socket Server
    //Create Socket Server
    var createSocket=function(callback) {
      num++;
      var fName=num+' createSocket';
      var opts={};
      app.logger.debug(moduleName+' '+fName+' '+'start');
      app.script_socketBpu(app, deps, opts, function(err) {
        if(err) {
          app.logger.error(fName+' script_socketBpu callback:'+err);
          return callback(err);
        } else {
          return callback(null);
        }
      });
    };
   
    //Build Fake Mongo
    //Build Fake Mongo
    //Build Fake Mongo
    var buildFakeMongo=function(callback) {
      num++;
      var fName=num+' buildFakeMongo';
      var opts={
        savePath:app.expDataDir,
      };
      app.logger.debug(moduleName+' '+fName+' '+'start');
      app.script_fakeMongo(app, deps, opts, function(err, fakeMongoDb) {
        if(err) {
          app.logger.error(fName+' script_socketBpu callback:'+err);
          return callback(err);
        } else {
          app.db=fakeMongoDb;
          return callback(null);
        }
      });
    };

    //Build Series
    var funcs=[];
    funcs.push(getConfig);
    funcs.push(createSocket);
    funcs.push(buildFakeMongo);
    
    //Start Series 
    var startDate=new Date();
    app.logger.info(moduleName+' start');
    app.async.series(funcs, function(err) {
      app.logger.info(moduleName+' end in '+(new Date()-startDate)+' ms');
      if(err) {
        app.bpuStatus='initializingFailed';
        mainCallback(err);
      } else {
        app.bpuStatus=app.bpuStatusTypes.initializingDone;
        mainCallback(null);
      }
    }); 
  }
};
