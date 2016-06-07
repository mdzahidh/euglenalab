"use strict";
var async=require('async');
var exec=require('child_process').exec;
var fs=require('fs');

var _Name='setupScriptTimer.js';
var myPrintMsg=true;
var myPrintInit=true;
var myPrintErr=true;
var myPrintName='('+_Name+')';
var myPrint=function(msg, init, err) {
  if(err!==undefined && err!==null && myPrintErr) console.log('Error'+'\t'+myPrintName+':'+err);
  else if(err!==undefined && init!==null && myPrintInit) console.log('Init'+'\t'+myPrintName+':'+init);
  else if(err!==undefined && msg!==null && myPrintMsg) console.log('Msg'+'\t'+myPrintName+':'+msg);
};
var _scriptUserInterval=null;
//var ScriptUserIntervalTime=60*30*1000;
var ScriptUserIntervalTime=20*60*1000;
var auto_getNewExperiment=function(app, user, expData, callback) {
  var newExp=app.db.models.BpuExperiment();
  newExp.setExperiment(expData, user, function(err, theNewExp) {
    if(err) {
      callback('newExp.setEperiment Err:'+err, null);
    } else {  
      app.db.models.ListExperiment.getBpuList(function(err, list) {
        if(err) {
          callback('ListExperiment.getBpuList Err:'+err, null);
        } else {
          list.estimateExperimentWaitTime(theNewExp, function(err, estWaitTime) {
            if(err) {
              callback('estimateExperimentWaitTime Err:'+err, null);
            } else {
              theNewExp.timeToLive=estWaitTime;
              callback(null, theNewExp);
            }
          });
        }
      });
    }
  });
};
exports.setup=function(app, mySchema, options, mainCallback) {
  myPrint(null, 'setup start', null);
  var outcome={};
  var getUsers=function(callback) {
    myPrint(null, 'setup getUsers', null);
    app.db.models.AutoUserStatsManager.getUsers(options, function(err, users) {
      if(err) {
        return callback('getUsers '+err);
      } else {
        outcome.users=users;
        return callback(null);
      }
    });
  };
  var buildJoinQueueDataObjects=function(callback) {
    myPrint(null, 'setup buildJoinQueueDataObjects', null);
    var _JoinQueueDataObj=app.db.models.BpuExperiment.getDataObjToJoinQueue();
    outcome.joinQueueDataObjs=[];
    outcome.users.forEach(function(user) {
      var defaultScripterEventsTag=user.username+'Events';
      if(mySchema.paths[defaultScripterEventsTag]!==null && mySchema.paths[defaultScripterEventsTag]!==undefined) { 
        var scripterEvents=JSON.parse(JSON.stringify(mySchema.paths[defaultScripterEventsTag].options.default));
        options.scriptObjects.forEach(function(optionScriptObj) {
          if(user.autoUserType===optionScriptObj.type) {
            var joinQueueDataObj=JSON.parse(JSON.stringify(_JoinQueueDataObj));
            joinQueueDataObj.user.id=user._id;
            joinQueueDataObj.user.username=user.username;
            joinQueueDataObj.experimentData.auto.scripts=user.scripts;
            joinQueueDataObj.experimentType.isLive=false;
            joinQueueDataObj.experimentType.isAuto=true;
            joinQueueDataObj.experimentType.isArray=false;
            joinQueueDataObj.experimentType.isSoap=false;
            joinQueueDataObj.experimentData.auto.eventsToRun=scripterEvents;
            outcome.joinQueueDataObjs.push({joinQueueDataObj:joinQueueDataObj, user:user, options:optionScriptObj});
          }
        });
      }
    });
    return callback(null);
  };
  var buildInitialExperiments=function(callback) {
    myPrint(null, 'setup buildInitialExperiments', null);
    outcome.initialExperiments=[];
    var index=-1;
    var next=function() {
      index++;
      if(index<outcome.joinQueueDataObjs.length) {
        console.log('AutoUserStatsManager scriptTimer you did not sort these propertly.  Each bpu get the same script and the same time');
        var expData=JSON.parse(JSON.stringify(outcome.joinQueueDataObjs[index].joinQueueDataObj));
        var user=outcome.joinQueueDataObjs[index].user;
        var options=outcome.joinQueueDataObjs[index].options;
        if(options.bpus.length>0) { 
          var newExp=app.db.models.BpuExperiment();
          //Set Bpu 
          options.bpus.sort(function(a, b) {return a.lastSendDate-a.lastSendDate;});
          expData.exp_wantsBpuName=options.bpus[0].name;
          newExp.setExperiment(expData, user, function(err, theNewExp) {
            if(err) {
              myPrint(null, null, 'buildInitialExperiments newExp.setExperiment Err:'+err);
              next();
            } else { 
              theNewExp.isConfirmed=true;
              theNewExp.save(function(err, exp) {
                if(err) {
                  myPrint(null, null, 'buildInitialExperiments theNewExp.save '+user.username+' err:'+err);
                  next();
                } else {
                  outcome.initialExperiments.push(exp);
                  next(); 
                }
              }); 
            }
          });
        } else {
          next();
        }
      } else {
        //return callback(null);
      }
    };
    next();
  };
  var getBpuList=function(callback) {
    myPrint(null, 'setup getBpuList', null);
    app.db.models.ListExperiment.getBpuList(function(err, list) {
      if(err) {
        return callback('getBpuList err:'+err);
      } else {
        outcome.list=list;
        return callback(null);
      }
    });
  };
  var addInitialExperimentsToQueue=function(callback) {
    myPrint(null, 'setup addInitialExperimentsToQueue', null);
    var index=-1;
    var next=function() {
      index++;
      if(index<outcome.initialExperiments.length) {
        var expToAdd=outcome.initialExperiments.shift();
        app.db.models.ListExperiment.addNewExpToList(outcome.list, expToAdd, null, function(err, expListTag) {
          if(err) {
            myPrint(null, null, 'setupAutoUserTimer addNewExpToList '+expToAdd.user.name+' err:'+err);
            next();
          } else {
            next(); 
          }
        });
      } else {
        return callback(null);
      }
    };
    next();
  };
  var asyncFinally=function(err) {
    if(err) {
      myPrint(null, 'setup asyncFinally err'+err, null);
      mainCallback(err, null);
    } else {
      myPrint(null, 'setup asyncFinally'+err, null);
      //mainCallback(null, outcome);
    }
  };
  async.waterfall([getUsers, buildJoinQueueDataObjects, buildInitialExperiments, getBpuList, addInitialExperimentsToQueue], asyncFinally);
};
var startLoop=function(app, mySchema, options, cb_fn) {
  var timeNow=new Date().getTime();
  var outcome={
    scriptUsers:[],
  };
  var sendExps=function() {
    //var ScriptUsersBpus=['eug15', 'eug16'];
    //var ScriptUsersBpus=['eug15'];
    var ScriptUsersBpus=[];
    timeNow=new Date().getTime();
    outcome.scriptUsers.sort(function(a, b) {
      return a.lastTimeSent-b.lastTimeSent;
    });
    var scripterNumber=0;  //always zero b/c resort by time, usefull to manually check a specific sript on start up
    var museumerNumber=0;
    var nextExp=function() {
      var nextSendExp=null;
      var nextSendBpuName=null;
      var joinQueueDataObj=app.db.models.BpuExperiment.getDataObjToJoinQueue();
      if(ScriptUsersBpus.length>0) {
        nextSendExp=outcome.scriptUsers[scripterNumber];
        nextSendBpuName=ScriptUsersBpus.shift();
        joinQueueDataObj.user.id=nextSendExp._id;
        joinQueueDataObj.user.username=nextSendExp.username;
        joinQueueDataObj.exp_wantsBpuName=nextSendBpuName;
        joinQueueDataObj.experimentType.isLive=false;
        joinQueueDataObj.experimentType.isAuto=true;
        joinQueueDataObj.experimentType.isArray=false;
        joinQueueDataObj.experimentType.isSoap=false;
        joinQueueDataObj.experimentData.auto.scripts=nextSendExp.scripts;
        joinQueueDataObj.experimentData.auto.eventsToRun=nextSendExp.autoUserEventsToRun;
      }
      if(nextSendExp!==null && nextSendBpuName!==null && joinQueueDataObj!==null) {
        auto_getNewExperiment(app, nextSendExp, joinQueueDataObj, function(err, exp) {
          if(err) {
            myPrint(null, null, 'setupAutoUserTimer _getNewExperiment '+nextSendExp.username+' err:'+err);
            nextExp();
          } else {
            app.db.models.ListExperiment.getBpuList(function(err, list) {
              if(err) {
                myPrint(null, null, 'setupAutoUserTimer ListExperiment '+nextSendExp.username+' err:'+err);
                nextExp();
              } else {
                exp.isConfirmed=true;
                exp.save(function(err, dat) {
                  app.db.models.ListExperiment.addNewExpToList(list, exp, null, function(err, expListTag) {
                    if(err) {
                      myPrint(null, null, 'setupAutoUserTimer addNewExpToList '+nextSendExp.username+' err:'+err);
                      nextExp();
                    } else {
                      outcome.scriptUsers[scripterNumber].lastTimeSent=timeNow;
                      outcome.scriptUsers[scripterNumber].save(function(err, dat){});
                      nextExp(); 
                    }
                  });
                });
              } 
            });
          }
        });
      }
    };
    if(ScriptUsersBpus.length>0) {
      nextExp();
    }
  };
  _scriptUserInterval=setInterval(function() { //auto send after first one
    sendExps();
  }, ScriptUserIntervalTime);
  sendExps();  //send first experiments manually
  cb_fn(null);
};

