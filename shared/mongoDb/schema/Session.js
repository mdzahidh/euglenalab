'use strict';
exports = module.exports = function(app, mongoose) {
  var mySchema = new mongoose.Schema({
    //General Info
    isClosed:  { type: Boolean, default: false },
    isVerified:  { type: Boolean, default: false },
    lastUpdateTime:  { type: Number, default: new Date().getTime() },
    //ID info 
    url:  { type: String, default: null },
    sessionID:  { type: String, default: null },
    socketID:   { type: String, default: null },
    socketHashID:   { type: String, default: null },
    socketHandle:   { type: String, default: null },
    
    //User
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' , default:null},
      name: { type: String, default: null },
      groups: { type: Array, default: [] },
    },
    //Live Experiment 
    liveBpuExperiment: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'BpuExperiment' },
      tag: { type: Object, default: {} }
    },
  });
  //Takes a socket and cross references it with the database.  
  //if none exists then a new one will be made if there is a session id available
  mySchema.statics.updateSessionFromSocket=function(socket, callbackToServer) {
    _updateSessionFromSocket(app, socket, callbackToServer);
  };
  mySchema.statics.makeNewSession=function(sessInfo, callback) {
    _makeNewSession(app, sessInfo, callback);
  };
  if(app.get) mySchema.set('autoIndex', (app.get('env') === 'development'));
  else mySchema.set('autoIndex', true);
  app.db.model('Session', mySchema);
};

var _updateSessionFromSocket=function(app, socket, callbackToServer) {
  //Find Session ID in socket Cookie
  var cookieSessID=null;
  if(socket.handshake && socket.handshake.headers && socket.handshake.headers.cookie) {
    if(typeof socket.handshake.headers.cookie==='string') {
      var cookieParts=socket.handshake.headers.cookie.split('connect.sid');
      if(cookieParts.length>0) {
        cookieParts=cookieParts[cookieParts.length-1].split('s%3A');
        if(cookieParts.length>0) {
          var temp=cookieParts[cookieParts.length-1].split('.')[0];
          if(temp.length===32) {
            cookieSessID=temp;
          }
        }
      }
    }
  }
  //Update/Create Session with ID
  if(cookieSessID!==null && cookieSessID!==undefined) {
    //Update Session Schema
    var sessionUpdateObj={
      isClosed:false,
      isVerified:false,
      lastUpdateTime:new Date().getTime(),
      referer:socket.handshake.headers.referer,
      url:socket.handshake.headers.referer,
      socketID:socket.conn.id,
      socketHashID:socket.conn.id,
      socketHandle:null,
    };
    console.log(socket.handshake.headers.referer);
    var parts=socket.handshake.headers.referer.split('//');
    parts=parts[1].split('/');
    sessionUpdateObj.url=''
    for(var ind=1;ind<parts.length;ind++) {
      sessionUpdateObj.url+='/'+parts[ind];
    }
    app.db.models.Session.findOneAndUpdate({sessionID:cookieSessID}, sessionUpdateObj, {new:true}, function(err, sessDoc) {
      //Error
      if(err) {
        callbackToServer('Session.findOneAndUpdate '+err, null);

      //Save New
      } else if(sessDoc===null || sessDoc===undefined) {
        var newSess=app.db.models.Session();
        newSess.url=socket.handshake.headers.referer;
        newSess.sessionID=cookieSessID;
        newSess.socketID=socket.conn.id;
        newSess.socketHashID=socket.conn.id;
        newSess.socketHandle=socket.handshake.headers.referer;
        newSess.save(function(err, newSessDoc) {
          if(err) {
            callbackToServer('newSess.save '+err, null);
          } else {
            callbackToServer(null, newSessDoc);
          }
        });

      //Okay
      } else {
        callbackToServer(null, sessDoc);
      }
    });

  //Error:No Session ID
  } else {
    callbackToServer('Could not find session id in socket cookie', null);
  }
};




var _makeNewSession=function(app, sessInfo, callbackToServer) {
  var newSession=app.db.models.Session();
  Object.keys(sessInfo).forEach(function(key) {
    if(key==='user') {
      Object.keys(sessInfo.user).forEach(function(userKey) {
        newSession.user[userKey]=sessInfo.user[userKey];
      });
    } else if(key==='liveBpuExperiment') {
      Object.keys(sessInfo.liveBpuExperiment).forEach(function(expKey) {
        newSession.liveBpuExperiment[expKey]=sessInfo.liveBpuExperiment[expKey];
      });
    } else {
      newSession[key]=sessInfo[key];
    }
  });
  newSession.save(function(err, savedSession) {
    if(err) {
      callbackToServer('save '+err, null);
    } else {
      callbackToServer(null, savedSession);
    }
  });
};
