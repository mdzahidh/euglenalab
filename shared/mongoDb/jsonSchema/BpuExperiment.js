var exports = module.exports = {
  _id:new Date().getTime(),
  expId:'',
  username:'',
  usergroups:['default'],
  
  isLive:false,
  isArray:false,
  isAuto:false,
  
  eventsToRun:[],
  eventsRan:[],
  
  bpuInfo: {
    nameBpu:'',
  }, 

  groupSettings: {
    doSaveImages:false,
    doSaveLightData:false,
    doMakeVideo:false,
    doAllowTextFile:false,
    doAllowScript:false,
  },
 
  debugSettings: {
    doFakeLeds:false,
    doFakeScripts:false,
    doRandScripts:false,
    doFakeBpu:false,
    doFakeCamera:false,
  },
  experimentInfo: { 
    creationDate:null,

    startTime:0,
    runTime:0,
    endRunDate:new Date(),
    
    collectionDate:new Date(),
    dataPath:'',
    dataFileName:'',
    dataParentFolder:'',
    
    hasLightDataJson:false,
    hasExpDataJson:false,
    hasImages:false,
    hasStats:false,
  },
  stats:{
    population:-1,
    activity:-1,
    response:-1,
  },
};