var gatherSripterData=function(app, mySchema, options, cb_fn) { 
    var outcome={
      scriptUsers:[],
    };
    app.db.models.Group.find({name:'scripter'}, {users:1}, function(err, groups) {
      if(err) {
        cb_fn('setupAutoUserTimer Group.find:'+err);
      } else {
        var usernames=[];
        groups.forEach(function(group) {
          group.users.forEach(function(groupUserName) {
            var doAdd=true;
            usernames.forEach(function(username) {
              if(groupUserName===username) {
                doAdd=false;
              }
            });
            if(doAdd) {
              usernames.push({username:groupUserName});
            }
          });
        });
        if(usernames.length>0) {
          app.db.models.User.find({$or:usernames}, {lastTimeSent:1, username:1, autoUserEventsToRun:1, scripts:1}, function(err, scriptUsers) {
            if(err) {
              cb_fn('setupAutoUserTimer User.find:'+err);
            } else {
              outcome.scriptUsers=[];
              scriptUsers.forEach(function(item) {
                if(item.username==='scripterPopulation' && runPopulation) {
                  item.groups=['scripter'];
                  item.autoUserEventsToRun=[
                    {
                            "topValue" : 0,
                            "rightValue" : 0,
                            "bottomValue" : 0,
                            "leftValue" : 0,
                            "time" : 0
                    },
                    {
                            "topValue" : 0,
                            "rightValue" : 0,
                            "bottomValue" : 0,
                            "leftValue" : 0,
                            "time" : 20000
                    }
                  ];
                  if(item.scripts.length===0) {
                    item.scripts.push("population");
                  }
                  item.autoUserLabelY="population (cnt)";
                  item.autoUserType="population";
                  item.groups=['scripter'];
                  //item.save(function(err, dat) {});
                  outcome.scriptUsers.push(item);
                } else if(item.username==='scripterResponse' && runResponse) {
                  item.autoUserEventsToRun=[
                    {
                            "topValue" : 100,
                            "rightValue" : 0,
                            "bottomValue" : 0,
                            "leftValue" : 0,
                            "time" : 0
                    },
                    {
                            "topValue" : 0,
                            "rightValue" : 100,
                            "bottomValue" : 0,
                            "leftValue" : 0,
                            "time" : 30000
                    },
                    {
                            "topValue" : 0,
                            "rightValue" : 0,
                            "bottomValue" : 100,
                            "leftValue" : 0,
                            "time" : 60000
                    },
                    {
                            "topValue" : 0,
                            "rightValue" : 0,
                            "bottomValue" : 0,
                            "leftValue" : 100,
                            "time" : 90000
                    },
                    {
                            "topValue" : 0,
                            "rightValue" : 0,
                            "bottomValue" : 0,
                            "leftValue" : 0,
                            "time" : 120000
                    }
                  ];
                  if(item.scripts.length===0) {
                    item.scripts.push("response");
                  }
                  item.autoUserLabelY="response (cnt)";
                  item.autoUserType="response";
                  item.groups=['scripter'];
                  item.save(function(err, dat) {});
                  outcome.scriptUsers.push(item);
                } else if(item.username==='scripterActivity' && runActivity) {
                  item.autoUserEventsToRun=[
                    {
                            "topValue" : 0,
                            "rightValue" : 0,
                            "bottomValue" : 0,
                            "leftValue" : 0,
                            "time" : 0
                    },
                    {
                            "topValue" : 0,
                            "rightValue" : 0,
                            "bottomValue" : 0,
                            "leftValue" : 0,
                            "time" : 20000
                    }
                  ];
                  if(item.scripts.length===0) {
                    item.scripts.push("activity");
                  }
                  item.autoUserLabelY="activity (px)";
                  item.autoUserType="activity";
                  item.groups=['scripter'];
                  item.save(function(err, dat) {});
                  outcome.scriptUsers.push(item);

                }
              });
              cb_fn(null);
            }
          }); 
        } else {
          cb_fn('setupAutoUserTimer find scripter users from groups:'+'no scripter users found');
        }
      }
    });
  };
