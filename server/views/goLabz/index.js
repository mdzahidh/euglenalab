'use strict';
var exec=require('child_process').exec;
var tmp=require('tmp'); 
var async=require('async'); 
var fs=require('fs'); 
exports.init=function(req, res, next) {
  var outcome={};
  outcome.sess=null;
  var getSessionData = function(callback) {
    if(req.sessionID===null || req.sessionID===undefined) {
      return callback('not authorized. no sessionid');
    } else {
      req.app.db.models.Session.findOne({sessionID:req.sessionID}, {}, function(err, session) {
        if(err) {
          return callback('getSessionData err:'+err);
        } else if(session===null || session===undefined) {
          return callback('getSessionData session is dne');
        } else {
          outcome.sess=session;
          return callback(null);
        }
      });
    }
  };
  outcome.user=null;
  var getUserData = function(callback) {
    req.app.db.models.User.findOne({username:'golabz'}, {}, function(err, user) {
      if(err) {
        return callback('getUserData err:'+err);
      } else if(user===null || user===undefined) {
        return callback('getUserData user is dne');
      } else {
        outcome.user=user;
        return callback(null);
      }
    });
  };
  outcome.bpus=null;
  outcome.joinQueueDataObj=null;
  var getBpuData=function(callback) {
    outcome.joinQueueDataObj=req.app.db.models.BpuExperiment.getDataObjToJoinQueue();
    req.app.db.models.Bpu.find({}, {}, '', function(err, bpus) {
      if(err) {
        return callback(err);
      } else {
        outcome.bpus=bpus;
        return callback(null);
      }

    });
  };
  var getSessionExperiments=function(callback) {
    outcome.exps=[];
    var query={
      sessionID:req.sessionID,
      $or:[ 
        {'exp_status':'created'},  
        {'exp_status':'submited'},
        {'exp_status':'queued'},
        {'exp_status':'running'},
      ],
      //$or:[ {'user.name':'casey'},  {'user.name':'ingmar'}],
    };
    req.app.db.models.BpuExperiment.find(query, {}, '', function(err, exps) {

      if(err) {
        return callback(err);
      } else {
        //cancel old exps
        var keepers=[]; 
        exps.forEach(function(exp) {
          console.log(new Date().getTime()-exp.exp_creationTime);
          if((new Date().getTime()-exp.exp_creationTime)>1*1000*60) {
            exp.exp_status='failed';
            exp.save();
          } else {
            keepers.push(exp);
          }
        }); 
        outcome.exps=keepers;
        return callback(null);
      }

    });
  };
  getSessionData(function(err) {
    getUserData(function(err) {
      getBpuData(function(err) {
        getSessionExperiments(function(err) {
          if (err) {
            return next(err);
          }
          //Make Jade Object 
          outcome.eugs=[]; 
          var sendBpus=[];
          var nextBpu=function(cb_fn) {
            if(outcome.bpus.length>0) {
              var bpu=outcome.bpus.pop();
              if(bpu.isOn && bpu.bpuGroupsCrossCheckWithUser(outcome.user) && bpu.index>=0) {
                sendBpus.push(bpu);
                var eug={};
                eug.name=bpu.name;
                eug.titleLabel=bpu.name+': Queue ?, Wait ? sec';
                eug.titleLabelJadeName='BpuTitleLabel'+bpu.index;
                eug.statusLabel='Status:?';
                eug.statusLabelJadeName='BpuStatusLabel'+bpu.index;
                eug.userLabel='User:?, Time:? sec';
                eug.userLabelJadeName='BpuUserLabel'+bpu.index;
                eug.timeLabel='Time:? sec';
                eug.timeLabelJadeName='BpuTimeLabel'+bpu.index;
                eug.joinLiveJadeName='bpuJoinLiveButton'+bpu.index;   //do not change used in client
                eug.submitTextJadeName='bpuSubmitTextButton'+bpu.index;//do not change used in client
                outcome.eugs.push(eug);
                nextBpu(cb_fn);
              } else {
                nextBpu(cb_fn);
              }
            } else {
              cb_fn(null);
            }
          }; 
          nextBpu(function(err) {
            if(outcome.eugs.length===0) {
              outcome.eugs.joinNextDisabled=false;
              outcome.eugs.submitNextDisabled=true;
            }
            res.render('goLabz/index', { 
              data: { 
                user: JSON.stringify(outcome.user), 
                bpus: escape(JSON.stringify(sendBpus)),
                exps: escape(JSON.stringify(outcome.exps)),
                session: escape(JSON.stringify(outcome.sess)),
                joinQueueDataObj: escape(JSON.stringify(outcome.joinQueueDataObj)),
                eugs:outcome.eugs,
              } 
            });
          });
        });
      });
    });
  });
};
