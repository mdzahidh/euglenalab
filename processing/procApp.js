'use strict';
//module dependencies
var fs=require('fs');
var async=require('async');
var mongoose=require('mongoose');
var log4js=require('log4js');
//my dependencies
var config=require('./config');
var generalFuncs=require('../genFuncs/general.js');
//create bpu controller app
var app={};
app.log4js=log4js;
app.config=config;
app.get=function(thing) {return 'dev';};
app.LOGGER_LEVELS=['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'];
//Model Loggers
app.bpuLogLevel=app.LOGGER_LEVELS[4];
app.bpuExpLogLevel=app.LOGGER_LEVELS[4];
app.userLogLevel=app.LOGGER_LEVELS[4];
app.listExpLogLevel=app.LOGGER_LEVELS[4];
//This Logger
app.logger=log4js.getLogger('app.js');
app.logger.setLevel('INFO');
app.logger.info('Initializing processingExps');

//Run Parameters
app.runps={
  doClearConsole:false,
  //Run Loop
  doRunOneLoop:false,
  loopCallbackInterval:5000,
  loopInterval:20,
  //Exp Query
  expDaysAgoIdDateCheck:5,
  expPullStatus:'servercleared',
  expPullLimit:3,
  expProcAttemptMax:3,
  //Other
  minJpgsForMovie:20,
  //Dir
  bpuDataMountDir:'/home/mserver/bpuEuglenaData_forMounting',
  finalBpuDataDir:'/home/mserver/finalBpuData',
  symlinkDataDir:'./server/public/media/finalBpuDataLinks',
  //Scripts
  moiveScript:'./euglenamovie -i', //./euglenamovie -i <path-to-the-image folder> -o /some/other/folder/movie.mp4
  procMovieScript:'./euglena -i', //./euglena -i <path-to-the-movie folder> -tv
  procMovieScript2:'./tracks.sh',
};

//setup mongoose
app.logger.info('Initializing mongo to '+config.mongodb.uri);
app.db=mongoose.createConnection(config.mongodb.uri);
app.db.on('error', function(err) {
  app.logger.error('app.db.on mongoose.createConnection error:'+err);
});
app.db.once('open', function () {
  app.logger.info('app.server.listen app.db.once on '+config.mongodb.uri+'\n');
  //config data models
  app.logger.info('models loading');
  require('./mongoModels')(app, mongoose, function(){
    app.logger.info('models loaded'+'\n');
    _startLoop();
  });
});

//Run Series
var _startLoop=function() {
  app.logger.warn('startLoop'+'\n\n');
  var isLoopRunning=false;
  var loopCounter=0;
  var newTime=new Date();
  var lastTime=new Date();
  var dt=0;
  var totalTime=app.runps.loopCallbackInterval-app.runps.loopInterval+1;
  var loopErrors=[];
  //quick reset for loop
  var resetLoop=function(err, startRun) {
    var runDt=new Date()-startRun;
    isLoopRunning=false;
    totalTime=runDt;
    lastTime=new Date();
    if(err) {
      app.logger.warn('loop end in '+runDt+' ms'+'\n');
      app.logger.error('loop end error:'+err+'\n');
      loopErrors.push({time:lastTime, err:err});
    } else {
      app.logger.warn('loop end in '+runDt+' ms'+'\n');
    }
  };
  var runLoopInterval=setInterval(function() {
    newTime=new Date();
    dt=(newTime-lastTime);
    totalTime+=dt;
    if(!isLoopRunning) {
      if(app.runps.doRunOneLoop && loopCounter>0) {
        clearInterval(runLoopInterval);
        app.logger.warn('loop over.  doRunOneLoop');
      } else {
        if(totalTime>app.runps.loopCallbackInterval) {
          if(app.runps.doClearConsole) generalFuncs.clearConsole();
          isLoopRunning=true;
          loopCounter++;
          var startRun=new Date();
          app.logger.warn(newTime+' loop start after '+totalTime+' ms.'+' loopErrors:'+loopErrors.length);

          //Get Exp Docs to Process
          init_getBpuExpClearedByServer(function(err, expDocs) {
            if(err) {
              resetLoop('init_getBpuExpClearedByServer '+err, startRun);
            } else {

              //Process Docs
              runSeries(expDocs, function(err, runOutcome) {
                if(err) {
                  resetLoop('runSeries '+err, startRun);
                } else {
                  resetLoop(null, startRun);
                }
              });                             //runSeries
            }
          });                               //init_getBpuExpClearedByServer
        } else {lastTime=new Date();}     //totalTime>app.runps.loopCallbackInterval
      }                                 //doRunOneLoop && loopCounter>1
    } else {lastTime=new Date();}     //!isLoopRunning
  }, 20);
};

