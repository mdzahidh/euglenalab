'use strict';
exports=module.exports=function(app, mongoose) {
  var mySchema = new mongoose.Schema({
    //Set on Creation
    //Client Server
    bc_serverInfo: { type: Object, default:null },
    //User 
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: '' },
      groups: { type: Array, default: [] },
    },
    //Session
    session: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
      sessionID: { type: String, default: '' },
      socketID: { type: String, default: '' },
    },
    group_experimentType:{type: String, enum:['live', 'text']},
    exp_wantsBpuName:{type: String, default:null},
    exp_eventsToRun:{type: Array, default:[]},
    exp_metaData:{type: Object, default:{}},
   
    exp_eventsRunTime:{type: Number, default:0},

    //Set on Creation && updated in resort
    tag: { type: Object, default: {} },

    //Updated in Resort
    exp_serverErrorCounter:{type: Number, default:0},
    exp_isCanceled:{type: Boolean, default:false},
    exp_canceledReason:{type: String, default:null},
    exp_statusMessages:{type:Array, default:[]}, 
    //Resort Info 
    exp_lastResort:{
      rejectionCounter: { type: Number, default: 0 },
      rejectionReason: { type: String, default: null },

      canidateBpus:{type:Array, default:[]},  //this should have score info
      bpuName: {type:String, default:null},
      waitTime: { type: Number, default: 0 },

      processingTime: { type: Number, default: 0 },
    },

    //Set when sending to lab
    bc_startSendTime:{type: Date, default: null },  //set in bpu controller when exp is popped and ready to send to exp creation when mongo creates it
    bc_isLiveSendingToLab: { type: Boolean, default: false },
    liveBpu: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bpu' , default:null},
      name:{ type: String, default: 'default' },
      index: { type: Number, default: -1 },
      socketId: { type: String, default: null },
      socket_getStatusResObj: { type: Object, default: {} }
    },
  
    //Set on bpu and so is not saved 
    bc_timeLeft:{type:Number, default:0},
    exp_eventsToRunFinal:{type: Array, default:[]},
    exp_eventsRan:{type: Array, default:[]},
    
    //Updated in Many Places
    exp_status:{type: String, enum:['created', 'submited', 'queued', 'addingtobpu', 'running', 'servercleared', 'processing', 'failed', 'finished'], default:'created'},
    
    exp_creationTime:{type: Number, default: new Date().getTime() },  //set on creation when mongo creates it
    exp_submissionTime:{type: Number, default: null },                //set on main server when it joins the queue
    exp_resortTime:{type: Number, default: null },                    //set on main server last time the queue resorted
    
    exp_runStartTime:{type: Number, default: null },                  //set on bpu when experiment starts
    exp_runEndTime:{type: Number, default: null },                    //set on bpu when experiment ends
    
    exp_serverClearTime:{type: Number, default: null },               //set on proc server when experiment has been cleared for processing by the server
    exp_processingStartTime:{type: Number, default: null },           //set on proc server when experiment starts processing
    exp_processingScripterStartTime:{type: Number, default: null },             //set on proc server when experiment stops processing
    exp_processingEndTime:{type: Number, default: null },             //set on proc server when experiment stops processing
   
    //Set in Processing script 
    proc_doNotProcess:{type: Boolean, default: false },               //proc set when we don't want to process
    proc_attempts:{type: Number, default: 0 },                        //stat attempts processing
    proc_err:{type: String, default: null },                          //last err for processing

    proc_startPath:{type: String, default: null },                    //set on proc server when exp id was matched in mount data dir.
    
    proc_jpgFiles:{type: Array, default: [] },                        //set on proc server when validating exp data pacakge prior to starting processing
    
    proc_lightDataArrayPath:{type: String, default: null },           //set on proc server when validating exp data location of specical file
    
    proc_expSchemaJsonPath:{type: String, default: null },           //set on proc server when validating exp data location of specical file

    proc_endPath:{type: String, default: null },                      //set on proc server when processing has finished and the tar file is made.
    
    user_tarFilePath:{type: String, default: null },                     //set on clinet server when user attempts first download.
    user_tarFilename:{type: String, default: null },                      //set on clinet server when user attempts first download.
    
    //Not sure if used 
    exp_liveSocketHandle: {type: String, default:null}, 
    exp_liveSocketWaitingForUserHandle: {type: Boolean, default:false}, 

    //new
    stats:{
      scripterPopulation:{ type: Number,  default: -1 },
      scripterActivity:{ type: Number,  default: -1 },
      scripterResponse:{ type: Number,  default: -1 },
    },
  });
  mySchema.plugin(require('./plugins/pagedFind'));
  //Action on Exp
  mySchema.methods.cancel=function(callback) {
    this.isCanceled=true;
    this.exp_status='failed';
    this.save(function(err, dat) {
      if(err) console.log('BpuExperiment methods Schema Cancel Error:'+err);
      if(callback) callback(err, dat);
    });
  };
  mySchema.statics.validate=function(exp) {
    var returnObj={isValid:false, validationErr:null};
    if(exp.exp_eventsToRun===null || exp.exp_eventsToRun===undefined || typeof exp.exp_eventsToRun.forEach!=='function') {  
      returnObj.validationErr='eventsToRun dne in exp doc';
      return returnObj;
    } else if(exp.exp_eventsToRun.length<2) {  
      returnObj.validationErr='must have 2 events';
      return returnObj;
    } else {
      exp.exp_eventsToRun.sort(function(objA, objB) {return objA.time-objB.time;});
      for(var ind=0;ind<exp.exp_eventsToRun.length;ind++) {
        var evt=exp.exp_eventsToRun[ind];
        if(evt!==null && evt!==undefined) {
       
          var err=checkNum(evt.time, 0, 10*60*1000);
          
          if(err===null) {err=checkNum(evt.topValue, 0, 100);
          } else {returnObj.validationErr='time:'+err; break;}

          if(err===null) {err=checkNum(evt.leftValue, 0, 100);
          } else {returnObj.validationErr='topValue:'+err; break;}
          
          if(err===null) {err=checkNum(evt.bottomValue, 0, 100);
          } else {returnObj.validationErr='leftValue:'+err; break;}
          
          if(err===null) {err=checkNum(evt.rightValue, 0, 100);
          } else {returnObj.validationErr='bottomValue:'+err; break;}
          
          if(err!==null) {returnObj.validationErr='rightValue:'+err; break;}
        
        } else {returnObj.validationErr='evt dne'; break;}
      }
      //Check for zero event 
      if(returnObj.validationErr===null) {
        exp.exp_eventsToRun.sort(function(objA, objB) {return objA.time-objB.time;});
        returnObj.exp_eventsRunTime=exp.exp_eventsToRun[exp.exp_eventsToRun.length-1].time;
        if(exp.exp_eventsToRun[0].time!==0) {
          exp.exp_eventsToRun.push({time:0, topValue:0, rightValue:0, bottomValue:0, leftValue:0});
        }
        returnObj.isValid=true;
        returnObj.exp_eventsToRun=exp.exp_eventsToRun;
      }
      return returnObj;
    }
  };

  //Bpu Experiment Objects
  mySchema.statics.getDataObjToJoinQueue=function() {
    return _getDataObjToJoinQueue(app);
  };
  mySchema.methods.getDataObjToSetLeds=function() {
    var thisDoc=this;
    return _getDataObjToSetLeds(thisDoc);
  };
  mySchema.methods.getExperimentTag=function() {
    var thisDoc=this;
    return _getExperimentTag(thisDoc);
  };
  mySchema.plugin(require('./plugins/pagedFind'));
  mySchema.index({user:1});
  mySchema.index({name:1});
  if(app.config) mySchema.set('autoIndex', app.config.isDevelopment);
  app.db.model('BpuExperiment', mySchema);
};
var checkNum=function(num, low, high) {
  if(num!==null && num!==undefined) {
    if(num<0) return 'out of bounds(<'+low+')';
    else if(num>high) return 'out of bounds(>'+high+')';
    else return null;
  } else {
    return 'dne';
  }
};
var _getExperimentTag=function(thisDoc) {
  //Build tag
  var expTag={
    user:{
      id:thisDoc.user.id,
      name:thisDoc.user.name,
      groups:thisDoc.user.groups,
    }, 
    session:{
      id:thisDoc.session.id,
      sessionID:thisDoc.session.sessionID,
      socketID:thisDoc.session.socketID,
    },

    bc_isLiveSendingToLab:thisDoc.bc_isLiveSendingToLab,
    bc_startSendTime:thisDoc.bc_startSendTime,

    group_experimentType:thisDoc.group_experimentType,
    exp_wantsBpuName:thisDoc.exp_wantsBpuName,
    
    exp_metaData:{},
    
    id:thisDoc._id,
    exp_sessionID:thisDoc.sessionID,
    exp_status:thisDoc.exp_status,
    exp_submissionTime:thisDoc.exp_submissionTime,
    exp_eventsRunTime:thisDoc.exp_eventsRunTime,
    exp_lastResort:{
      canidateBpus:thisDoc.exp_lastResort.canidateBpus,
      rejectionCounter:thisDoc.exp_lastResort.rejectionCounter,
      rejectionReason:thisDoc.exp_lastResort.rejectionReason,
      bpuName:thisDoc.exp_lastResort.bpuName,
      runTime:thisDoc.exp_lastResort.runTime,
      bpuProcessingTime:thisDoc.exp_lastResort.bpuProcessingTime, 
      totalWaitTime:thisDoc.exp_lastResort.totalWaitTime,       
    }
  };
  if(thisDoc.exp_metaData.soapID!==null && thisDoc.exp_metaData.soapID!==undefined) {
    expTag.exp_metaData.soapID=thisDoc.exp_metaData.soapID;
  }
  return expTag;
};
var _getDataObjToJoinQueue=function(app) {
  var joinQueueData={
    user:{
      id:null, 
      name:null,
      groups:null,
    },
    session:{
      id:null,
      sessionID:null,
      socketID:null,
    },
    group_experimentType:null,
    exp_wantsBpuName:null,
    
    exp_eventsToRun:[],
    exp_metaData:{},
    
    liveUserLabTime:app.mainConfig.liveUserLabTime,
    zeroLedEvent:{time:0, topValue:0, rightValue:0, bottomValue:0, leftValue:0}
  };
  return joinQueueData;
};
var _getDataObjToSetLeds=function() {
  var setLedsData={
    time:null, topValue:null, rightValue:null, bottomValue:null, leftValue:null,
    metaData:{
      clientTime:null,  //set when event need a new setLedsDataObbect
      sentTime:null,    //time when sent to server through socket io
      
      intensity:null, degs:null, rads:null, x:null, y:null, //values from joystick while figuring position
      
      layerX:null, layerY:null,   //used for all events, light value set events are converted to xy
      
      className:null,  clientX:null, clientY:null,  //only set for browser events
      
      evtType:null,           //should be mouse input browser event OR is a set from light value which could be a keyboard event
      touchState:null, previousTouchState:null,
    }
  };
  return setLedsData;
};
