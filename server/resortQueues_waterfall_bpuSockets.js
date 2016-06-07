'use strict';
var async=require('async');
var _listExperiment=null;
var _singleExperimentUserNames=['scripterPopulation', 'scripterActivity', 'scripterResponse'];
var MaxResortFailures=100;

module.exports=function(app, _resortLogger, mainCallback) {
  var mainFuncName='resortQueues';
  
  var outcome={
    rejectTags:[],
    resortTags:[],
    sortedTags:[],
    bpuDocInfoObjects:{},
  };
 
  //Series Funcs 
  //1. 
  outcome.queueExpObj={};
  outcome.newExpObj={};
  var getListExperimentAndMakeExpObj=function(callback) {
    _resortLogger.debug(mainFuncName+' '+'getListExperimentAndMakeExpObj');
    app.db.models.ListExperiment.getInstanceDocument(function(err, listExperiment) {
      if(err) {
        callback(mainFuncName+':'+'getListExperimentAndMakeExpObj'+' '+err);
      } else {
        _listExperiment=listExperiment;
        Object.keys(_listExperiment._doc).forEach(function(key) {
          if(key[0]!=='_') {
            if(key.search('eug')>-1) {
              while(_listExperiment[key].length>0) {
                var expTag=_listExperiment[key].pop();
                outcome.queueExpObj[expTag.id]=expTag;
              }
            } else if(key==='newExps') {
              while(_listExperiment[key].length>0) {
                var newExpTag=_listExperiment[key].pop();
                outcome.newExpObj[newExpTag.id]=newExpTag;
              }
            }
          }
        });
        callback(null);
      }
    });
  };

  //2.
  var trimExperimentObj=function(callback) {
    _resortLogger.debug(mainFuncName+' '+'trimExperimentObj');
    
    var scriptersPerBpu={};    //scripter can only have one in list, keep oldest
    var usersLive={};          //only on live user, keep oldest
    var textExps={};           //no limit at the moment
    
    //check bpus 
    Object.keys(outcome.queueExpObj).forEach(function(key) {
      var expTag=outcome.queueExpObj[key];
      //Check Scripters
      var isSorted=false;
      if(!isSorted) { 
        for(var ind=0;ind<_singleExperimentUserNames.length;ind++) {
          if(_singleExperimentUserNames[ind]===expTag.user.name) {
            //Bpu Obj Made?
            if(scriptersPerBpu[expTag.exp_lastResort.bpuName]) {
              //Scripter already in bpu?
              if(scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name]) {
                
                ///Keep oldest scripter
                if(expTag.exp_submissionTime<scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name].exp_submissionTime) {
                  scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name].exp_lastResort.rejectionCounter++;
                  scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name].exp_lastResort.rejectionReason='scripter already existed in this bpu queue';
                  outcome.rejectTags.push(JSON.parse(JSON.stringify(scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name])));
                  scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name]=expTag;
                }

              //add scripter to bpu
              } else {
                scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name]=expTag;
              }

            //Make Bpu Obj and add exp tag
            } else {
              scriptersPerBpu[expTag.exp_lastResort.bpuName]={};
              scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name]=expTag;
            }
            isSorted=true; 
            break;
          }
        }
      }
      //check live
      if(!isSorted && expTag.group_experimentType==='live') {
        isSorted=true;
        //User already found?
        if(usersLive[expTag.exp_sessionID]) {
          
          //overwrite if older
          if(expTag.exp_submissionTime<usersLive[expTag.exp_sessionID].exp_submissionTime) {
            usersLive[expTag.exp_sessionID].exp_lastResort.rejectionCounter++;
            usersLive[expTag.exp_sessionID].exp_lastResort.rejectionReason='live user already existed in a bpu queue';
            outcome.rejectTags.push(JSON.parse(JSON.stringify(usersLive[expTag.exp_sessionID])));
            usersLive[expTag.exp_sessionID]=expTag;
          }
        
        //Make new
        } else {
          usersLive[expTag.exp_sessionID]=expTag;
        }
      }
      //text 
      if(!isSorted && expTag.group_experimentType==='text') {
        isSorted=true;
        if(textExps[expTag.id]) {
          ///Keep oldest id 
          if(expTag.exp_submissionTime<textExps[expTag.id].exp_submissionTime) {
            textExps[expTag.id].exp_lastResort.rejectionCounter++;
            textExps[expTag.id].exp_lastResort.rejectionReason='duplicate id in list';
            outcome.rejectTags.push(JSON.parse(JSON.stringify(textExps[expTag.id])));
            textExps[expTag.id]=expTag;
          }
        } else {
          textExps[expTag.id]=expTag;
        }
      } 

      //other
      if(!isSorted) {
        expTag.exp_lastResort.rejectionCounter++;
        expTag.exp_lastResort.rejectionReason='unknown group_experimentType';
        outcome.rejectTags.push(JSON.parse(JSON.stringify(expTag)));
      }
    });
    //Check new
    Object.keys(outcome.newExpObj).forEach(function(key) {
      var expTag=outcome.newExpObj[key];
      var isSorted=false;
      if(!isSorted) { 
        for(var ind=0;ind<_singleExperimentUserNames.length;ind++) {
          if(_singleExperimentUserNames[ind]===expTag.user.name) {
            //Bpu Obj Made?
            if(scriptersPerBpu[expTag.exp_lastResort.bpuName]) {
              //Scripter already in bpu?
              if(scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name]) {
                
                scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name].exp_lastResort.rejectionCounter++;
                scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name].exp_lastResort.rejectionReason='new scripter already existed in this bpu queue';
                outcome.rejectTags.push(JSON.parse(JSON.stringify(scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name])));

              //add scripter to bpu
              } else {
                scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name]=expTag;
              }

            //Make Bpu Obj and add exp tag
            } else {
              scriptersPerBpu[expTag.exp_lastResort.bpuName]={};
              scriptersPerBpu[expTag.exp_lastResort.bpuName][expTag.user.name]=expTag;
            }
            isSorted=true; 
            break;
          }
        }
      }
      //check live
      if(!isSorted && expTag.group_experimentType==='live') {
        isSorted=true;
        //User already found?
        if(usersLive[expTag.exp_sessionID]) {
          usersLive[expTag.exp_sessionID].exp_lastResort.rejectionCounter++;
          usersLive[expTag.exp_sessionID].exp_lastResort.rejectionReason='new live user already existed in a bpu queue';
          outcome.rejectTags.push(JSON.parse(JSON.stringify(usersLive[expTag.exp_sessionID])));
        
        //Make new
        } else {
          usersLive[expTag.exp_sessionID]=expTag;
        }
      }
      //text 
      if(!isSorted && expTag.group_experimentType==='text') {
        isSorted=true;
        if(textExps[expTag.id]) {
          ///Keep oldest id 
          if(expTag.exp_submissionTime<textExps[expTag.id].exp_submissionTime) {
            textExps[expTag.id].exp_lastResort.rejectionCounter++;
            textExps[expTag.id].exp_lastResort.rejectionReason='duplicate id in list';
            outcome.rejectTags.push(JSON.parse(JSON.stringify(textExps[expTag.id])));
            textExps[expTag.id]=expTag;
          }
        } else {
          textExps[expTag.id]=expTag;
        }
      } 

      //other
      if(!isSorted) {
        expTag.exp_lastResort.rejectionCounter++;
        expTag.exp_lastResort.rejectionReason='new unknown group_experimentType';
        outcome.rejectTags.push(JSON.parse(JSON.stringify(expTag)));
      }
    });

    //Build One List   
    Object.keys(scriptersPerBpu).forEach(function(key) {outcome.resortTags.push(JSON.parse(JSON.stringify(scriptersPerBpu[key])));});
    Object.keys(usersLive).forEach(function(key) {outcome.resortTags.push(JSON.parse(JSON.stringify(usersLive[key])));});
    Object.keys(textExps).forEach(function(key) {outcome.resortTags.push(JSON.parse(JSON.stringify(textExps[key])));});
    scriptersPerBpu=null;
    usersLive=null;
    textExps=null;
    //Return 
    outcome.experimentsInList=0;
    if(outcome.resortTags.length===0) {
      _resortLogger.info(mainFuncName+' '+'createOneExpList err:'+'no exps');
    }
    callback(null);
  };
  var resortOneExpList=function(callback) {
    if(outcome.resortTags.length>0) {
      _resortLogger.debug(mainFuncName+' '+'resortOneExpList');
      var actionFunc=function(cb_fn) {
        var expTag=this.expTag;
        var bpusInGroup=this.bpusInGroup;
        _resortLogger.trace(mainFuncName+' '+'resortOneExpList exp tag for '+expTag.exp_sessionID);
        app.db.models.BpuExperiment.findById(expTag.id, {}, function(err, doc) {
          if(err) {
            expTag.rejectionCounter++;
            expTag.rejectionReason='resortOneExpList BpuExperiment.findById '+err;
            outcome.rejectTags.push(JSON.parse(JSON.stringify(expTag)));
            return cb_fn(null);
          } else if(doc===null || doc===undefined) {
            expTag.rejectionCounter++;
            expTag.rejectionReason='resortOneExpList BpuExperiment.findById '+'doc dne';
            outcome.rejectTags.push(JSON.parse(JSON.stringifyexpTag));
            return cb_fn(null);
          } else if(doc.exp_isCanceled) {
            expTag.rejectionCounter++;
            expTag.rejectionReason='is canceled was true';
            outcome.rejectTags.push(JSON.parse(JSON.stringify(expTag)));
            return cb_fn(null);
          } else {
            //Check bpu request
            var doesHaveBpuRequest=false; 
            if(expTag.exp_wantsBpuName!==null) doesHaveBpuRequest=true;
            //Sort Groups and score
            expTag.exp_lastResort.canidateBpus=[];
            bpusInGroup.forEach(function(bpu) {
              var scoreObj=bpu.scoreBpuFromResort(outcome.bpuDocInfoObjects[bpu.name].timeToFinish, bpu.socket_getStatusResObj.expTimeLeft+expTag.exp_lastResort.bpuProcessingTime);
              scoreObj.bpuName=bpu.name;
              scoreObj.processingTime=bpu.bpu_processingTime;
              scoreObj.totalWaitTime=outcome.bpuDocInfoObjects[bpu.name].timeToFinish;
              //Check for bpu req
              if(doesHaveBpuRequest) {
                if(bpu.name===expTag.exp_wantsBpuName) {
                  expTag.exp_lastResort.canidateBpus.push(scoreObj);
                }
              } else {
                expTag.exp_lastResort.canidateBpus.push(scoreObj);
              }
              _resortLogger.trace(mainFuncName+' '+'resortOneExpList exp tag for '+expTag.exp_sessionID+' bpu '+bpu.name+' with score '+scoreObj.finalScore+' and wait '+scoreObj.totalWaitTime);
            }); 
            //choose bpu from score and wait time
            expTag.exp_lastResort.canidateBpus.sort(function(objA, objB) {return objB.finalScore-objA.finalScore;});
            expTag.exp_lastResort.bpuName=expTag.exp_lastResort.canidateBpus[0].bpuName;
            expTag.exp_lastResort.totalWaitTime=expTag.exp_lastResort.canidateBpus[0].totalWaitTime;
            
            _resortLogger.debug(mainFuncName+' '+'resortOneExpList exp tag for '+expTag.exp_sessionID+' bpu choosen '+expTag.exp_lastResort.bpuName);
            //update tag
            expTag.exp_lastResort.bpuProcessingTime=expTag.exp_lastResort.canidateBpus[0].processingTime;

            //update exp
            expTag.exp_status='queued';
            outcome.sortedTags.push(expTag);
            //update temp object that track bpu queue time 
            outcome.bpuDocInfoObjects[expTag.exp_lastResort.bpuName].timeToFinish+=expTag.exp_lastResort.runTime+expTag.exp_lastResort.bpuProcessingTime;
            outcome.bpuDocInfoObjects[expTag.exp_lastResort.bpuName].expCnt++;
           
            //Update exp doc with tag info
            doc.exp_lastResort.rejectionCounter=expTag.exp_lastResort.rejectionCounter;
            doc.exp_lastResort.rejectionReason=expTag.exp_lastResort.rejectionReason;
            doc.exp_lastResort.canidateBpus=expTag.exp_lastResort.canidateBpus;
            doc.exp_lastResort.bpuName=expTag.exp_lastResort.bpuName;
            doc.exp_lastResort.waitTime=expTag.exp_lastResort.waitTime;
            doc.exp_lastResort.runTime=expTag.exp_lastResort.runTime;
            doc.exp_lastResort.bpuProcessingTime=expTag.exp_lastResort.bpuProcessingTime;
            //doc info 
            doc.exp_status='queued';
            doc.exp_resortTime=new Date().getTime();
            doc.save(function(err, saveDoc) {
              if(err) _resortLogger.warn(mainFuncName+' '+'resortOneExpList exp save err:'+err);
              return cb_fn(null);
            });
          } 
        });
      }; 
      //Build Parallel Functions
      var parallelFuncs=[];
      while(outcome.resortTags.length>0) {
        var expTag=outcome.resortTags.shift();
        //Get bpus in group
        var bpusInGroup=[];
        //Check expTag for key objects
        if(expTag.user) {
          if(expTag.user.groups && expTag.user.groups.length>0) {
            for(var ind=0;ind<expTag.user.groups.length;ind++) {
              for(var jnd=0;jnd<app.bpusConnected.length;jnd++) {
                var bpuDoc=app.bpusConnected[jnd].bpuDoc;
                outcome.bpuDocInfoObjects[bpuDoc.name]={expCnt:0, timeToFinish:0};
                for(var knd=0;knd<bpuDoc.allowedGroups.length;knd++) {
                  if(bpuDoc.allowedGroups[knd]===expTag.user.groups[ind]) {
                    bpusInGroup.push(bpuDoc);
                    break;
                  }
                
                }
              }
              if(bpusInGroup.length===0) {
                expTag.exp_lastResort.rejectionCounter++;
                expTag.exp_lastResort.rejectionReason='no canidate bpus found';
                outcome.rejectTags.push(JSON.parse(JSON.stringify(expTag)));
              } else {
                parallelFuncs.push(actionFunc.bind({expTag:expTag, bpusInGroup:bpusInGroup}));
                break;
              }
            }
          } else {
            expTag.exp_lastResort.rejectionCounter++;
            expTag.exp_lastResort.rejectionReason='no user.groups to find';
            outcome.rejectTags.push(JSON.parse(JSON.stringify(expTag)));
          }
        } else {
          expTag.exp_lastResort.rejectionCounter++;
          expTag.exp_lastResort.rejectionReason='no user object in exp tag';
          outcome.rejectTags.push(JSON.parse(JSON.stringify(expTag)));
        }
      }
      //Run Series
      async.parallel(parallelFuncs, function(err) {
        if(err) {
          _resortLogger.error(mainFuncName+':'+'resortOneExpList'+' '+err);
          callback(mainFuncName+':'+'resortOneExpList'+' '+err);
        } else {
          callback(null);
        }
      });
    } else {
      callback(null);
    }
  };
  var saveExpList=function(callback) {
    while(outcome.sortedTags.length>0) {
      var expTag=outcome.sortedTags.pop();
      if(_listExperiment[expTag.exp_lastResort.bpuName]) {
        outcome.experimentsInList++;
        _listExperiment[expTag.exp_lastResort.bpuName].push(expTag);
      } else {
        expTag.exp_lastResort.rejectionCounter++;
        expTag.exp_lastResort.rejectionReason='coule not save exp tag to list experiemnt, bpu list dne';
        outcome.rejectTags.push(JSON.parse(JSON.stringify(expTag)));
      }
    }
    while(outcome.rejectTags.length>0) {
      var expRejTag=outcome.rejectTags.pop();
      if(expRejTag.exp_lastResort.rejectionCounter<=MaxResortFailures) {
        _listExperiment.newExps.push(expRejTag);
      } else {
        _listExperiment._lostList.push(expRejTag);
      }
    }
    //_listExperiment._lostList=[];
    _listExperiment.save(function(err, currentDoc) {
      if(err) {
        callback(mainFuncName+':'+'saveExpList'+' err:'+err);
      } else {
        _listExperiment=currentDoc;
        callback(null);
      }
    });
  };
  //Build Series Functions
  var seriesFuncs=[];
  seriesFuncs.push(getListExperimentAndMakeExpObj);
  seriesFuncs.push(trimExperimentObj);
  seriesFuncs.push(resortOneExpList);
  seriesFuncs.push(saveExpList);
  //Run Series
  var startDate=new Date(); 
  _resortLogger.info(mainFuncName+' '+'start');
  async.series(seriesFuncs, function(err) {
    _resortLogger.info(mainFuncName+' '+'end in '+(new Date()-startDate)+' ms');
    _resortLogger.info(mainFuncName+' '+'end outcome.experimentsInList='+outcome.experimentsInList);
    if(err) {
      mainCallback(mainFuncName+' '+'end err:'+err, _listExperiment, outcome.experimentsInList);
    } else {
      mainCallback(null, _listExperiment, outcome.experimentsInList);
    }
  });
};