//Initial Check For Experiments To Process
var init_getBpuExpClearedByServer=function(callback) {
  var outcome=this;
  var fName='0'+'. init_getBpuExpClearedByServer';
  app.logger.info(fName+' start');

  var oneId='574608c0cb94cc6972d2b2b4';
  oneId=null;

  //Single Action
  var greaterThanDate=new Date(new Date().getTime()-app.runps.expDaysAgoIdDateCheck*(24*60*60*1000)).getTime();
  var lessThanDate=new Date();
  var queryObj={
    _id:{$gt:generalFuncs.getMongoObjectIdFromTimestamp(greaterThanDate), $lt:generalFuncs.getMongoObjectIdFromTimestamp(lessThanDate)},
    proc_doNotProcess:{$ne:true},
    exp_status:app.runps.expPullStatus,
    proc_attempts:{$lte:app.runps.expProcAttemptMax},
    proc_endPath:{$eq:null},
  };
  if(oneId!==null) queryObj._id=oneId;
  var selectObj={
    proc_doNotProcess:1,
    proc_attempts:1,
    proc_err:1,

    proc_startPath:1,

    proc_jpgFiles:1,

    proc_lightDataArrayPath:1,
    proc_endPath:1,

    exp_lastResort:1,
    exp_status:1,

    //For scripters
    user:1,

    //Stuff to set from bpu json schema
    exp_eventsRan:1

  };
  app.db.models.BpuExperiment.find(queryObj).limit(app.runps.expPullLimit).select(selectObj).exec(function(err, expDocs) {
    if(err) {
      err='BpuExperiment.find.'+err;
    } else if(expDocs===null || expDocs===undefined) {
      err='BpuExperiment.find.'+'expDocs dne';
    } else if(expDocs.length===0) {
      err='BpuExperiment.find.'+'no expDocs to process';
    } else {
      if(false) {
        expDocs.forEach(function(doc) {
          doc.proc_doNotProcess=true;
          doc.save(function(err, saveDoc){
            console.log(err, saveDoc.proc_doNotProcess);
          });
        });
        expDocs=[];
      }
      if(expDocs.length>0) {
        app.logger.info(fName+' end expDocs found:'+expDocs.length+' zero id:'+expDocs[0]._id);
      }
    }
    callback(err, expDocs);
  });
};

