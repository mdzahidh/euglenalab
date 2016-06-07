exports = module.exports = function(app, mongoose) {
  return new mongoose.Schema({
    //State
    isOn: { type:Boolean, default: false },
    bpuStatus:{type: String, enum:[
      'initializing', 'initializingFailed', 'initializingDone', 
      'pendingRun', 'running', 'runningFailed', 
      'finalizing', 'finalizingFailed', 'finalizingDone', 
      'reseting', 'resetingFailed', 'resetingDone'], default:'initializing'},
    
    //ID 
    index: { type: Number, default: -1 },
    name: { type: String, default: 'default' },
    
    //Constant Info
    magnification: { type: Number, default: 10 },
    allowedGroups: { type: Array, default: ['all'] },
    localAddr: { 
      ip: { type: String, default: 'default' },
      serverPort: { type: String, default: 'default' },
      webcamPort: { type: String, default: 'default' },
    }, 
    publicAddr: { 
      ip: { type: String, default: 'default' },
      serverPort: { type: String, default: 'default' },
      webcamPort: { type: String, default: 'default' },
      allowedPorts: { type: Array, default: [] },
    },
    
    bpu_processingTime:{ type: Number, default: 60000 },

    //user data Set for active experiment
    session: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
      sessionID: { type: String, default: '' },
      socketID: { type: String, default: '' },
    },
    
    //Active Exp Data-set in bpucontroller on get status
    liveBpuExperiment: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'BpuExperiment' },
      group_experimentType:{type: String, enum:['live', 'text'], default:'text'},
      bc_timeLeft:{type:Number, default:0},
      sessionID:{type:String, default:null},
      username:{type:String, default:null},
    },

    //running notes
    notes: [mongoose.modelSchemas.Note],

    //Bpu Scripts 
    performanceScores: { 
      WindowLambdaMs:{ type: Number, default: 5*60*60*1000 },
      
      bc_lastSendDate: { type: Number, default: new Date(0).getTime() },
      pc_lastUpdateDate: { type: Number, default: new Date(0).getTime() },
      
      scripterPopulation: { type: Number, default: 0 },
      scripterPopulationDate: { type: Number, default: new Date(0).getTime() },
      scripterActivity: { type: Number, default: 0 },
      scripterActivityDate: { type: Number, default: new Date(0).getTime() },
      scripterResponse: { type: Number, default: 0 },
      scripterResponseDate: { type: Number, default: new Date(0).getTime() }
    },
    pastPerformanceScores: { type: Array, default: [] },
 
    //Flush Object
    flushData: {
      lastFlushDate: { type: Date, default: new Date(0) },
      flushDates: { type: Array, default: [] },
    },

    populationPastScores: { type: Array, default: [] },
    activityPastScores: { type: Array, default: [] },
    responsePastScores: { type: Array, default: [] },

    timeFrameInMinutesForScripts: { type: Number, default: 24*60 },  
    timeFrameInMinutesForPlots: { type: Number, default: 5*24*60 },  

    populationScore: { type: Number, default: 0 },
    activityScore: { type: Number, default: 0 },
    responseScore: { type: Number, default: 0 },
    avgStatsData: { type: Array, default: [] },
  });
};
