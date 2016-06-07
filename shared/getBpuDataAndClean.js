var fs=require('fs');
var async=require('async'); 

var myFunctions=require('./myFunctions.js');

var me={};
me.isRunning=false;

exports.getData=function(app, bpuAddr, bpuName, moveBpuDataFolders, callback) {
  console.log(bpuAddr, bpuName, moveBpuDataFolders);
  var bpuDbFolder=moveBpuDataFolders.bpuDbFolder;
  var bpuTarFolder=moveBpuDataFolders.bpuTarFolder;
  var localBpuDbDump=moveBpuDataFolders.localBpuDbDump;
  var localTarDump=moveBpuDataFolders.localTarFolder;
  var pullBpuDbData=function(callback) {
    var options={
      fName:'pullBpuDbData',
      timeoutInterval:10000,
    };
    var action=function(cb_fn) { 
      var src='pi@'+bpuAddr+':'+bpuDbFolder;
      var dest=localBpuDbDump;
      var cmd='scp -r '+src+' '+dest;
      myFunctions.runBashCommand(cmd, function(err, stdout) {
        if(err) {
          cb_fn('getBpuDataAndClean getData pullBpuDbData err:'+err);
        } else {
          cb_fn(null);
        }
      });
    };
    myFunctions.asyncFunctionTemplate(options, action, function(err) {
      return callback(err);
    });
  };
  var pullBpuTarsFromDbData=function(callback) {
    var options={
      fName:'pullBpuTarsFromDbData',
      timeoutInterval:30000,
    };
    var action=function(cb_fn) { 
      fs.readdir(localBpuDbDump+'/readyMongo/', function(err, files) {
        if(err) {
          cb_fn('pullBpuTarsFromDbData readdir'+err);
        } else {
          var bpuPullJson=null;
          var bpuPullFile=null;
          var moveFiles=[];
          files.forEach(function(file) {
            var parts=file.split('.');
            if(parts[parts.length-1].toLowerCase()==='json') {
              var jsonPath=localBpuDbDump+'/readyMongo/'+file;
              var json=require(jsonPath);
              if(json.bpuInfo.nameBpu===bpuName) {
                if(bpuPullJson!==null) {
                  if(Number(json.experimentInfo.endRunDate)>Number(bpuPullJson.experimentInfo.endRunDate)) {
                    moveFiles.push(bpuPullFile);
                    bpuPullJson=json;
                    bpuPullFile=file;
                  } else {
                    moveFiles.push(file);
                  }
                } else {
                  bpuPullJson=json;
                  bpuPullFile=file;
                }
              }
            }
          });
          if(bpuPullJson!==null) {
            myFunctions.moveFiles(localBpuDbDump+'/readyMongo', moveFiles, localBpuDbDump+'/NotFoundOnBpu', function(err) {
              if(err) {
                console.log('getBpuDataAndClean getData pullBpuTarsFromDbData moveFiles err:'+err);
              }
              me.pullTarFromJson(app, bpuAddr, bpuPullJson, bpuPullFile, localBpuDbDump, localTarDump, function(err) {
                if(err) {
                  console.log('getBpuDataAndClean getData pullBpuTarsFromDbData pullTrFromJsons err:'+err);
                }
                cb_fn(null);
              });
            });
          } else {
            cb_fn(null);
          }
        }
      });
    };
    myFunctions.asyncFunctionTemplate(options, action, function(err) {
      return callback(err);
    });
  };

  var asyncFinally=function(err) {
    if(err) {
      console.log('getBpuDataAndClean asyncFinally err:', err);
    } else {
      console.log('getBpuDataAndClean asyncFinally okay.');
    }
    me.isRunning=false;
    callback(err);
  };

  if(me.isRunning) {
    asyncFinally('already running');
  } else {
    async.waterfall([
      pullBpuDbData,
      pullBpuTarsFromDbData,
    ], asyncFinally);
  }
};