//Run Series
//Run Series
//Run Series
var runSeries=function(expDocs, callback) {
  app.logger.info('runSeries');
  //Series Data
  var outcome={funcsRan:[], expDocs:expDocs};
  //Series funcs
  var seriesFuncs=[];
  seriesFuncs.push(p_findExpDocIdsInBpuFolders.bind(outcome));      //add bpu data paths to exp docs
  seriesFuncs.push(p_gatherExpDocMountedData.bind(outcome));        //organize bpu data in to exp docs

  //seriesFuncs.push(p_checkSoap.bind(outcome));                      //check soap and remove from processing sequence

  seriesFuncs.push(p_makeMovies.bind(outcome));                     //make movie from jpgs in bpu data and save path to exp docs
  seriesFuncs.push(p_processMovies.bind(outcome));                  //make movie from jpgs in bpu data and save path to exp docs
  seriesFuncs.push(p_checkScripter.bind(outcome));                  //checks if scripter user and start processing
  seriesFuncs.push(p_rmJpgsAndMvToFinal.bind(outcome));             //make movie from jpgs in bpu data and save path to exp docs
  //Series Start
  async.series(seriesFuncs, function(err) {
    //Series End
    if(err) {
      app.logger.error('async.series ERROR:'+err);
      callback('async.series ERROR:'+err, outcome);
    } else {
      callback(null, outcome);
    }
  });
};
//Series Funcs for Cleared Experiments
var p_findExpDocIdsInBpuFolders=function(callback) {
  var outcome=this;
  var fRun={
    startTime:new Date().getTime(), endTime:null,
    index:outcome.funcsRan.length+1, name:(outcome.funcsRan.length+1)+'. p_findExpDocsPerBpusFolder',
    err:null,
    acts:0, actsOkay:0, actErrs:[],
  };

  //Parallel Action
  var statFile=function(cb_fn) {
    var expDoc=this;
    //Check for Bpu name
    var stopErr=null;
    if(expDoc.exp_lastResort===null || expDoc.exp_lastResort===null) {
     stopErr='exp_lastResort dne';
    } else if(expDoc.exp_lastResort.bpuName===null || expDoc.exp_lastResort.bpuName===null) {
     stopErr='exp_lastResort.bpuName dne';
    }
    if(stopErr) {
      //Save updates to exp doc
      expDoc.proc_attempts++;
      expDoc.proc_err=stopErr;
      expDoc.save(function(err, saveDoc) {
        if(err) {
          app.logger.error(fRun.name+' stopErr expDoc.save '+err);
        } else {
          expDoc=saveDoc;
        }
        return cb_fn(null);
      });
    } else {
      //Split and Add dash to bpu name eug-## to find mounted folder for bpu
      var bpuName=expDoc.exp_lastResort.bpuName.substr(0, 3)+'-'+expDoc.exp_lastResort.bpuName.substr(3, expDoc.exp_lastResort.bpuName.length-3);

      expDoc.proc_attempts++;
      expDoc.proc_err=null;

      //reset processing info
      expDoc.proc_startPath=app.runps.bpuDataMountDir+'/'+bpuName+'/'+expDoc._id;
      expDoc.proc_jpgFiles=[];
      expDoc.proc_lightDataArrayPath=null;
      expDoc.proc_endPath=null;
      expDoc.exp_processingStartTime=new Date().getTime();
      //See if expdoc exists in mounted data folder
      fs.stat(expDoc.proc_startPath, function(err, stat) {
        if(err) {
          expDoc.proc_err=fRun.name+' fs.stat '+err+' #'+expDoc.proc_attempts;
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        } else if(stat===null || stat===undefined) {
          expDoc.proc_err=fRun.name+' fs.stat '+'bpuFolders dne #'+expDoc.proc_attempts;
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        }
        //Save updates to exp doc
        expDoc.save(function(err, saveDoc) {
          if(err) {
            app.logger.error(fRun.name+' expDoc.save '+err);
          } else {
            fRun.actsOkay++;
            expDoc=saveDoc;
          }
          return cb_fn(null);
        });
      });
    }
  };

  //Parallel Data - mouted exp path is save in exp doc
  //Parallel funcs
  var parallelFuncs=[];
  outcome.expDocs.forEach(function(expDoc) {
    parallelFuncs.push(statFile.bind(expDoc));
  });
  //Parallel Start
  fRun.acts=parallelFuncs.length;
  app.logger.info(fRun.name+' start on '+fRun.acts+' actions');
  async.parallel(parallelFuncs, function(err) {
    //Parallel End
    app.logger.info(fRun.name+' end with '+fRun.actErrs.length+' action errors');
    fRun.actErrs.forEach(function(errObj) {
      app.logger.error(errObj.err);
    });
    if(err) {
      fRun.err=fRun.name+' async.parallel '+err;
    } else if(fRun.actsOkay===0) {
      fRun.err=fRun.name+' async.parallel(force) '+'no actions finished okay';
    }
    fRun.endTime=new Date().getTime();
    outcome.funcsRan.push(fRun);
    return callback(fRun.err);
  });
};
var p_gatherExpDocMountedData=function(callback) {
  var outcome=this;
  var fRun={
    startTime:new Date().getTime(), endTime:null,
    index:outcome.funcsRan.length+1, name:(outcome.funcsRan.length+1)+'. p_gatherExpDocMountedData',
    err:null,
    acts:0, actsOkay:0, actErrs:[],
  };

  //Parallel Action
  var checkFolder=function(cb_fn) {
    var expDoc=this;
    fs.readdir(expDoc.proc_startPath, function(err, expDataFiles) {
      if(err) {
        err=fRun.name+' '+expDoc._id+' fs.readdir.'+err;
        fRun.actErrs.push({expDocID:expDoc._id, err:err});
      } else if(expDataFiles===null || expDataFiles===undefined) {
        err=fRun.name+' '+expDoc._id+' fs.readdir.'+'expDataFiles dne';
        fRun.actErrs.push({expDocID:expDoc._id, err:err});
      } else {
        var filesByType={jpg:[], cnf:[], json:[], other:[]};
        expDataFiles.forEach(function(filename) {
          var parts=filename.split('.');
          if(parts.length>=2) {
            var types=Object.keys(filesByType);
            for(var ind=0;ind<types.length;ind++) {
              var type=types[ind];
              if(parts[parts.length-1].toLowerCase()===type) {
                filesByType[type].push(expDoc.proc_startPath+'/'+filename);
                //Store Special Single file types
                if(type==='cnf' && parts[0]==='cameraConfigOutFile')      {
                } else if(type==='json') {
                  if(parts[0]===''+expDoc._id) {
                    expDoc.proc_expSchemaJsonPath=expDoc.proc_startPath+'/'+filename;
                  } else if(parts[0]==='lightdata') {
                    expDoc.proc_lightDataArrayPath=expDoc.proc_startPath+'/'+filename;
                  } else if(parts[0]==='lightdata_meta') {
                  }
                } else if(type==='jpg') {
                  expDoc.proc_jpgFiles.push(filename);
                }
                //stop since found
                break;
              } else if(ind===types.length-1) {
                filesByType.other.push(filename);
              }
            }
          } else {
            filesByType.other.push(filename);
          }
        });
        //Check for Errors
        if(expDoc.proc_jpgFiles.length<=app.runps.minJpgsForMovie) {
          expDoc.proc_err=fRun.name+' '+expDoc._id+' not enought jpg in proc_startPath.';
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        } else if(expDoc.lightDataArrayPath===null) {
          expDoc.proc_err=fRun.name+' '+expDoc._id+' no lightdata found in proc_startPath.';
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        }
        //Update expdoc with schema json from bpu
        var finallyErr=null;
        var schemaJson=null;
        try {
          schemaJson=require(expDoc.proc_expSchemaJsonPath);
        } catch(catchErr) {
          finallyErr=catchErr;
        } finally {
          if(finallyErr && schemaJson!==null) {
            expDoc.proc_err='could not require json shcmea '+expDoc.proc_expSchemaJsonPath+' err:'+finallyErr;
            return cb_fn(null);
          } else {

            expDoc.exp_eventsRan=schemaJson.exp_eventsRan;
            expDoc.exp_runStartTime=new Date(schemaJson.exp_runStartTime).getTime();
            expDoc.exp_runEndTime=new Date(schemaJson.exp_runEndTime).getTime();
            expDoc.exp_resortTime=new Date(schemaJson.exp_resortTime).getTime();
            expDoc.exp_submissionTime=new Date(schemaJson.exp_submissionTime).getTime();
            expDoc.exp_creationTime=new Date(schemaJson.exp_creationTime).getTime();
            expDoc.exp_metaData=schemaJson.exp_metaData;
            expDoc.exp_metaData['numFrames'] = expDoc.proc_jpgFiles.length;

              //Save updates to exp doc
            expDoc.save(function(err, saveDoc) {
              if(err) {
                app.logger.error(fRun.name+' expDoc.save '+err);
              } else {
                fRun.actsOkay++;
                expDoc=saveDoc;
              }
              return cb_fn(null);
            });
          }
        }
      }
    });
  };
  //Parallel Data - mouted exp path is save in exp doc
  //Parallel funcs
  var parallelFuncs=[];
  outcome.expDocs.forEach(function(expDoc) {
    if(expDoc.proc_err===null) {
      parallelFuncs.push(checkFolder.bind(expDoc));
    }
  });
  //Parallel Start
  fRun.acts=parallelFuncs.length;
  app.logger.info(fRun.name+' start on '+fRun.acts+' actions');
  async.parallel(parallelFuncs, function(err) {
    //Parallel End
    app.logger.info(fRun.name+' end with '+fRun.actErrs.length+' action errors');
    fRun.actErrs.forEach(function(errObj) {
      app.logger.debug(errObj.err);
    });
    if(err) {
      fRun.err=fRun.name+' async.parallel '+err;
    } else if(fRun.actsOkay===0) {
      fRun.err=fRun.name+' async.parallel(force) '+'no actions finished okay';
    }
    fRun.endTime=new Date().getTime();
    outcome.funcsRan.push(fRun);
    return callback(fRun.err);
  });
};

