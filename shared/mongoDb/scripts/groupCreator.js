var fs=require('fs');
var async=require('async');
var mongoose=require('mongoose');

var app={};
app.db=null;
app.config={
  isDevelopment:false,
  mongoUri:'mongodb://localhost:27017/',
};
if(app.config.isDevelopment) {
  app.config.mongoUri+='dev';
} else {
  app.config.mongoUri+='production';
}
app.config.loginAttempts = {
  forIp: 50,
  forIpAndUser: 7,
  logExpiration: '20m'
};
app.get=function() {
  return 'development';
};

var setupDatabase=function(callback) {
  console.log('setupDatabase', app.config.mongoUri);
  app.db=mongoose.createConnection(app.config.mongoUri);
  app.db.on('error', function(err) {
    callback('setupDatabase err:'+err);
  });
  app.db.once('open', function () {
    require('../schema/models')(app, mongoose);
    callback(null);
  });
};

var outcome={};
var getMongoGroups=function(callback) {
  app.db.models.Group.find({}, {}, '', function(err, groups) {
    if(err) {
      callback(err);
    } else {
      console.log('mongoGroups.length', groups.length);
      outcome.mongoGroups=groups;
      callback(null);
    }
  });
};
var getJsonGroups=function(callback) {
  outcome.jsonGroups=require('./GroupConfig.json');
  callback(null);
};
var mergeMongoJsonGroups=function(callback) {
  outcome.mergeGroups={};
  outcome.mongoGroups.forEach(function(mg) {
    console.log(mg._id, mg.name);
    if(outcome.mergeGroups[mg.name]) {
      if(outcome.mergeGroups[mg.name].mongo) {
        outcome.mergeGroups[mg.name].mongo=mg;
        outcome.mergeGroups[mg.name].mongoCount+=1;
      } else {
        outcome.mergeGroups[mg.name].mongo=mg;
      }
    } else {
      outcome.mergeGroups[mg.name]={mongo:mg, json:null};
      outcome.mergeGroups[mg.name].mongoCount=1;
      outcome.mergeGroups[mg.name].jsonCount=0;
    }
  });
  outcome.jsonGroups.forEach(function(jg) {
    if(outcome.mergeGroups[jg.name]) {
      if(outcome.mergeGroups[jg.name].json) {
        outcome.mergeGroups[jg.name].json=jg;
        outcome.mergeGroups[jg.name].jsonCount+=1;
      } else {
        outcome.mergeGroups[jg.name].json=jg;
      }
    } else {
      outcome.mergeGroups[jg.name]={mongo:null, json:jg};
      outcome.mergeGroups[jg.name].mongoCount=0;
      outcome.mergeGroups[jg.name].jsonCount=1;
    }
  });
  callback(null);
};
var saveNewJsonGroupsToMongo=function(callback) {
  var keys=Object.keys(outcome.mergeGroups);
  var next=function() {
    if(keys.length>0) {
      var key=keys.shift();
      var grp=outcome.mergeGroups[key];
      if(grp.mongo===null) {
        var newGrp=app.db.models.Group();
        newGrp.name=grp.json.name;
        newGrp.description=grp.json.description;
        newGrp.save(function(err) {
          console.log('save new group '+'err:'+err+' '+newGrp.name);
          next();
        });
      } else {
        next();
      }
    } else {
      callback(null);
    }
  }; 
  next();
};

var asyncFinally=function(err) {
  console.log('asyncFinally err:', err);
};

async.waterfall([
  setupDatabase,
  getMongoGroups,
  getJsonGroups,
  mergeMongoJsonGroups,
  saveNewJsonGroupsToMongo,
], asyncFinally);


var rebuildGroups=function(callback) {
  console.log('');
  app.db.models.User.find({}, {groups:1, username:1}, '', function(err, users) {
    if(err) {
      console.log('rebuildGroups User.find err:'+err);
    } else {
      GroupConfig.forEach(function(grp) {
        users.forEach(function(user) {
          user.groups.forEach(function(usrgrp) {
            if(usrgrp===grp.name) {
              grp.users.push(user.username);
            }
          });
        });
      });
      app.db.models.Group.find({}, {name:1, users:1, settings:1}, '', function(err, groups) {
        if(err) {
          console.log('rebuildGroups Group.find err:'+err);
        } else {
          var jsonGroups=JSON.parse(JSON.stringify(GroupConfig));
          var next=function() {
            if(jsonGroups.length>0) {
              var jsonGroup=jsonGroups.shift();
              var saveGroup=app.db.models.Group();
              groups.forEach(function(item) {
                if(item.name===jsonGroup.name) {
                  saveGroup=item;
                }
              });
              Object.keys(jsonGroup).forEach(function(item) {
                saveGroup[item]=jsonGroup[item];
              });
              saveGroup.save(function(err) {
                console.log('rebuildGroups saveGroup:'+saveGroup.name+', '+'users:'+saveGroup.users+', err:'+err);
                next();
              });
            } else {
              callback();
            }
          };
          next();
        }
      });
    }
  });
};

