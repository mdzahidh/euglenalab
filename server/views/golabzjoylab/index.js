'use strict';
var async=require('async');
exports.init = function(req, res, next) {
  var outcome={};
  outcome.sess=null;
  var getSessionData = function(callback) {
    if(req.sessionID===null || req.sessionID===undefined) {
      return callback('not authorized. no sessionid');
    } else {
      req.app.db.models.Session.findOne({sessionID:req.sessionID}, {}, function(err, sessionDoc) {
        if(err) {
          return callback('getSessionData err:'+err);
        } else if(sessionDoc===null || sessionDoc===undefined) {
          return callback('getSessionData session is dne');
        } else {
          outcome.sess=sessionDoc;
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
  outcome.exp=null;
  var getExpData=function(callback) {
    req.app.db.models.BpuExperiment.findById(outcome.sess.liveBpuExperiment.id, {}, function(err, expDoc) {
      if(err) {
        return callback(err);
      } else if(expDoc===null || expDoc===undefined) {
        return callback('exp doc dne');
      } else {
        outcome.exp=expDoc;
        return callback(null);
      }
    });
  };
  outcome.bpu=null;
  outcome.webStreamUrl=null;
  outcome.sideStreamUrl=null;
  var getBpuData=function(callback) {
    req.app.db.models.Bpu.findById(outcome.sess.liveBpu.id, {}, function(err, bpuDoc) {
      if(err) {
        return callback('getBpu err:'+err);
      } else if(bpuDoc===null) {
        return callback('getBpu err:'+'bpuDoc===null');
      } else {
        //ping bpu and could check status in bpu?
        _getStatusOfBpu(req.app, bpuDoc, 1000, function(err, statusObj) {
          if(err) {
            return callback('get status '+err);
          } else if(statusObj.bpuStatus!==req.app.mainConfig.bpuStatusTypes.running) {
            return callback('get status '+'bpu not running');
          } else if(statusObj.exp===null || statusObj.exp===undefined) {
            return callback('get status '+'no exp');
          } else {
            if(''+statusObj.exp._id!==''+outcome.sess.liveBpuExperiment.id) {
              return callback('get status '+'exp ids do not match');
            } else {
              outcome.bpu=bpuDoc;
              outcome.webStreamUrl=bpuDoc.getWebStreamUrl();
              outcome.sideStreamUrl=bpuDoc.getSideStreamUrl();
              return callback(null);
            }
          }
        });

      }
    });
  };

  outcome.divInfo=null;
  outcome.renderJade=null;
  var setupDiv=function(callback) {
    _setupDiv(outcome.user.username, function(err, divInfo, renderJade) {
      if(err) {
        return callback('setupDiv err:'+err);
      } else {
        outcome.divInfo=divInfo;
        outcome.renderJade=renderJade;
        return callback(null);
      }
    });
  };

  var seriesFuncs=[];
  seriesFuncs.push(getSessionData);
  seriesFuncs.push(getUserData);
  seriesFuncs.push(getExpData);
  seriesFuncs.push(getBpuData);
  seriesFuncs.push(setupDiv);
  
  async.series(seriesFuncs, function(err) {
    if(err) {
      return next(err);
    } else {
      var startingAlpha=0.0;
            res.render(outcome.renderJade, {
        data: {
          session:escape(JSON.stringify(outcome.sess)),
          user:escape(JSON.stringify(outcome.user)),
          bpu:escape(JSON.stringify(outcome.bpu)),
          bpuExp:escape(JSON.stringify(outcome.exp)),
          divInfo:outcome.divInfo,
          lightData:{
            topValue:0, rightValue:0, bottomValue:0, leftValue:0,
            topLightAlpha:startingAlpha, rightLightAlpha:startingAlpha, bottomLightAlpha:startingAlpha, leftLightAlpha:startingAlpha
          },
          timeLeftInLab:{jadeName:'timeLeftInLab', value:'Lab Time Remaining:'+'Calculating...'},
          bpuName:outcome.bpu.name,
          mainImageIP:outcome.webStreamUrl,
          sideImageIP:outcome.sideStreamUrl,
        },
      });
    }
  });
};
var _getStatusOfBpu=function(app, bpuDoc, timeout, callback) {
  var foundSocket=null;
  for(var ind=0;ind<app.bpusConnected.length;ind++) {
    if(app.bpusConnected[ind].bpuDoc.name===bpuDoc.name) {
      foundSocket=app.bpusConnected[ind].socket;
    }
  }
  if(foundSocket!==null) {
    var didCallback=false;
    setTimeout(function() {
      if(!didCallback) {
        didCallback=true;
        callback('timed out', null);
      }
    }, timeout);
    foundSocket.emit(app.mainConfig.socketStrs.bpu_getStatus, function(err, resObj) {
      if(!didCallback) {
        didCallback=true;
        callback(err, resObj);
      }
    });
  } else {
    callback('no socket for bpu', null);
  }
};
var _setupDiv = function(username, callback) {
  var renderJade='golabzjoylab/index';
  var divInfo={
    mainRowWidth:'75%',
    mainRowHeight:'480px',
    
    mainColWidth:'75%',
    mainColHeight:'100%',

    lightLong:'90%',
    lightShort:'5%',

    imageWidth:'90%',
    imageHeight:'90%',

    hasAside:true,
    
    asideColWidth:'25%',
    asideColHeight:'100%',

    sideImageWidth:'100%',
    sideImageHeight:'50%',

    joystickWidth:'100%',
    joystickHeight:'50%',
  };
  if(!divInfo.hasAside) {
    divInfo.mainColWidth='100%';
  }
  callback(null, divInfo, renderJade);
};

