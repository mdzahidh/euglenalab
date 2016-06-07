//Deps
var os=require('os');
var async=require('async');
var exec=require('child_process').exec;
//Constants
var _ToggleOn='start';
var _ToggleOff='stop';
var _ScriptName='checkImageStreamer';
//Arguments
var _saveImageIntervalMs=5000;
var _saveImageFolder='/bpuData/tempExpData';
var _moveExpDataFolder='/mnt/bpuEuglenaData/'+os.hostname();
var _lightDataFilename='lightdata.json';
//Run Flags
var _doSkipImageSave=true;
var _doSkipMoveExpData=false;

//General Functions
var runBashCommand=function(cmdStr, callback) {
  var child=exec(cmdStr, function (error, stdout, stderr) {
    if(error!==null) {callback('error: ' + stderr, stdout);
    } else if(stderr) {callback('stderr: ' + stderr, stdout);
    } else if(stdout) {callback(null, stdout);
    } else {callback(null, null);}
  });
};

//Camera functions
var toggleWebCamSave=function(startStop, cb_fn) {
  if(startStop==='stop' || startStop==='start') {
    var net=require('net');
    var client=new net.Socket();
    client.connect(32000, 'localhost', function() {
      client.write(startStop);
      cb_fn(null);
    });
    client.on('error', function(err) {
      cb_fn(err);
    });
  } else {
    cb_fn("1st param needs to be 'start' or 'stop'");
  }
};

//Async Series Functions
var outcome={expDataName:null,};
var runWebCam=function(callback) {
  var startDate=new Date();
  var funcName='runWebCam';
  var timeoutMs=this.timeoutMs || 60000;
  toggleWebCamSave(_ToggleOn, function(err) {
    if(err) {
      err=funcName+' '+_ToggleOn+' '+err;
      console.log(err);
      callback(err);
    } else {
      console.log(funcName+' '+_ToggleOn+' for '+timeoutMs+' ms.');
      setTimeout(function() {
        toggleWebCamSave(_ToggleOff, function(err) {
          if(err) {
            err=funcName+' '+_ToggleOff+' '+err;
            console.log(err);
            callback(err);
          } else {
            console.log(funcName+' '+_ToggleOff+' in '+(new Date()-startDate)+' ms.');
            callback(null);
          }
        });
      }, timeoutMs);
    }
  });
};
var readLightDataJsonToGetExpDataName=function(callback) {
  var startDate=new Date();
  var funcName='moveExpData';
  var saveImageFolder=this.imageFolder || '/bpuData/tempExpData';
  var lightDataFilename=this.lightDataFilename || 'lightdata.json';
  var catchErr=null;
  var expDataName=os.hostname()+'_nowTime_'+(new Date().getTime()); //default name
  try {

    //Require Light data file to get experiment info
    var lightDataJson=require(saveImageFolder+'/'+lightDataFilename);
    
    //find meta data
    if(lightDataJson.metaData!==null && lightDataJson.metaData!==undefined) {
      if(lightDataJson.metaData.expId!==null && lightDataJson.metaData.expId!==undefined) {
        if(lightDataJson.metaData.expId!=='') {
          expDataName=lightDataJson.metaData.expId;
        }
      }
    
    //Check through light events for timestamp to use 
    } else {
      //object with array
      if(lightDataJson.eventsToRun!==null && lightDataJson.eventsToRun!==undefined) {
        if(typeof lightDataJson.eventsToRun.forEach==='function' && lightDataJson.eventsToRun.length>0) {
          if(lightDataJson.eventsToRun[0].time!==null && lightDataJson.eventsToRun[0].time!==undefined) {
            lightDataJson.eventsToRun.sort(function(objA, objB) {return objA.time-objB.time;});
            expDataName=os.hostname()+'_firstObjEvent_'+lightDataJson.eventsToRun[0].time;
          }
        }

      //object is array
      } else {
        if(typeof lightDataJson.forEach==='function' && lightDataJson.length>0) {
          if(lightDataJson[0].time!==null && lightDataJson[0].time!==undefined) {
            lightDataJson.sort(function(objA, objB) {return objA.time-objB.time;});
            expDataName=os.hostname()+'_firstArrEvent_'+lightDataJson[0].time;
          }
        }
      }
    }
  } catch(err) {
    catchErr=err;
  } finally {
    if(catchErr) {
      callback(funcName+' catchErr:'+catchErr);
    } else {
      outcome.expDataName=expDataName;
      callback();
    }
  }
};
var moveExpData=function(callback) {
  var startDate=new Date();
  var funcName='moveExpData';
  var saveImageFolder=this.imageFolder || '/bpuData/tempExpData';
  var moveExpDataFolder=this.moveExpDataFolder || '/mnt/bpuEuglenaData/'+os.hostname();
  var finalPath=moveExpDataFolder+'/'+outcome.expDataName;
  console.log(saveImageFolder, moveExpDataFolder, finalPath);
  var mkdirCmd='mkdir '+finalPath;
  var moveCmd='cp '+saveImageFolder+'/'+'*'+' '+finalPath;
  var cmdStr=mkdirCmd+' && '+moveCmd; 
  console.log(cmdStr);
  runBashCommand(cmdStr, function(err) {
    if(err) {
      err=funcName+' '+err;
      console.log(err);
      callback(err);
    } else {
      console.log(funcName+' in '+(new Date()-startDate)+' ms.');
      callback(funcName+' deving');
    }
  });
};

//Series Funcs
var funcs=[];
if(!_doSkipImageSave) funcs.push(runWebCam.bind({timeoutMs:_saveImageIntervalMs}));
if(!_doSkipMoveExpData) {
  funcs.push(readLightDataJsonToGetExpDataName.bind({saveImageFolder:_saveImageFolder, lightDataFilename:_lightDataFilename}));
  funcs.push(moveExpData.bind({saveImageFolder:_saveImageFolder, moveExpDataFolder:_moveExpDataFolder}));
}
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