var p_checkSoap=function(callback) {
  console.log('p_checkSoap');
  var outcome=this;
  var fRun={
    startTime:new Date().getTime(), endTime:null,
    index:outcome.funcsRan.length+1, name:(outcome.funcsRan.length+1)+'. p_checkSoap',
    err:null,
    acts:0, actsOkay:0, actErrs:[],
  };

  //Parallel Action
  var tarAndBinSoap=function(cb_fn) {
    var expDoc=this;
    console.log(expDoc);
    if(false) {
    var cmdStr=app.runps.moiveScript+' '+expDoc.proc_startPath;
    generalFuncs.runBashCommand(cmdStr, function(err, stdout) {
      //See if movie.mp4 exists in path
      fs.stat(expDoc.proc_startPath+'/'+'movie.mp4', function(err, stat) {
        if(err) {
          expDoc.proc_err=fRun.name+' fs.stat movie.mp4 '+err;
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        } else if(stat===null || stat===undefined) {
          expDoc.proc_err=fRun.name+' fs.stat movie.mp4 '+'stat dne';
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        }
        //Save updates to exp doc
        expDoc.save(function(err, saveDoc) {
          if(err) {
            app.logger.error(fRun.name+' expDoc.save '+err);
          } else {
            fRun.actsOkay++;
            expDoc=saveDoc;
          }
          return cb_fn(null);
        });
      });
    });
    }
  };
  //Parallel Data - mouted exp path is save in exp doc
  //Parallel funcs
  var parallelFuncs=[];
  for(var ind=0;ind<outcome.expDocs.length;ind++) {
    console.log(outcome.expDocs[ind]);
    console.log(outcome.expDocs[ind]._id, outcome.expDocs[ind].exp_metaData);
    if(outcome.expDocs[ind].exp_metaData.soapID!==null && outcome.expDocs[ind].exp_metaData.soapID!==null) {
      parallelFuncs.push(tarAndBinSoap.bind(outcome.expDocs.splice(ind, 1)));
      ind--;
    }
  }
  //Parallel Start
  fRun.acts=parallelFuncs.length;
  app.logger.info(fRun.name+' start on '+fRun.acts+' actions');
  async.parallel(parallelFuncs, function(err) {
    //Parallel End
    app.logger.info(fRun.name+' end with '+fRun.actErrs.length+' action errors');
    fRun.actErrs.forEach(function(errObj) {
      app.logger.debug(errObj.err);
    });
    if(err) {
      fRun.err=fRun.name+' async.parallel '+err;
    } else if(fRun.actsOkay===0) {
      fRun.err=fRun.name+' async.parallel(force) '+'no actions finished okay';
    }
    fRun.endTime=new Date().getTime();
    outcome.funcsRan.push(fRun);
    //return callback(fRun.err);
  });
};


