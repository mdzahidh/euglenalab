var fs=require('fs');
var async=require('async');
var mongoose=require('mongoose');
var BpuTestLightData=require('./testLightUserData.json');

var app={};
app.db=null;
app.config={
  isDevelopment:false,
  mongoUri:'mongodb://localhost:27017/drywall-client',
};
if(app.config.isDevelopment) {
  app.config.mongoUri+='-dev';
}
app.get=function() {
  return 'development'
}

app.init=function(mainCallback) {
  var theList=null;
  var newExpTagsToAdd=[];
  var setupDatabase=function(callback) {
    app.db=mongoose.createConnection(app.config.mongoUri);
    app.db.on('error', function(err) {
      return callback('setupDatabase:'+'mongoose connection err:'+err);
    });
    app.db.once('open', function () {
      require('./models')(app, mongoose);
      return callback(null);
    });
  };
  var getListExperiments=function(callback) {
    app.db.models.ListExperiment.find(function(err, listDocs) {
      if(err) {
        return callback('checkListExperiments:'+'find err:'+err);
      } else if(listDocs.length===0) {
        var newList=app.db.models.ListExperiment();
        newList.save(function(err, dat) {
          if(err) {
            return callback('checkListExperiments:'+'save new err:'+err);
          } else {
            theList=newList;
            return callback(null);
          }
        }); 
      } else {
        theList=listDocs[0];
        return callback(null);
      }
    });
  };
  var addToBpuExperiments=function(callback) { 
    BpuTestLightData.sort(function(a, b) {return b.time-a.time;});
    var numToAdd=1;
    var buildNewAndSave=function() {
      if(numToAdd>0) {
        numToAdd--;
        var newExpDoc=app.db.models.BpuExperiment();
        var randInt=getRandomIntInclusive(1000, 2000)
        var randId=new Date().getTime()+''+randInt;
        newExpDoc.expId=newExpDoc._id; 
        newExpDoc.username=randInt; 
        newExpDoc.sessionID=randId; 
        newExpDoc.socketID=randId;
        newExpDoc.isLive=false; 
        newExpDoc.isAuto=false; 
        newExpDoc.isArray=true; 
        newExpDoc.eventsToRun=BpuTestLightData;
        if(true) {
          newExpDoc.usergroups=['nwg'];
          if(numToAdd===0) {
            newExpDoc.username='123456';
          }
        } 
        newExpDoc.bpuInfo={
          useBpu:'',
        };
        newExpDoc.experimentInfo.runTime=BpuTestLightData[0].time;
        newExpDoc.save(function(err, dat) {
          if(err) {
            console.log('save new exp err:', err);
          } else {
            var tag={
              expTime:dateFromObjectId(''+newExpDoc._id), 
              username:newExpDoc.username, 
              expId:''+newExpDoc._id, 
              runTime:newExpDoc.experimentInfo.runTime
            };
            newExpTagsToAdd.push(tag);
          }
          buildNewAndSave();
        }); 
      } else {
        newExpTagsToAdd.forEach(function(item) {
          theList.newExps.push(item);
        });
        theList.save(function(err, dat) {
          callback(err);
        });
      }
    };
    buildNewAndSave();
  };
  var asyncFinally=function(err) {
    console.log('err:', err);
    console.log('theList:', theList.newExps.length);
    console.log('newExpTagsToAdd:', newExpTagsToAdd.length);
  };
  async.waterfall([
    setupDatabase,
    getListExperiments,
    addToBpuExperiments,
  ], asyncFinally);
};
app.init();
//Funcitons
var getRandomIntInclusive=function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
var dateFromObjectId=function(objectId) {
  return new Date(parseInt(objectId.substring(0, 8), 16) * 1000);
};
