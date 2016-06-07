'use strict';

exports = module.exports = function(app, mongoose) {
  var myShema = new mongoose.Schema({
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: '' },
      socketID: { type: String, default: '' },
      sessionID: { type: String, default: '' },
    },
    didRun:{type:Boolean, default:false},
    bpuData:{
      username: { type: String, default: '' },
      usergroups: { type: Array, default: [] },
      usergroup: { type: String, default: '' },
      
      expId: { type: String, default: '' },
      useBpu: { type: String, default: '' },
      data:{ type: Array, default: [] },
     
      isLive: { type: Boolean, default: false },
      isAuto: { type: Boolean, default: false },
      doSkipAuto: { type: Boolean, default: false },
      autoType: { type: String, default: '' },
      
      bpuName:{ type: String,  default: '' },
      
      startTime:{ type: Number, default: 0 },
      runTime:{ type: Number, default: 0 },
      timeLeft:{ type: Number, default: 0 },
      endRunDate:{ type: Number,  default: 0 },
      collectionDate:{ type: Number,  default: 0 },

      dataPath: { type: String, default: '' },
      dataFileName:{ type: String,  default: '' },
      dataParentFolder:{ type: String,  default: '' },
      bpuNameFromBpu:{ type: String,  default: '' },
      wasLightDataSaved:{ type: String,  default: '' },
      
      expStatus:{ type: String,  default: '' },
      msg: { type: String, default: '' },
      
      stats:{
        pop1:{ type: Number,  default: -1 },
        act1:{ type: Number,  default: -1 },
        res1:{ type: Number,  default: -1 },
      },
    },
    msg: { type: String, default: '' },
    dataPath: { type: String, default: '' },
    dataFileName:{ type: String,  default: '' },
    dataParentFolder:{ type: String,  default: '' },
    bpuName:{ type: String,  default: '' },
    endRunDate:{ type: Date,  default: new Date() },
    pop1:{ type: String,  default: '' },

    useBpu:{ type: String,  default: null },
    
    cameraIP:{ type: Number,  default: 0 },
    serverPort:{ type: Number,  default: 0 },
    bpuNameFromMain:{ type: String,  default: '' },
  });
  myShema.plugin(require('./plugins/pagedFind'));
  myShema.index({ user: 1 });
  myShema.index({ name: 1 });
  myShema.set('autoIndex', (app.get('env') === 'development'));
  app.db.model('Experiment', myShema);
};