var p_makeMovies=function(callback) {
  var outcome=this;
  var fRun={
    startTime:new Date().getTime(), endTime:null,
    index:outcome.funcsRan.length+1, name:(outcome.funcsRan.length+1)+'. p_makeMovies',
    err:null,
    acts:0, actsOkay:0, actErrs:[],
  };

  //Parallel Action
  var makeMovie=function(cb_fn) {
    var expDoc=this;
    var cmdStr=app.runps.moiveScript+' '+expDoc.proc_startPath;
    generalFuncs.runBashCommand(cmdStr, function(err, stdout) {
      //See if movie.mp4 exists in path
      fs.stat(expDoc.proc_startPath+'/'+'movie.mp4', function(err, stat) {
        if(err) {
          expDoc.proc_err=fRun.name+' fs.stat movie.mp4 '+err;
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        } else if(stat===null || stat===undefined) {
          expDoc.proc_err=fRun.name+' fs.stat movie.mp4 '+'stat dne';
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        }
        //Save updates to exp doc
        expDoc.save(function(err, saveDoc) {
          if(err) {
            app.logger.error(fRun.name+' expDoc.save '+err);
          } else {
            fRun.actsOkay++;
            expDoc=saveDoc;
          }
          return cb_fn(null);
        });
      });
    });
  };
  //Parallel Data - mouted exp path is save in exp doc
  //Parallel funcs
  var parallelFuncs=[];
  outcome.expDocs.forEach(function(expDoc) {
    if(expDoc.proc_err===null) {
      parallelFuncs.push(makeMovie.bind(expDoc));
    }
  });
  //Parallel Start
  fRun.acts=parallelFuncs.length;
  app.logger.info(fRun.name+' start on '+fRun.acts+' actions');
  async.parallel(parallelFuncs, function(err) {
    //Parallel End
    app.logger.info(fRun.name+' end with '+fRun.actErrs.length+' action errors');
    fRun.actErrs.forEach(function(errObj) {
      app.logger.debug(errObj.err);
    });
    if(err) {
      fRun.err=fRun.name+' async.parallel '+err;
    } else if(fRun.actsOkay===0) {
      fRun.err=fRun.name+' async.parallel(force) '+'no actions finished okay';
    }
    fRun.endTime=new Date().getTime();
    outcome.funcsRan.push(fRun);
    return callback(fRun.err);
  });
};

