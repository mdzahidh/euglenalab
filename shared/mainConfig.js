var deployment = require('../deployment');

var g_DbName         = deployment[deployment.mode].db;
var g_WebserverPort  = deployment[deployment.mode].webserver.port;
var g_WebserverIdent = deployment[deployment.mode].webserver.ident;
var g_WebserverName  = deployment[deployment.mode].webserver.name;
var g_ControllerPort = deployment[deployment.mode].controller.port;
var g_liveLabTime    = deployment[deployment.mode].liveLabTime;
var g_liveMuseumTime = deployment[deployment.mode].liveMuseumLabTime;
var g_publicIP       = deployment[deployment.mode].publicIP;

var exports=module.exports={
  adminFlags:{
    getMongoUri:function() {
      return 'mongodb://localhost:27017/'+g_DbName;
    },
    getWebServerPort:function() {
        return g_WebserverPort;
    },
    getControllerPort:function() {
        return g_ControllerPort;
    },
    getWebServerAddr:function() {
      return 'http://'+'localhost'+':'+this.getWebServerPort();
    },
    getWebServerIdentifier:function() {
        return g_WebserverIdent;
    },
    getWebServerName: function() {
        return g_WebserverName;
    }
  },

  socketStrs:{
    bpu_ping:'/bpu/#ping',
    bpu_getStatus:'/bpu/#getStatus',
    bpu_setExp:'/bpu/#setExp',
    bpu_runExp:'/bpu/#runExp',
    bpu_runExpLedsSet:'/bpu/runExp/#ledsSet',
    bpu_resetBpu:'/bpu/#resetBpu',
    bpuCont_submitExperimentRequest:'/bpuCont/#submitExperimentRequest',
  },
  livejoylab_bpuSocketStrings:{
    bpu_runExpLedsSet:'/bpu/runExp/#ledsSet',
  },
  livejoylab_userSocketStrings:{
    user_setConnection:'/#setConnection',
    user_ping:'/#ping',
    user_ledsSet:'/#ledsSet',
  },
  userSocketStrs:{
    user_setConnection:'/#setConnection',
    user_serverError:'/#serverError',
    user_ping:'/#ping',
    user_ledsSet:'/#ledsSet',
    user_reconPing:'/#reconPing',
    user_updateBpus:'/#updateBpus',
    user_submitExperimentRequest:'/#submitExperimentRequest',
    user_activateLiveUser:'/#activateLiveUser',
    user_sendUserToLiveLab:'/#sendUserToLiveLab',
    user_kickFromLab:'/#kickFromLab',                           //General Purpose
  },

  clearUserListOnStart:false,
  maxUsersInList:500,
  activeSocketsExpSubTimeout:60*5*1000,
  maxTextFileTime:60*10*1000,
  minTextFileTime:4*1000,
  maxTextTotalSubmits:4,
  maxTextTotalSumbitTime:60*40*1000,
  liveMuseumUserLabTime:g_liveMuseumTime,
  liveUserLabTime:g_liveLabTime,

  mainServerData:'/myData/mServer/',

  BpuAutoLightData:require('./autoUserData.json'),
  BpuTestLightData:require('./testLightUserData.json'),

  moveBpuDataFolders:{
    bpuDbFolder:'/myData/bpu/readyMongo',
    bpuTarFolder:'/myData/bpu/tars',
    localBpuDbDump:'/home/mserver/git/euglenalab/datadump',
    localTarFolder:'/myData/mServer',
  },

  LoggerLevels:{ALL:0, TRACE:1, DEBUG:2, INFO:3, WARN:4, ERROR:5, FATAL:6, OFF:7},

  bpuStatusTypes:{
    initializing:'initializing',
    initializingDone:'initializingDone',
    initializingFailed:'initializingFailed',
    pendingRun:'pendingRun',
    running:'running',
    runningDone:'runningDone',
    runningFailed:'runningFailed',
    finalizing:'finalizing',
    finalizingDone:'finalizingDone',
    finalizingFailed:'finalizingFailed',
    reseting:'reseting',
    resetingDone:'resetingDone',
    resetingFailed:'resetingFailed',
    offline:'offline',
  },
  mServer:{
    name:'open_main_server',
    localAddr:{
      ip:'192.168.1.100',
      serverPort:3100,
    },
    publicAddr:{
      ip:g_publicIP,
      ip2:'171.65.102.112',
      serverPort:80,
    },
  },
  bpus:[
    {
      index:0,
      name:'eug0',
      description: 'batch 1 bpu mics, 10x, 4 leds, static thor labs bg light',
      type: 'batch 1 bpu mics',
      magnification:10,
      backgroundLighting: 'white',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by arduino',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:false,
      isArduino:false,
      localAddr:{
        ip:'192.168.1.200',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20001,
        webcamPort:20000,
        allowedPorts:[20000, 20001, 20002, 20003, 20004],
      },
    },
    {
      index:1,
      name:'eug1',
      description: 'batch 1 bpu mics, 10x, 4 leds, static thor labs bg light',
      type: 'batch 1 bpu mics',
      magnification:10,
      backgroundLighting: 'white',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by arduino',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:false,
      isArduino:false,
      maxLightIntentisy:1, //percent of lightValues used on leds.js
      localAddr:{
        ip:'192.168.1.201',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20006,
        webcamPort:20005,
        allowedPorts:[20005, 20006, 20007, 20008, 20009],
      },
      mainServerBpuData:'/myData/bpus',
    },
    {
      index:2,
      name:'eug2',
      description: 'batch 1 bpu mics, 10x, 4 leds, static thor labs bg light',
      type: 'batch 1 bpu mics',
      magnification:10,
      backgroundLighting: 'green',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by arduino',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:false,
      isArduino:false,
      maxLightIntentisy:1, //percent of lightValues used on leds.js
      localAddr:{
        ip:'192.168.1.202',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20011,
        webcamPort:20010,
        allowedPorts:[20010, 20011, 20012, 20013, 20014],
      },
    },
    {
      index:3,
      name:'eug3',
      description: 'batch 1 bpu mics, 4x, 4 leds, static thor labs bg light',
      type: 'batch 1 bpu mics',
      magnification:4,
      backgroundLighting: 'white',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by arduino',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:false,
      isArduino:false,
      maxLightIntentisy:1, //percent of lightValues used on leds.js
      localAddr:{
        ip:'192.168.1.203',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20016,
        webcamPort:20015,
        allowedPorts:[20015, 20016, 20017, 20018, 20019],
      },
    },
    {
      index:15,
      name:'eug15',
      description: 'batch 2.0 bpu mics, 4x, 4 leds, static led diffuser',
      type: 'batch 2.0 bpu mics',
      magnification:4,
      backgroundLighting: 'white width filter',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by rasppi',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:false,
      isArduino:false,
      maxLightIntentisy:1, //percent of lightValues used on leds.js
      localAddr:{
        ip:'192.168.1.215',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20076,
        webcamPort:20075,
        allowedPorts:[20075, 20076, 20077, 20078, 20079],
      },
    },
    {
      index:16,
      name:'eug16',
      description: 'batch 2.0 bpu mics, 10x, 4 leds, static led diffuser',
      type: 'batch 2.0 bpu mics',
      magnification:10,
      backgroundLighting: 'white width filter',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by rasppi',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:false,
      isArduino:false,
      maxLightIntentisy:1, //percent of lightValues used on leds.js
      localAddr:{
        ip:'192.168.1.216',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20081,
        webcamPort:20080,
        allowedPorts:[20080, 20081, 20082, 20083, 20084],
      },
    },
    {
      index:18,
      name:'eug18',
      description: 'batch 2.0 bpu mics, 10x, 4 leds, static led diffuser',
      type: 'batch 2.0 bpu mics',
      magnification:10,
      backgroundLighting: 'white width filter',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by rasppi',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:true,
      isArduino:false,
      maxLightIntentisy:1, //percent of lightValues used on leds.js
      localAddr:{
        ip:'192.168.1.218',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20091,
        webcamPort:20090,
        allowedPorts:[20090, 20091, 20092, 20093, 20094],
      },
    },
    {
      index:19,
      name:'eug19',
      description: 'batch 2.0 bpu mics, 10x, 4 leds, static led diffuser',
      type: 'batch 2.0 bpu mics',
      magnification:10,
      backgroundLighting: 'white width filter',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by rasppi',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:true,
      isArduino:false,
      maxLightIntentisy:1, //percent of lightValues used on leds.js
      localAddr:{
        ip:'192.168.1.219',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20096,
        webcamPort:20095,
        allowedPorts:[20095, 20096, 20097, 20098, 20099],
      },
    },
    {
      index:20,
      name:'eug20',
      description: 'batch 2.0 bpu mics, 10x, 4 leds, static led diffuser',
      type: 'batch 2.0 bpu mics',
      magnification:10,
      backgroundLighting: 'white width filter',
      stimulusType: '4leds',
      stimulusDescription: '4 leds controls by rasppi',
      allowedGroups: ['admin', 'default', 'scripter', 'nwg', 'golabz'],
      isOn:true,
      isArduino:false,
      maxLightIntentisy:1, //percent of lightValues used on leds.js
      localAddr:{
        ip:'192.168.1.220',
        serverPort:8090,
        webcamPort:8080,
      },
      publicAddr:{
        ip:g_publicIP,
        serverPort:20101,
        webcamPort:20100,
        allowedPorts:[20100, 20101, 20102, 20103, 20104],
      },
    },
  ],
};
