'use strict';
var async=require('async');
var renderSettings = function(req, res, next, oauthMessage) {
  var outcome={};
  outcome.session=null;
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
  var getUserData=function(callback) {
    req.app.db.models.User.findById(outcome.sess.user.id, {}, function(err, userDoc) {
      if(err) {
        return callback('getUser err:'+err);
      } else if(userDoc===null) {
        return callback('getUser err:'+'userDoc===null');
      } else {
        outcome.user=userDoc;
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
            console.log(statusObj.exp._id, outcome.sess.liveBpuExperiment.id);
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
  outcome.exp=null;
  var getExperimentData=function(callback) {
    req.app.db.models.BpuExperiment.findById(outcome.sess.liveBpuExperiment.id, {}, function(err, bpuExpDoc) {
      if(err) {
        return callback('getBpuExperiment err:'+err);
      } else if(bpuExpDoc===null) {
        return callback('getBpuExperiment err:'+'bpuExpDoc===null');
      } else {
        outcome.exp=bpuExpDoc;
        return callback(null);
      }
    });
  };
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
  seriesFuncs.push(getBpuData);
  seriesFuncs.push(getExperimentData);
  seriesFuncs.push(setupDiv);
  async.series(seriesFuncs, function(err) {
    if(err) {
      return next(err);
    } else {
      var startingAlpha=0.0;
            res.render(outcome.renderJade, {
        data: {
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
exports.init = function(req, res, next) {
  renderSettings(req, res, next, '');
};
var _setupDiv = function(username, callback) {
  var renderJade='livejoylab/index';
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
  if(username==='dirk_joystick') {
    renderJade='livejoylab/indexMuseum';
    divInfo={
      
      mainRowWidth:'100%',
      mainRowHeight:'100%',
      
      mainColWidth:'100%',
      mainColHeight:'100%',

      lightLong:'94%',
      lightShort:'3%',

      imageWidth:'94%',
      imageHeight:'94%',

      hasAside:false,
      
      asideColWidth:'25%',
      asideColHeight:'100%',

      sideImageWidth:'100%',
      sideImageHeight:'50%',

      joystickWidth:'100%',
      joystickHeight:'50%',
    };
  }
  if(!divInfo.hasAside) {
    divInfo.mainColWidth='100%';
  }
  callback(null, divInfo, renderJade);
};