var saveUserStats=function(app, json, callback) {
  app.db.models.User.find({username:json.username}, {}, function(err, users) {
    var user=users[0];
    if(err) {
      console.log('pullTrFromJsons saveUserStats User.find err:'+err);
    } else {
      var statObj={
        bpuName:json.bpuInfo.useBpu,
        x:Number(json.experimentInfo.endRunDate),
        y:-1,
      }; 
      statObj.y=-1;
      Object.keys(json.stats).forEach(function(item) {
        if(json.stats[item]!=-1) {
          var num=Number(json.stats[item]);
          if(statObj.y>=0) {
            statObj.y+=num;
          } else {
            statObj.y=num;
          }
        }
      });
      user.autoUserStats.push(statObj);
      user.save(function(err) {
        if(err) {
          console.log('pullTrFromJsons saveUserStats User.save err:'+err);
        }
      });
    }
    app.db.models.BpuExperiment.findById(json.expId, {}, function(err, exp) {
      if(err) {
        console.log('pullTrFromJsons saveUserStats BpuExperiment.findById err:'+err);
      } else {
        exp.stats.population=json.experimentInfo.population;
        exp.stats.activity=json.experimentInfo.activity;
        exp.stats.response=json.experimentInfo.response;
        exp.save(function(err) {
          if(err) {
            console.log('pullTrFromJsons saveUserStats BpuExperiment.save err:'+err);
          }
        });
      }
    });
  });
};
var saveJsonToBpuExperimentSchema=function(app, json, callback) {
  app.db.models.BpuExperiment.findById(json._id, {}, function(err, exp) {
    if(err!==null || exp===null || exp===undefined) {
      callback('could not find exp to save');
    } else {
      json.experimentInfo.isReady=true;
      Object.keys(json).forEach(function(key) {
        if(key.search('_')===-1) {
          exp[key]=json[key];
        }
      });
      exp.save(function(err, dat) {
        if(err) {
          callback('could not save exp to save');
        } else {
          callback(null);
        }
      });
    }
  });
};

me.pullTarFromJson=function(app, addr, json, bpuPullJsonFile, dbDataPath, localTarDump, callback) {
  var saveAndCallback=function(err) {
    if(err) {
      callback('ERROR getBpuDataAndClean pullTrFromJson err:'+err);
    } else {
      saveJsonToBpuExperimentSchema(app, json, function(err) {
        if(err) {
          callback('ERROR getBpuDataAndClean pullTrFromJson saveJsonToBpuExperimentSchema err:'+err);
        } else {
          callback();
        }
      });
    }
  };
  var pullTar=function() {
    var jsonPath=dbDataPath+'/readyMongo'+'/'+bpuPullJsonFile;
    var jsonErrPath=dbDataPath+'/'+'NotFoundOnBpu'+'/';
    var tarpath=json.experimentInfo.dataPath;
    var cpyCmd='scp pi@'+addr+':'+tarpath+' '+localTarDump;
    myFunctions.runBashCommand(cpyCmd, function(err, stdout) {
      if(err) {
        var mvCmd='mv '+jsonPath+' '+jsonErrPath;
        myFunctions.runBashCommand(mvCmd, function(err, stdout) {
          if(err) {
            saveAndCallback('cpy err move failed err:'+err);
          } else {
            saveAndCallback(null);
          }
        });
      } else {
        var mvCmd='mv '+jsonPath+' '+localTarDump;
        myFunctions.runBashCommand(mvCmd, function(err, stdout) {
          if(err) {
            saveAndCallback('cpy move '+err);
          } else {
            saveAndCallback(null);
          }
        });
      }
    });
  };
    
  if(json.username==='scripterResponse' || json.username==='scripterPopulation' || 
    json.username==='scripterActivity' || json.username==='scripterAll') {
    saveUserStats(app, json, function() {
      pullTar();
    });
  } else {
    pullTar();
  }
};
me.pullTarFromJsons2=function(app, addr, jsonFiles, dbDataPath, localTarDump, callback) {
  var next=function() {
    if(jsonFiles.length>0) {
      var fl=jsonFiles.shift();
      var jsonPath=dbDataPath+'/readyMongo/'+fl;
      var json=require(jsonPath);
   
      var saveAndNext=function() {
        saveJsonToBpuExperimentSchema(app, json, function(err) {
          console.log('ERROR getBpuDataAndClean pullTrFromJson saveJsonToBpuExperimentSchema err', err);
          next();
        });
      };

      var finish=function() {
        var tarpath=json.experimentInfo.dataPath;
        var cpyCmd='scp pi@'+addr+':'+tarpath+' '+localTarDump;
        myFunctions.runBashCommand(cpyCmd, function(err, stdout) {
          if(err) {
            var mvCmd='mv '+jsonPath+' '+dbDataPath+'/'+'NotFoundOnBpu'+'/';
            myFunctions.runBashCommand(mvCmd, function(err, stdout) {
              if(err) {
                console.log('ERROR getBpuDataAndClean pullTrFromJson move failed err', err);
                saveAndNext();
              } else {
                saveAndNext();
              }
            });
          } else {
            var mvCmd='mv '+jsonPath+' '+localTarDump;
            myFunctions.runBashCommand(mvCmd, function(err, stdout) {
              if(err) {
                console.log('ERROR getBpuDataAndClean pullTrFromJson copy tar err', err);
                saveAndNext();
              } else {
                saveAndNext();
              }
            });
          }
        });
      };
    
      if(json.username==='scripterResponse' || json.username==='scripterPopulation' || 
        json.username==='scripterActivity' || json.username==='scripterAll') {
        saveUserStats(app, json, function() {
          finish();
        });
      } else {
        finish();
      }
    } else {
      callback(null);
    }
  };
  next();
};
