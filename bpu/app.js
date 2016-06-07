var async=require('async'); 
var os=require('os'); 
var fs=require('fs'); 
var exec=require('child_process').exec; 
var socketIo=require('socket.io');
var log4js=require('log4js');

var script_initializeBpu=require('./initializeBpu.js');

var app={
  //Basic
  name:'app.js',
  startDate:new Date(),
  
  //Logger 'ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'
  logger:null,
  loggerLevel:'ALL',

  //Other Constant Scripts/Data
  MainConfig:require('../shared/mainConfig.js'),
  BpuAutoLightData:require('../shared/autoUserData.json'),
  BpuTestLightData:require('../shared/testLightUserData.json'),
  myFunctions:require('../shared/myFunctions.js'),

  //Scripts for longer seequences
  script_socketBpu:require('./socketBpu.js'),
  script_resetBpu:require('./resetBpu.js'),
  script_runExperiment:require('./runExperiment.js'),
  script_fakeMongo:require('./fakeMongo.js'),
 
  //Deps needed throughout application 
  async:async,
 
  //Init Flags
  //Init Objects 
  bpu:null,
  bpuConfig:null,
  db:null,
  //Init Info
  mainDataDir:'/home/pi/bpuData',
  expDataDir:'/home/pi/bpuData/tempExpData',
  mountedDataDir:'/mnt/bpuEuglenaData/'+os.hostname(),
  bpuStatusTypes:null,

  //Run Flags
  isFlushing:false,
  isExperimentAdded:false,
  isExperimentOverAndWaitingForPickup:false,
  
  //Run Objects
  exp:null,
  didConfirmRun:false,
  didConfirmTimeoutRun:false,
  //Run Info
  bpuStatus:null,
  bpuStatusError:null,
  
};

//Initialize Logger
app.logger=log4js.getLogger(app.name); 
app.logger.setLevel(app.loggerLevel);

//Initialize Application
//Logger 'ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'
app.logger.warn('application initialization start');
var deps={fs:fs, os:os, exec:exec, socketIo:socketIo};
script_initializeBpu(app, deps, function(err) {
  if(err) {
    app.logger.error('application initialization Error '+' '+err);
  } else {
    app.logger.warn('application initialization end');
    
    //Check for Objects
    var didFail=true; 
    if(app.bpuConfig===null || app.bpuConfig===undefined) {app.logger.error('application initialization no app.bpuConfig');
    } else if(app.bpuStatusTypes===null || app.bpuStatusTypes===undefined) {app.logger.error('application initialization no app.bpuStatusTypes');
    } else if(app.db===null || app.db===undefined) {app.logger.error('application initialization no app.db');
    } else {
      didFail=false;
    }

    //App is ready
    if(didFail) {
      app.logger.error('application initialization Failed');
    } else if(app.bpuStatus!==app.bpuStatusTypes.initializingDone) {
      app.logger.error('status is not app.bpuStatusTypes.initializingDone its '+app.bpuStatus);
    } else {
      app.logger.warn('application initialization Okay');
      //Reset to begin
      var opts={};
      app.logger.debug('application initialization reseting to begin');
      app.script_resetBpu(app, deps, opts, function(err) {
        if(app.bpu===null || app.bpu===undefined) {
          app.logger.error('application initialization reseting issue no app.bpu');
        } else if(err) {
          app.logger.error('application initialization reseting '+err);
        } else {
          console.log(app.bpuConfig);
          app.logger.debug('application initialization READY FOR EXPERIMENT');
        }
      });
    }
  }
});
