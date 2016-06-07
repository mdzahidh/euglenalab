var async=require('async');
var mongoose=require('mongoose');

var mainConfig=require('../../mainConfig.js');
var myMongoUri=mainConfig.adminFlags.getMongoUri();
var myServerPort=mainConfig.adminFlags.getServerPort();
var myServerAddr=mainConfig.adminFlags.getServerAddr();

var app={};
app.db=null;
//Stuff to setup mongoose with db models
var log4js=require('log4js');
app.config={
  isDevelopment:true,
  mongoUri:myMongoUri,
};
app.get=function() {
  return 'development';
};
app.config.loginAttempts = {
  forIp: 50,
  forIpAndUser: 7,
  logExpiration: '20m'
};
app.log4js=log4js;

//Generic funcs
app.clearConsole=function() {
  console.log('\033c');
};
app.setLength=function(str, length) {
  if(str.length>length) {
    while(str.length>length) str=str.substr(0, str.length-1);
  } else if(str.length<length) {
    while(str.length<length) str=' '+str;
  }
  return str;

};

//Init
app.init=function(mainCallback) {
  outcome={
    doClear:true,
    method:'init',
    errs:[],
    msgs:[],
  };
  var setupDatabase=function(callback) {
    app.db=mongoose.createConnection(app.config.mongoUri);
    app.db.on('error', function(err) {
      outcome.errs.push('setupDatabase:'+'mongoose connection err:'+err);
      return callback(null);
    });
    app.db.once('open', function () {
      require('../schema/models')(app, mongoose);
      return callback(null);
    });
  };
  var asyncFinally=function(err) {
    if(outcome.errs.length>0) {
    } else {
      outcome.msgs.push('init okay');
      setTimeout(mainCallback, 1000);
    }
  };
  async.waterfall([
    setupDatabase,
  ], asyncFinally);
};

//Run Loop
app.run=function(mainCallback) {
  var outcome={
    listsObj:null,
  };
  var checkListExperiments=function(callback) {
    app.db.models.ListExperiment.getInstanceDocument(function(err, listExperiment) {
      if(err) {
        outcome.errs.push('checkListExperiments:'+'find err:'+err);
        return callback(err);
      } else {
        outcome.listsObj=listExperiment.toObject();
        return callback(null);
      }
    });
  };
  var printListObj=function(callback) {
    app.clearConsole();
    console.log(new Date(), 'mongo uri:'+myMongoUri);
    var printLine=function(bpuCnt, subCnt, bpuName, tag) {
      if(tag.user===null || tag.user===undefined) {
        tag.user={
          name:'dne'
        };
      }
      var finishTime='dne';
      var bpuStrings=[]; 
      if(tag.exp_lastResort===null || tag.exp_lastResort===undefined) {
        tag.exp_lastResort={
          canidateBpus:[],
          rejectionCounter:'dne',
          rejectionReason:'dne',
          runTime:'dne',
          bpuProcessingTime:'dne'
        };
      } else {
        tag.exp_lastResort.canidateBpus.forEach(function(bpuScoreObj) {
          var bpuStr=bpuScoreObj.bpuName+'-';
          bpuStr+=app.setLength(''+bpuScoreObj.finalScore, 6)+' (';
          bpuStr+=bpuScoreObj.population+'-'    +app.setLength(''+bpuScoreObj.alphaPopulation, 6) +', ';
          bpuStr+=bpuScoreObj.activity+'-'      +app.setLength(''+bpuScoreObj.alphaActivity, 6)   +', ';
          bpuStr+=bpuScoreObj.response+'-'      +app.setLength(''+bpuScoreObj.alphaResponse, 6)   +', ';
          bpuStr+=bpuScoreObj.queueWaitTime+'-' +app.setLength(''+bpuScoreObj.alphaTime, 6)       +') ';
          bpuStrings.push(bpuStr);
        });
      }
      console.log();
      var timeInQueue=(new Date().getTime()-new Date(tag.exp_submissionTime).getTime());
      console.log(
        app.setLength(''+bpuCnt,                                        'bpuCnt'.length)        +' '+
        app.setLength(''+subCnt,                                        'subCnt'.length)        +' '+
        app.setLength(''+bpuName,                                       'bpuName'.length)       +' '+
        app.setLength(''+tag.user.name,                                 'username'.length)      +' '+
        app.setLength(''+tag.exp_wantsBpuName,                          'wantBpu'.length)       +' '+
        app.setLength(''+tag.exp_status,                                '    status'.length)    +' '+
        app.setLength(''+tag.group_experimentType,                      'type'.length)          +' '+
        app.setLength(''+tag.exp_lastResort.rejectionCounter,           'rejCnt'.length)        +' '+
        app.setLength(''+tag.exp_lastResort.rejectionReason,            'rejReason'.length)     +' '+
        app.setLength(''+tag.exp_lastResort.runTime,                    'runTime'.length)       +' '+
        app.setLength(''+tag.exp_lastResort.totalWaitTime,              'totalWaitTime'.length) +' '+
        app.setLength(''+timeInQueue,                                   '      timeInQueue'.length) +' '+
        ''
        );
      bpuStrings.forEach(function(bpuScore) {
        console.log('\t'+'score:'+'\t'+bpuScore);
      });
    };
    //Loop through list
    var cnt=0;
    console.log(
      'bpuCnt'+' '+
      'expCnt'+' '+
      'bpuName'+' '+
      'username'+' '+
      'wantBpu'+' '+
      '    status'+' '+
      'type'+' '+
      'rejCnt'+' '+
      'rejReason'+' '+
      'runTime'+' '+
      'totalWaitTime'+' '+
      '      timeInQueue'+' '+
      ''
      );
    Object.keys(outcome.listsObj).forEach(function(key) {
      //if array
      if(outcome.listsObj[key].forEach!==undefined && outcome.listsObj[key].forEach!==null && outcome.listsObj[key].length>0) {
        cnt++;
        var subCnt=0;
        outcome.listsObj[key].forEach(function(tag) {
          subCnt++;
          printLine(cnt, subCnt, key, tag);
        });
      }
    });
    return callback(null);
  };
  var asyncFinally=function(err) {
    setTimeout(mainCallback, 1000);
  };
  async.waterfall([
    checkListExperiments,
    printListObj
  ], asyncFinally);
};

//Start Sequence
app.init(function() {
  var reloop=function() {
    app.run(function() {
      console.log('reloop');
      reloop(); 
    });
  };
  reloop();
});

