"use strict";
var async=require('async');
var exec=require('child_process').exec;
var fs=require('fs');

var scriptTimer=require('./_AutoUserStatsManager/scriptTimer.js');

var _ServerBasePath=__dirname.split('shared/mongoDb/schema')[0];
var _ServerMediaPath=_ServerBasePath+'server/public/media/';
var _JsonPlotsFolder=_ServerBasePath+'shared/python-scripts/scripterPlotJsonFiles/';
var _PlotScriptPath=_ServerBasePath+'shared/python-scripts/plot.py';

var _SchemaName='AutoUserStatsManager';
var _schemaLogger=null;

var _windowLambdaMs=5*60*60*1000;

exports = module.exports = function(app, mongoose) {
  //Setup Logger
  var LOGGER_LEVELS=[ 'ALL',              'TRACE',                        'DEBUG',                  'INFO',               'WARN',                       'ERROR', 'FATAL', 'OFF'];
  var LLDESC=[        'cannot print to',  'sub functions',  'sub function info', 'function start end', 'non stopping issues/errors', 'errors', 'FATAL', 'OFF'];
  var logInfo={name:_SchemaName+'.js', loggerLevel:LOGGER_LEVELS[3]};
  _schemaLogger=app.log4js.getLogger(logInfo.name); 
  _schemaLogger.setLevel(logInfo.loggerLevel);
  _schemaLogger.info('initialized');
  //Schema Base
  var _mySchema = new mongoose.Schema({
    autoUsers: { type: Array, default: [] },
    filePathJsonPlotData: { type: String, default: _JsonPlotsFolder },
    lastGotStats: { type: Array, default: [] },
    scripterPopulationEvents: { 
      type: Array, 
      default: [
               {"time" : 0,     "topValue" : 0, "rightValue" : 0, "bottomValue" : 0, "leftValue" : 0},
               {"time" : 20000, "topValue" : 0, "rightValue" : 0, "bottomValue" : 0, "leftValue" : 0},
      ]
    },
    scripterActivityEvents: { 
      type: Array, 
      default: [
               {"time" : 0,     "topValue" : 0, "rightValue" : 0, "bottomValue" : 0, "leftValue" : 0},
               {"time" : 20000, "topValue" : 0, "rightValue" : 0, "bottomValue" : 0, "leftValue" : 0},
      ]
    },
    scripterResponseEvents: { 
      type: Array, 
      default: [
               {"time" : 0,     "topValue" : 100, "rightValue" : 0,   "bottomValue" : 0,    "leftValue" : 0   },
               {"time" : 30000, "topValue" : 0,   "rightValue" : 100, "bottomValue" : 0,    "leftValue" : 0   },
               {"time" : 60000, "topValue" : 0,   "rightValue" : 0,   "bottomValue" : 100,  "leftValue" : 0   },
               {"time" : 30000, "topValue" : 0,   "rightValue" : 0,   "bottomValue" : 0,    "leftValue" : 100 },
      ]
    },
  });

  //Script Additions
  require('./_'+_SchemaName+'/'+'bpuScore'+'.js')(app, _mySchema, _schemaLogger, _SchemaName);
  //My Functions, Statics
  _mySchema.statics.getInstanceDocument=function(nextMethodName, mainCallback) {
    var funcName='getInstanceDocument';
    _schemaLogger.trace(funcName);
    var thisSchema=this;
    thisSchema.find({}, {}, function(err, documents) {
      if(err) {
        mainCallback(err, null);
      } else {
        //Set thisDocument
        var thisDocument=null;
        if(documents.length===0) thisDocument=thisSchema();
        else thisDocument=documents[0];
        //Callback
        if(typeof nextMethodName==='function' && (mainCallback===null ||  mainCallback===undefined)) nextMethodName(null, thisDocument);
        else if(thisDocument[nextMethodName]) thisDocument[nextMethodName](mainCallback);
        else mainCallback(null, thisDocument);
      }
    });
  };
  //Bpu, Statics
  _mySchema.statics.getBpuScore=function(options, mainCallback) {
    this.getInstanceDocument(function(err, theDocument) {
      theDocument.getBpuScore(options, mainCallback);
    });
  };
  _mySchema.statics.getTheOnlyStatsManager=function(mainCallback) {
    var thisSchema=this;
    var setupDoc=function(theDocument) {
      var options=_getOptionsTemplate();
      var getUsers=function(callback) {
        thisSchema.getUsers(options, function(err, users) {
          if(err) {
            callback(err, null);
          } else {
            theDocument.autoUsers=users;
            theDocument.save(callback);
          }
        });
      };
      getUsers(function(err, newDoc) {
        mainCallback(err, newDoc);
      });
    };
    thisSchema.find({}, {_id:1}, function(err, docs) {
      if(err) {
        mainCallback(err);
      } else {
        if(docs===null || docs.length===0) {
          setupDoc(app.db.models.AutoUserStatsManager());
        } else if(docs.length===1) {
          setupDoc(docs[0]);
        } else {
          _schemaLogger.warn('getTheOnlyStatsManager does not handle multiple docs.  choosing 0 doc in array');
          setupDoc(docs[0]);
        }
      }
    }); 
  };
  _mySchema.statics.setupScriptTimer=function(options, callback) {scriptTimer.setup(app, _mySchema, options, callback);};
  _mySchema.statics.getUsers=function(options, callback) {_getUsers(app, options, callback);};
  _mySchema.statics.getStats=function(user, options, callback) {_getStats(app, user, options, callback);};
  _mySchema.statics.statsDataWasUpdatedInBpuExp=function(jsonExp, bpuPerformanceScores, callback) {
    /*
     *  Finds general data in jsonExp(the BpuExperiment data recently pulled from a bpu)
     *    and stat data in bpuPerformanceScores(current Bpu scores for each script type with dates)
     *  
    */ 
    //Final Object to send 
    var newScoreInfo={
      username:jsonExp.user.name, expId:jsonExp._id, bpuName:jsonExp.bpuInfo.nameBpu,
      type:null, value:null, date:null, 
    };
    //Stat time
    jsonExp.bpuDates.sort(function(obj1, obj2) {return new Date(obj1.date)-new Date(obj2.date);});
    newScoreInfo.date=new Date(jsonExp.bpuDates[0].date);
    //Stat Value and type
    Object.keys(jsonExp.stats).forEach(function(key) {
      if(jsonExp.stats[key]>=0) {
        newScoreInfo.type=key;
        newScoreInfo.value=jsonExp.stats[key];
      }
    });
    //Calculate 
    var timeDiff=newScoreInfo.date-bpuPerformanceScores[newScoreInfo.type+'Date'];
    var timeLambdaWeight=Math.pow(2, -1*( timeDiff/_windowLambdaMs));
    newScoreInfo.score=(bpuPerformanceScores[newScoreInfo.type]*timeLambdaWeight+newScoreInfo.value)/(timeLambdaWeight+1);
    //Update Bpu
    app.db.models.Bpu.setPerformanceScore({name:newScoreInfo.bpuName}, newScoreInfo, function(err) {
      callback(err);
    });
  };
  _mySchema.statics.checkAutoRefreshGraphsWithExperiment=function(exp, callback) {
    var thisSchema=this;
    thisSchema.getTheOnlyStatsManager(function(err, theDocument) {
      if(err) {
        callback(err);
      } else {
        var doRebuildGraphs=false; 
        theDocument.autoUsers.forEach(function(autoUser) {
          if(exp.user.name===autoUser.username) {
            _schemaLogger.warn('checkAutoRefreshGraphsWithExperiment has determined the graphs could be refreshed');
            doRebuildGraphs=true; 
          }
        });
        callback(null);
      }
    });
  };
  _mySchema.statics.getOptions=function(options, callback) {
    var optionsTemplate=_getOptionsTemplate();
    Object.keys(optionsTemplate).forEach(function(key) {
      if(options[key]) optionsTemplate[key]=options[key];
    });
    callback(null, optionsTemplate);
  };
  _mySchema.statics.buildGraph=function(options, mainCallback) {
    _schemaLogger.trace('buildGraph');
    var outcome={};
    options.isSample=false;
    options=_addPlotDataInfoToOptions(options);
    var getUser=function(callback) {
      app.db.models.AutoUserStatsManager.getUsers(options, function(err, users) {
        if(err) {
          err='getUser '+err;
          _schemaLogger.error(err);
          return callback(err);
        } else {
          var foundUser=null;
          users.forEach(function(user) {
            if(user.autoUserType===options.scriptType) {
              foundUser=user;
            }
          });
          if(foundUser===null) {
            err='getUser '+'foundUser===null';
            _schemaLogger.error(err);
            callback(err, null);
          } else {
            _schemaLogger.info('foundUser='+foundUser.username);
            outcome.user=foundUser;
            return callback(null);
          }
        }
      });
    };
    var getStats=function(callback) {
      options.doForcePull=true;
      app.db.models.AutoUserStatsManager.getStats(outcome.user, options, function(err, statsObj) {
        if(err) {
          err='getStats '+err;
          _schemaLogger.error(err);
          return callback(err);
        } else {
          _schemaLogger.info(statsObj.stats.length+' '+statsObj.scriptType+' stats for '+statsObj.bpuName+' out of '+statsObj.expsFound+' all bpus exps.');
          if(statsObj.bpuNameFail>0) _schemaLogger.warn('bpuNameFail='+statsObj.bpuNameFail);
          if(statsObj.valueFail>0) _schemaLogger.warn('valueFail='+statsObj.valueFail);
          if(statsObj.timeFail>0) _schemaLogger.warn('timeFail='+statsObj.timeFail);
          outcome.statsObj=statsObj;
          return callback(null);
        }
      });
    };
    var filterStats=function(callback) {
      _filterStats(app, outcome.statsObj, options, function(err, filteredStatsObj) {
        if(err) {
          err='filterStats '+err;
          _schemaLogger.error(err);
          return callback(err);
        } else {
          outcome.statsObj.filteredStats=filteredStatsObj.stats;
          options=filteredStatsObj.options;
          _schemaLogger.info(outcome.statsObj.filteredStats.length+' filtered stats from '+outcome.statsObj.stats.length);
          return callback(null);
        }
      });
    };
    var reduceDataAndMakePlotObj=function(callback) {
      _reduceDataAndMakePlotObj(app, outcome.statsObj.filteredStats, options, function(err, plotObj) {
        if(err) {
          err='reduceDataAndMakePlotObj '+err;
          _schemaLogger.error(err);
          return callback(err);
        } else {
          outcome.plotObj=plotObj;
          return callback(null);
        }
      });
    };
    var writeJsonFile=function(callback) {
      _writeJsonFile(app, outcome.plotObj, options, function(err, dat) {
        if(err) {
          err='writeJsonFile '+err;
          _schemaLogger.error(err);
          return callback(err);
        } else {
          return callback(null);
        }
      });
    };
    var createPlotImage=function(callback) {
      _createPlotImage(app, outcome.plotObj, function(err, dat) {
        if(err) {
          err='createPlotImage '+err;
          _schemaLogger.error(err);
          return callback(err);
        } else {
          return callback(null);
        }
      });
    };
    var saveUpdateToMe=function(callback) {
      _saveUpdateToMe(app, outcome, function(err, bpuData) {
        if(err) {
          err='saveUpdateToMe '+err;
          _schemaLogger.error(err);
          return callback(err);
        } else {
          outcome.avgStatsData=bpuData.avgStatsData;
          outcome.plotData=bpuData.plotData;
          return callback(null);
        }
      });
    };
    var asyncFinally=function(err) {
      if(err) {
        err=_SchemaName+' buildGraph '+err;
        _schemaLogger.error(err);
        mainCallback(err, null);
      } else {
        mainCallback(null, outcome);
      }
    };
    async.waterfall([
      getUser,
      getStats,
      filterStats,
      reduceDataAndMakePlotObj,
      writeJsonFile,
      createPlotImage,
      saveUpdateToMe,
    ], asyncFinally);
  };
  _mySchema.statics.checkGraphRebuildWithExp=function(exp, mainCallback) {
    var ScripterUserNames=[
      {name:'scripterActivity', scriptType:'activity'}, 
      {name:'scripterPopulation', scriptType:'population'}, 
      {name:'scripterResponse', scriptType:'response'}
    ];
    var data=null;
    for(var ind=0;ind<ScripterUserNames.length;ind++) {
      if(exp.user.name===ScripterUserNames[ind].name) {
        data=ScripterUserNames[ind];
        data.bpuName=exp.bpu.name;
        data.stats=exp.stats;
        data.time=Number(exp.experimentInfo.endRunDate);
        break;
      }
    }
    if(data!==null) {
      app.db.models.AutoUserStatsManager.getOptions(data, function(err, options) {
        if(err) {
          mainCallback('AutoUserStatsManager getOptions err:'+ err);
        } else {
          app.db.models.AutoUserStatsManager.buildGraph(options, function(err, graphUpdate) {
            if(err) {
              mainCallback('AutoUserStatsManager buildGraph err:'+ err);
            } else {
              mainCallback(null);
            }
          });
        }
      });
    } else {
      mainCallback(null);
    }
  };
  _mySchema.index({ search: 1 });
  _mySchema.set('autoIndex', (app.get('env') === 'development'));
  app.db.model(_SchemaName, _mySchema);
};
//**********************************
//**********************************
//**********************************
var _addPlotDataInfoToOptions=function(options) {
  var retObj={};
  options.filename=options.bpuName+'_'+options.scriptType;
  options.serverBasePath=_ServerBasePath;
  options.serverMediaPlotPath=_ServerMediaPath+options.filename+'.svg';
  options.plotScriptPath=_PlotScriptPath;
  options.jsonPath=_JsonPlotsFolder+options.filename+'.json';
  options.cmdScript='python '+options.plotScriptPath+' '+options.jsonPath;
  return options;
};
var _getInverseTimeWeightedAvg=function(data) {
  data.sort(function(a, b) {return b.time-a.time;});
  var retObj={
    timeNow:new Date(), 
    inverseTimeWeightedAvg:0, weightSum:0, weightedPointSum:0, 
    avg:0, avgSum:0, 
    avgTimeAgoMs:0, avgTimeAgoHours:0, avgTimeAgoSum:0
  };
  data.forEach(function(stat) {
    var minsAgo=(retObj.timeNow-stat.time)/(60*1000);
    var weight=1/(1+minsAgo);
    retObj.avgTimeAgoSum+=minsAgo;
    retObj.weightSum+=weight;
    retObj.weightedPointSum+=stat.value*weight;
    retObj.avgSum+=stat.value;
  });
  retObj.inverseTimeWeightedAvg=retObj.weightedPointSum/retObj.weightSum;
  retObj.avg=retObj.avgSum/data.length;
  retObj.avgTimeAgoMs=retObj.avgTimeAgoSum/data.length;
  retObj.avgTimeAgoHours=retObj.avgTimeAgoMs/(60*60*1000);
  return retObj;
};
var _getOptionsTemplate=function(app) {
    var options={
      bpuName:null,
      scriptType:null, scriptUsername:null,
      filter:{count:1, type:'all'},
    };
    return options;
};
var _getUsers=function(app, options, callback) {
  var query={groups:{$elemMatch:{$eq:'scripter'}}};
  var fieldsToReturn={
    username:1, avgUseStats:1, autoUserStats:1,
    autoUserLabelY:1, autoUserType:1,
    lastGraphBuildDate:1, lastTimeSent:1,
    autoUserEventsToRun:1, scripts:1,  groups:1
  };
  app.db.models.User.find(query, fieldsToReturn, function(err, scripterUsers) {
    if(err) {
      callback('find err:'+err, null);
    } else if(scripterUsers===null) {
      callback('find err:'+'scripterUsers===null', null);
    } else if(scripterUsers.length===0) {
      callback('find err:'+'scripterUsers.length===0', null);
    } else {
      callback(null, scripterUsers);
    }
  });
};
var _getStats=function(app, user, options, callback) {
  app.db.models.AutoUserStatsManager.getInstanceDocument(function(err, statsManager) {
    if(err) {
      _schemaLogger.warn('_getStats AutoUserStatsManager.getInstanceDocument err:'+err);
      _getStatsRePull(app, user, options, callback);
    } else {
      var returnObj={
        username:user.username,
        scriptType:options.scriptType,
        bpuName:options.bpuName,
        stats:[],
        expsFound:0,
        bpuNameFail:0,
        valueFail:0,
        timeFail:0,
      };
      var statFound=false;
      statsManager.lastGotStats.forEach(function(lastStat) {
        if(lastStat.username===user.username && lastStat.bpuName===options.bpuName) {
          statFound=true;
          returnObj=lastStat;
        }
      });
      if(!statFound || options.doForcePull) {
        _getStatsRePull(app, user, options, function(err, statsObj) {
          if(err) {
            callback(err, null);
          } else {
            var keeperStats=[];
            var didMatchStat=false;
            statsManager.lastGotStats.forEach(function(lastStat) {
              if(lastStat.username===statsObj.username && lastStat.bpuName===statsObj.bpuName) {
                didMatchStat=true;
              } else {
                keeperStats.push(lastStat);
              }
            });
            keeperStats.push(statsObj);
            statsManager.lastGotStats=keeperStats;
            statsManager.save(function(err, dat) {
              callback(null, statsObj);
            });
          }
        });
      } else {
        callback(null, returnObj);
      }
    }
  });
};
var _getStatsRePull=function(app, user, options, callback) {
  var returnObj={
    username:user.username,
    scriptType:options.scriptType,
    bpuName:options.bpuName,
    stats:[],
    expsFound:0,
    bpuNameFail:0,
    valueFail:0,
    timeFail:0,
  };
  var query={
    'user.name':returnObj.username,
    $where: function() {
      var scriptType=this.user.name.split('scripter')[1].toLowerCase();
      return this.stats[scriptType]>=0;
    },
  };
  var fieldsToReturn={
    'user':1, 
    'bpu':1, 
    'bpuInfo':1,
    'experimentInfo':1,
    'stats':1,
    'bpuDates':1,
  };
  app.db.models.BpuExperiment.find(query, fieldsToReturn, function(err, scripterExps) {
    if(err) {
      callback('find '+returnObj.username+' exps err:'+err, null);
    } else if(scripterExps===null) {
      callback('find '+returnObj.username+' exps err:'+'scripterExps is null', null);
    } else if(scripterExps.length===0) {
      callback('find '+returnObj.username+' exps err:'+'scripterExps zero length', null);
    } else {
      returnObj.expsFound=scripterExps.length;
      var findBpuNameInExp=function(exp) {
        if(exp.bpu.name!==null && exp.bpu.name!==undefined && exp.bpu.name!=='setonbpu' && exp.bpu.name!=='') return exp.bpu.name;
        if(exp.exp_wantsBpuName!==null && exp.exp_wantsBpuName!==undefined && exp.exp_wantsBpuName!=='') return exp.exp_wantsBpuName;
        if(exp.bpuInfo!==null && exp.bpuInfo!==undefined && typeof exp.bpuInfo==='object') {
          if(exp.bpuInfo.nameBpu!==null && exp.bpuInfo.nameBpu!==undefined && exp.bpuInfo.nameBpu!=='') return exp.bpuInfo.nameBpu;
          if(exp.bpuInfo.useBpu!==null && exp.bpuInfo.useBpu!==undefined && exp.bpuInfo.useBpu!=='') return exp.bpuInfo.useBpu;
          if(exp.bpuInfo.serverSetBpuName!==null && exp.bpuInfo.serverSetBpuName!==undefined && exp.bpuInfo.serverSetBpuName!=='notset' && exp.bpuInfo.serverSetBpuName!=='') return exp.bpuInfo.serverSetBpuName;
        }
        return null;
      };
      var findStatValueInExp=function(exp, scriptType) {
        if(exp.stats!==null && exp.stats!==undefined && typeof exp.stats==='object') {
          if(exp.stats[scriptType]!==null && exp.stats[scriptType]!==undefined && exp.stats[scriptType]!==-1) {
            return exp.stats[scriptType];
          } else {return -1;}
        } else {return -1;}
      };
      var cnt=0;
      var findStatTimeInExp=function(exp) {
        cnt++;
        var date=null;
        var prop=null;
        if(exp.bpuDates!==null && exp.bpuDates!==undefined && typeof exp.bpuDates.forEach==='function' && exp.bpuDates.length>0) {
          exp.bpuDates.sort(function(objA, objB) {
            var dateA=new Date(objA.date);
            var dateB=new Date(objB.date);
            return dateA-dateB;
          });
          prop='bpu Dates'; 
          date=new Date(exp.bpuDates[0].date);
        } else if(exp.experimentInfo!==null && exp.experimentInfo!==undefined && typeof exp.experimentInfo==='object') {
          var keys=Object.keys(exp.experimentInfo);
          for(var ind=0;ind<keys.length;ind++) {
            var key=keys[ind];
            if(key==='endRunDate') {prop=key; date=new Date(exp.experimentInfo[key]); break;}
            else if(key==='collectionDate') {prop=key; date=new Date(exp.experimentInfo[key]); break;}
            else if(key==='creationDate') {prop=key; date=new Date(exp.experimentInfo[key]); break;}
          }
          if(date===null) {
            prop='experimentInfo getTimestamp';
            date=new Date(exp.getTimestamp());
          }
        } else {
          prop='else getTimestamp';
          date=new Date(exp.getTimestamp());
        }
        //_schemaLogger.trace(cnt+':findStatTimeInExp prop:'+prop+', date:'+date);
        return date;
      };
      scripterExps.forEach(function(exp) {
        var isBpuScriptStat=findBpuNameInExp(exp, returnObj.bpuName);
        var statObj={
          isComplete:false, scriptType:returnObj.scriptType, 
          bpu:null, time:nullvalue:null,
        };
        var expBpuName=findBpuNameInExp(exp);
        if(expBpuName!==null) {
          if(expBpuName===returnObj.bpuName) {
            statObj.bpu=exp.bpu.name;
            var statValue=findStatValueInExp(exp, returnObj.scriptType);
            if(statValue>=0) {
              statObj.value=statValue;
              var statTime=findStatTimeInExp(exp, returnObj.scriptType);
              if(statTime>=0) {
                statObj.time=statTime;
                statObj.isComplete=true;
              } else {returnObj.timeFail++;}
            } else {returnObj.valueFail++;}
          }
        } else {returnObj.bpuNameFail++;}
        if(statObj.isComplete) {returnObj.stats.push(statObj);}
      });
      var avgStatsData=_getInverseTimeWeightedAvg(returnObj.stats);
      returnObj.avg=Math.round(avgStatsData.avg*1000)/1000;
      returnObj.inverseTimeWeightedAvg=Math.round(avgStatsData.inverseTimeWeightedAvg*1000)/1000;
      returnObj.pullDate=new Date();
      callback(null, returnObj);
    }
  });
};
var _filterStats=function(app, statsObj, options, callback) {
  var divs={
    month:30*7*24*60*60*1000,
    week:7*24*60*60*1000, 
    day:24*60*60*1000, 
    hour:60*60*1000, 
  };
  var nowMs=new Date();
  var filterByTime=function(stats, opts) {
    if(opts.filter===null || opts.filter===undefined) {
      opts.filter={};
      opts.filter.type='month';
      opts.filter.count=1;
    }
    if(opts.filter.type===null || opts.filter.type===undefined) opts.filter.type='month';
    if(opts.filter.count===null || opts.filter.count===undefined) opts.filter.count=1;
    var doDebug=false;
    if(doDebug) { //DEBUG
      options.filter.type='all';
      options.filter.count=4;
    }
    var newStats=[];
    var filterTime=0;
    statsObj.stats.sort(function(a, b) {return b.time-a.time;});
    if(options.filter.count===null || options.filter.count===undefined || options.filter.count<=0) options.filter.count=1;
    if(opts.filter.type==='month') filterTime=new Date(nowMs-opts.filter.count*(divs.month));
    else if(opts.filter.type==='week') filterTime=new Date(nowMs-opts.filter.count*(divs.week));
    else if(opts.filter.type==='day') filterTime=new Date(nowMs-opts.filter.count*(divs.day));
    else if(opts.filter.type==='hour') filterTime=new Date(nowMs-opts.filter.count*(divs.hour));
    else filterTime=0;
    stats.forEach(function(stat) {
      if(stat.time>=filterTime) newStats.push(stat);
    });
    opts.filter.time=filterTime;
    return {stats:newStats, options:opts};
  };
  //Run filter
  var filteredObj=filterByTime(statsObj.stats, options);
  if(filteredObj.stats.length>0) {
    //Determine Labels from filter time range 
    var filteredTimeRange=nowMs-filteredObj.stats[filteredObj.stats.length-1].time;
    if(filteredTimeRange>=3*divs.month) {         //More Than 12 weeks
      filteredObj.options.filter.label='months';
      filteredObj.options.filter.divisor=divs.month;
    } else if(filteredTimeRange>=3*divs.week) {   //12 weeks to 3 weeks
      filteredObj.options.filter.label='weeks';
      filteredObj.options.filter.divisor=divs.week;
    } else if(filteredTimeRange>=2*divs.days) {   //3 Weeks to 48 hours
      filteredObj.options.filter.label='days';
      filteredObj.options.filter.divisor=divs.day;
    } else {
      filteredObj.options.filter.label='hours';
      filteredObj.options.filter.divisor=divs.hour;
    }
    callback(null, filteredObj);
  } else {
    callback('all data filtered out', null);
  }
};
var _reduceDataAndMakePlotObj=function(app, statsObj, options, callback) {
  var plotObj={
    x:[],                               //Array of times, relative to now, so they are all negative
    y:[],                               //values return from the scripts associated with the x(times)
    xlabel:'xlabel not set',            //x axis label
    ylabel:'ylabel not set',            //x axis label
    xlim:[10, -10],                     //x axis limits [min, max]     
    ylim:[-10, 10],                     //y axis limits [min, max]
    title:'title not set',              //graphTitle 
    output:'not set',                   //path in server media to save image 
    options:{},                         //input options and local options 
  };
  //Make Fake data 
  var sampleTag=''; 
  if(options.isSample) {
    sampleTag=' (Fake Data) ';
    statsObj=[
      {time:-5*60*1000, value:34}, 
      {time:-4*60*1000, value:39}, 
      {time:-3*60*1000, value:2},
      {time:-2*60*1000, value:75},
      {time:-1*60*1000, value:39},
    ]; 
  }
  statsObj.sort(function(a, b) {return a.time-b.time;});
  var zeroTime=new Date();
  var maxX=0;
  var maxY=0;
  statsObj.forEach(function(stat) {
    var timeAgo=(zeroTime-stat.time)/options.filter.divisor;
    var xVal=-1*timeAgo;
    var yVal=stat.value;
    if(Math.abs(xVal)>Math.abs(maxX)) maxX=xVal;
    if(Math.abs(yVal)>Math.abs(maxY)) maxY=yVal;
    plotObj.x.push(xVal);
    plotObj.y.push(yVal);
  });
  plotObj.xlabel=sampleTag+' time ('+options.filter.label+')';
  plotObj.ylabel=sampleTag+' value (units)';
  plotObj.xlim=[maxX*1.1, maxX*-0.1];  //slightly less than oldest point, slightly more than zero(-1 since all value are negative or zero)
  plotObj.ylim=[maxY*1.5, -maxY*0.1];
  plotObj.title=new Date().toLocaleString()+': '+sampleTag+options.bpuName+' '+options.scriptType;
  plotObj.output=options.serverMediaPlotPath;
  plotObj.options=options;
  callback(null, plotObj);
};
var _writeJsonFile=function(app, plotObj, options, callback) {
  fs.writeFile(options.jsonPath, JSON.stringify(plotObj, null, 4), function(err, dat) {
    if(err) {
      callback(err, null);
    } else {
      callback(null, 'okay');
    }
  });
};
var _createPlotImage=function(app, plotObj, callback) {
  exec(plotObj.options.cmdScript, function(error, stdout, stderr) {
    if(error!==null) {
      callback('error: ' + error, null);
    } else if(stderr) {
      callback('stderr: ' + stderr, null);
    } else {
      callback(null, stdout);
    }
  });  
};
var _saveUpdateToMe=function(app, buildGraphOutcome, callback) {
  var avgStatsData=_getInverseTimeWeightedAvg(buildGraphOutcome.statsObj.stats);
  app.db.models.Bpu.setAvgStatsDataFromAutoUserStatsManager({name:buildGraphOutcome.plotObj.options.bpuName}, buildGraphOutcome.plotObj.options.scriptType, avgStatsData, function(err, bpuPlotData) {
    callback(null, bpuPlotData);
  });
};