var p_processMovies=function(callback) {
  var outcome=this;
  var fRun={
    startTime:new Date().getTime(), endTime:null,
    index:outcome.funcsRan.length+1, name:(outcome.funcsRan.length+1)+'. p_processMovies',
    err:null,
    acts:0, actsOkay:0, actErrs:[],
  };

  //Parallel Action
  var processMovie=function(cb_fn) {
    var expDoc=this;
    //var cmdStr=app.runps.procMovieScript+' '+expDoc.proc_startPath+' -tv';
    var cmdStr=app.runps.procMovieScript2+' '+expDoc.proc_startPath;
    generalFuncs.runBashCommand(cmdStr, function(err, stdout) {
      //See if tracks mp4 exists in path
      fs.stat(expDoc.proc_startPath+'/'+'tracks_thresholded_10.mp4', function(err, stat) {
        if(err) {
          expDoc.proc_err=fRun.name+' fs.stat tracks_thresholded_10.mp4 '+err;
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        } else if(stat===null || stat===undefined) {
          expDoc.proc_err=fRun.name+' fs.stat tracks_thresholded_10.mp4 '+'stat dne';
          fRun.actErrs.push({expDocID:expDoc._id, err:''+expDoc.proc_err});
        }
        //Save updates to exp doc
        expDoc.save(function(err, saveDoc) {
          if(err) {
            app.logger.error(fRun.name+' expDoc.save '+err);
          } else {
            fRun.actsOkay++;
            expDoc=saveDoc;
          }
          return cb_fn(null);
        });
      });
    });
  };
  //Parallel Data - mouted exp path is save in exp doc
  //Parallel funcs
  var parallelFuncs=[];
  outcome.expDocs.forEach(function(expDoc) {
    if(expDoc.proc_err===null) {
      parallelFuncs.push(processMovie.bind(expDoc));
    }
  });
  //Parallel Start
  fRun.acts=parallelFuncs.length;
  app.logger.info(fRun.name+' start on '+fRun.acts+' actions');
  async.parallel(parallelFuncs, function(err) {
    //Parallel End
    app.logger.info(fRun.name+' end with '+fRun.actErrs.length+' action errors');
    fRun.actErrs.forEach(function(errObj) {
      app.logger.debug(errObj.err);
    });
    if(err) {
      fRun.err=fRun.name+' async.parallel '+err;
    } else if(fRun.actsOkay===0) {
      fRun.err=fRun.name+' async.parallel(force) '+'no actions finished okay';
    }
    fRun.endTime=new Date().getTime();
    outcome.funcsRan.push(fRun);
    return callback(fRun.err);
  });
};
var p_checkScripter=function(callback) {
  var outcome=this;
  var fRun={
    startTime:new Date().getTime(), endTime:null,
    index:outcome.funcsRan.length+1, name:(outcome.funcsRan.length+1)+'. p_checkScripter',
    err:null,
    acts:0, actsOkay:0, actErrs:[],
  };
  //Parallel Action
  var processScripter=function(cb_fn) {
    var expDoc=this;
    //Get Bpu
    app.db.models.Bpu.findOne({name:expDoc.exp_lastResort.bpuName}, {name:1, magnification:1, performanceScores:1, pastPerformanceScores:1}, function(err, bpuDoc) {
      if(err) {
        return cb_fn('processScripter Bpu.findOne:'+err);
      } else if(bpuDoc===null || bpuDoc===undefined) {
        return cb_fn('processScripter Bpu.findOne:'+'bpuDoc dne');
      } else {
        var cmdStr='python ../shared/python-scripts/'+expDoc.user.name+'.py '+expDoc.proc_startPath+' '+bpuDoc.magnification;
        expDoc.exp_processingScripterStartTime=new Date().getTime();
        generalFuncs.runBashCommand(cmdStr, function(err, stdout) {
          app.logger.info('processScripter '+expDoc.user.name+' for '+expDoc.exp_lastResort.bpuName+' end in '+(new Date().getTime()-expDoc.exp_processingScripterStartTime)+' ms');
          if(err && err.search('Premature')===-1 && err.search('JPEG')===-1) {
            return cb_fn('processScripter runBashCommand:'+err);
          } else {
            var stat=Number(stdout);
            if(isNaN(stat)) {
              return cb_fn('processScripter stat:'+stdout+' isNaN.');
            } else {


              var oldValue=JSON.parse(JSON.stringify(bpuDoc.performanceScores[expDoc.user.name]));
              var oldTime=JSON.parse(JSON.stringify(bpuDoc.performanceScores[expDoc.user.name+'Date']));


              console.log('s1', expDoc._id, expDoc.user.name, oldValue, new Date(oldTime));

              var newValue=Number(stat);
              var newTime=expDoc.exp_runEndTime;

              console.log('s2', expDoc._id, expDoc.user.name, newValue, new Date(newTime), (newTime-oldTime)/1000);

              var timeDiff=newTime-oldTime;
              var timeLambdaWeight=Math.pow(2, -1*(timeDiff/bpuDoc.performanceScores.WindowLambdaMs));
              var value=(oldValue*timeLambdaWeight+newValue)/(timeLambdaWeight+1);

              expDoc.stats[expDoc.user.name]=Number(value);
              expDoc.save(function(err, savedDoc) {
                if(err) {
                  app.logger.error('processScripter '+expDoc.user.name+' for '+expDoc.exp_lastResort.bpuName+' end expDoc save err:'+err);
                } else {
                  expDoc=savedDoc;
                  console.log('e', expDoc._id, expDoc.user.name, value, new Date(newTime), new Date(expDoc.exp_submissionTime));
                }

                //Set New Scores
                bpuDoc.performanceScores[expDoc.user.name]=value;
                bpuDoc.performanceScores[expDoc.user.name+'Date']=newTime;
                console.log('e', bpuDoc.name, bpuDoc.performanceScores[expDoc.user.name], new Date(bpuDoc.performanceScores[expDoc.user.name+'Date']));
                //Save
                bpuDoc.save(function(err, savedDoc) {
                  if(err) {
                    app.logger.error('processScripter '+expDoc.user.name+' for '+expDoc.exp_lastResort.bpuName+' end bpuDoc save err:'+err);
                  } else {
                    bpuDoc=savedDoc;
                  }
                  return cb_fn();
                });
              });
            }
          }
        });
      }
    });
  };
  //Parallel Data - mouted exp path is save in exp doc
  //Parallel funcs
  var parallelFuncs=[];
  outcome.expDocs.forEach(function(expDoc) {
    if(expDoc.proc_err===null) {
      if(expDoc.user.name==='scripterPopulation' || expDoc.user.name==='scripterActivity' || expDoc.user.name==='scripterResponse') {
        parallelFuncs.push(processScripter.bind(expDoc));
      }
    }
  });
  //Parallel Start
  fRun.acts=parallelFuncs.length;
  app.logger.info(fRun.name+' start on '+fRun.acts+' actions');
  async.parallel(parallelFuncs, function(err) {
    //Parallel End
    app.logger.info(fRun.name+' end with '+fRun.actErrs.length+' action errors');
    fRun.actErrs.forEach(function(errObj) {
      app.logger.debug(errObj.err);
    });
    if(err) {
      fRun.err=fRun.name+' async.parallel '+err;
    }
    fRun.endTime=new Date().getTime();
    outcome.funcsRan.push(fRun);
    return callback(fRun.err);
  });
};
var p_rmJpgsAndMvToFinal=function(callback) {

  var outcome=this;
  var fRun={
    startTime:new Date().getTime(), endTime:null,
    index:outcome.funcsRan.length+1, name:(outcome.funcsRan.length+1)+'. p_rmJpgsAndMvToFinal',
    err:null,
    acts:0, actsOkay:0, actErrs:[],
  };

  //Parallel Action
  var rmJpgsAndmoveFiles=function(cb_fn) {
    var expDoc=this;
    var endPath=app.runps.finalBpuDataDir+'/'+expDoc._id+'/';
    var rmJpgs='rm -f '+expDoc.proc_startPath+'/*.jpg';
    var mvFiles='mv '+expDoc.proc_startPath+'/ '+app.runps.finalBpuDataDir+'/';
    var cmdStr=rmJpgs+' && '+mvFiles;

    generalFuncs.runBashCommand(cmdStr, function(err, stdout) {

      expDoc.proc_endPath=app.runps.finalBpuDataDir+'/'+expDoc._id+'/';
      expDoc.exp_status='finished';

      console.log('Finishing exp: ' + expDoc._id);

      expDoc.exp_processingEndTime=new Date().getTime();
      expDoc.save(function(err, saveDoc) {
        if(err) {
          app.logger.error(fRun.name+' expDoc.save '+err);
        } else {
          fRun.actsOkay++;
          expDoc=saveDoc;
        }
        return cb_fn(null);
      });
    });
  };
  //Parallel Data - mouted exp path is save in exp doc
  //Parallel funcs
  var parallelFuncs=[];
  outcome.expDocs.forEach(function(expDoc) {
    if(expDoc.proc_err===null) {
      parallelFuncs.push(rmJpgsAndmoveFiles.bind(expDoc));
    }
    else{
      app.logger.error(expDoc.proc_err);
    }
  });
  //Parallel Start
  fRun.acts=parallelFuncs.length;
  app.logger.info(fRun.name+' start on '+fRun.acts+' actions');
  async.parallel(parallelFuncs, function(err) {
    //Parallel End
    app.logger.info(fRun.name+' end with '+fRun.actErrs.length+' action errors');
    fRun.actErrs.forEach(function(errObj) {
      app.logger.error(errObj.err);
    });
    if(err) {
      fRun.err=fRun.name+' async.parallel '+err;
    } else if(fRun.actsOkay===0) {
      fRun.err=fRun.name+' async.parallel(force) '+'no actions finished okay';
    }
    fRun.endTime=new Date().getTime();
    outcome.funcsRan.push(fRun);
    return callback(fRun.err);
  });
};


