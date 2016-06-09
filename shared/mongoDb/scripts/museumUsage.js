var fs=require('fs');
var async=require('async');
var mongoose=require('mongoose');

var mainConfig=require('../../mainConfig.js');
var myMongoUri=mainConfig.adminFlags.getMongoUri();
var myServerPort=mainConfig.adminFlags.getWebServerPort();
var myServerAddr=mainConfig.adminFlags.getWebServerAddr();
myMongoUri='mongodb://localhost:27017/'+'production';
var app={};
app.db=null;
app.config={
  isDevelopment:true,
  mongoUri:myMongoUri,
};
app.get=function() {
  return 'development'
}
app.config.loginAttempts = {
  forIp: 50,
  forIpAndUser: 7,
  logExpiration: '20m'
};
app.clearConsole=function() {
  console.log('\033c');
};

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

var filter={
  age:'day',
  intervalValue:5, //age:min 10 minutes age:hour 10 hours
};
app.run=function(mainCallback) {
  var username='dirk_joystick';
  var outcome={
    avgUseStats:[],
  };
  var getUserAvgUseStats=function(callback) {
    app.db.models.User.findByName(username, function(err, user) {
      if(err) {
        outcome.errs.push('checkListExperiments:'+'find err:'+err);
        return callback(err);
      } else {
        outcome.avgUseStats=user.avgUseStats;
        return callback(null);
      }
    });
  };
  var printUserAvgUseStats=function(callback) {
    app.clearConsole();
    console.log('mongo uri:'+myMongoUri, ', stats length:'+outcome.avgUseStats.length);
    console.log();
    console.log('Pacific\t', new Date().toLocaleString());
    console.log('Museum\t', new Date(new Date().getTime()+9*(60*60*1000)).toLocaleString());
    console.log();
    var roundNum=function(value, decPlaces) {
      if(decPlaces===0) {
        return Math.round(value);
      } else {
        var div=decPlaces*10;
        var num=Math.round(div*(Number(value)*60))/div;
        var str=''+num;
        var parts=str.split('.');
        var decs=parts[parts.length-1];
        var sft=0;
        while(decs.length<decPlaces) {
          sft++;
          decs+='0';
          if(sft>100) {
            break;
          }
        }
        decs+='0';
        decs+='0';
        decs+='0';
        decs=decs.substr(0, decPlaces);
        str=parts[0]+'.'+decs;
        return str;
      }
    };
    var previousValue=null;
    var firstTimeNow=new Date();
    var printLine=function(cnt, key, value) {
      var timeDiv=60*60*1000
      var timeAgo=roundNum((firstTimeNow-value.startDate)/timeDiv, 0);
      var strDate=new Date(value.startDate.getTime()+9*(60*60*1000));
      console.log(cnt+'\t\t'+timeAgo+'\t\t\t'+value.funcCounter+'\t\t'+strDate.toLocaleString()+'\t\t'+value.startDate.toLocaleString());
    };
    var header='cnt'+
      '\t\t'+'Hours Ago'+
      '\t\t'+'Func Calls'+
      '\t'+'Museum Time'+
      '\t\t\t'+'Pac Time';
    console.log(header);
    var cnt=0;
    outcome.avgUseStats.sort(function(a, b) {return b.startDate-a.startDate;});
    var timeNow=new Date();
    Object.keys(outcome.avgUseStats).forEach(function(key) {
      var value=outcome.avgUseStats[key];
      if(value!==undefined && value!==null) {
        if(value.startDate!==undefined && value.startDate!==null) {
          if(value.funcCounter>0) {
            if(filter.age==='min') {
              cnt++;
              if(value.startDate>(timeNow-filter.intervalValue*60*1000)) {  
                printLine(cnt, key, value);
              }
            } else if(filter.age==='hour') {
              cnt++;
              if(value.startDate>(timeNow-filter.intervalValue*60*60*1000)) {  
                printLine(cnt, key, value);
              }
            } else if(filter.age==='day') {
              cnt++;
              if(value.startDate>(timeNow-filter.intervalValue*24*60*60*1000)) {  
                printLine(cnt, key, value);
              }
            } else {
              cnt++;
              printLine(cnt, key, value);
            }
          }
        }
      }
    });
    return callback(null);
  };
  var asyncFinally=function(err) {
    setTimeout(mainCallback, 1000);
  };
  async.waterfall([
    getUserAvgUseStats,
    printUserAvgUseStats
  ], asyncFinally);
};

app.init(function() {
  var reloop=function() {
    app.run(function() {
      console.log('reloop');
      reloop(); 
    });
  };
  reloop();
});

