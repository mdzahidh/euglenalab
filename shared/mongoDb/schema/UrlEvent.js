'use strict';
var _SchemaName='UrlEvent';
var myPrintMsg=false;
var myPrintInit=true;
var myPrintErr=true;
var myPrintName='('+_SchemaName+'.js)';
var myPrint=function(msg, init, err) {
  if(err!==undefined && err!==null && myPrintErr) console.log('Error'+'\t'+myPrintName+':'+err);
  else if(err!==undefined && init!==null && myPrintInit) console.log('Init'+'\t'+myPrintName+':'+init);
  else if(err!==undefined && msg!==null && myPrintMsg) console.log('Msg'+'\t'+myPrintName+':'+msg);
};

exports = module.exports = function(app, mongoose) {
  var mySchema = new mongoose.Schema({
    creationDate:{type: Date, default: new Date()}, 
    sessionID:{type: String, default: ''}, 
    isUserSet:{type: Boolean, default: false},
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: { type: String, default: '' },
    },
    subReqEvents:{type:Array, default: []}, 
  });
  mySchema.statics.checkTraffic=function(req, callback) {_checkTraffic(app, req, callback);};
  app.db.model(_SchemaName, mySchema);
};

var _checkTraffic=function(app, req, callback) {
  var query=req.query;
  var referer=req.headers.referer;
  try { 
    var subReqEvent=null;
    _getSubReqEvent(req, function(err, data) {
      if(err || data===null) {
        callback(err, data);
      } else {
        subReqEvent=data;
        subReqEvent.eventDate=new Date();
        app.db.models.UrlEvent.find({sessionID:req.sessionID}, {}, function(err, mongoDocs) {
          //Identify or create new urlevent document
          var theUrlEvent=null;
          if(err || mongoDocs===null || mongoDocs===undefined || (mongoDocs.forEach && mongoDocs.length===0)) {
            var theUrlEvent=app.db.models.UrlEvent();
            theUrlEvent.sessionID=subReqEvent.sessionID;
          } else if(mongoDocs.forEach && mongoDocs.length>1) {
            mongoDocs.sort(function(a, b) {return b.creationDate-a.creationDate;});
            theUrlEvent=mongoDocs.shift();
          } else {
            theUrlEvent=mongoDocs[0];
          }
          //set urlevent document properties
          if(theUrlEvent!==null) {
            theUrlEvent.subReqEvents.push(subReqEvent);
            if(subReqEvent.user.username!=='' && subReqEvent.user.id!=='') {
              theUrlEvent.isUserSet=true;
              theUrlEvent.user.username=subReqEvent.user.username;
              theUrlEvent.user.id=subReqEvent.user.id;
            }
            theUrlEvent.save(function(err, dat) {
              callback(null, subReqEvent);
            });
          } else {
            callback(null, subReqEvent);
          }
        });
      }
    });
  } catch(err) {
    callback('Mongo Schema '+_SchemaName+'try catch _checkTraffic err:'+err, null);
  }
};
var _getSubReqEvent=function(req, callback) {
  var level=0;
  var checkObjForKeys=function(checkObj, keysObj, cb_fn) {
    level++;
    var subLevel=0;
    var keys=Object.keys(keysObj);
    var next=function() {
      subLevel++;
      if(keys.length>0) {
        var key=keys.shift();
        if(checkObj[key]) {
          if(typeof keysObj[key]==='object' && keysObj[key].forEach===undefined &&
              typeof checkObj[key]==='object' && checkObj[key].forEach===undefined) {
            checkObjForKeys(checkObj[key], keysObj[key], function(err, data) {
              keysObj[key]=data;
              next();
            });
          } else {
            keysObj[key]=checkObj[key];
            next();
          }
        } else {
          next();
        }
      } else {
        cb_fn(null, keysObj);
      }
    };
    next();
  };
  var subReqEvent={
    headers:'',
    ip:'', url:'', method:'', query:'',
    sessionID:'',
    connection:{remoteAddress:'', server:{allowHalfOpen:''}},
    socket:{remoteAddress:''},
    user:{_id:'', username:''}, 
  };
  checkObjForKeys(req, subReqEvent, function(err, data) {
    callback(err, data);
  });
};
//console.log(Object.keys(req));
//console.log('_readableState', req._readableState); 
//console.log('readable', req.readable);              
//console.log('domain', req.domain);              
//console.log('_events', req._events);              
//console.log('_maxListeners', req._maxListeners);              
//console.log('socket', req.socket);              
//console.log('connection', req.connection);              
//console.log('httpVersionMajor', req.httpVersionMajor);              
//console.log('httpVersionMinor', req.httpVersionMinor);              
//console.log('httpVersion', req.httpVersion);              
//console.log('complete', req.complete);              
//console.log('headers', req.headers);              
//console.log('rawHeaders', req.rawHeaders);              
//console.log('trailers', req.trailers);              
//console.log('rawTrailers', req.rawTrailers);              
//console.log('_pendings', req._pendings);              
//console.log('_pendingIndex', req._pendingIndex);              
//console.log('upgrade', req.upgrade);              
//console.log('url', req.url);              
//console.log('method', req.method);              
//console.log('statusCode', req.statusCode);              
//console.log('statusMessage', req.statusMessage);              
//console.log('client', req.client);              
//console.log('_consuming', req._consuming);              
//console.log('_dumped', req._dumped);              
//console.log('next', req.next);              
//console.log('baseUrl', req.baseUrl);              
//console.log('originalUrl', req.originalUrl);              
//console.log('_parsedUrl', req._parsedUrl);              
//console.log('params', req.params);              
//console.log('query', req.query);              
//console.log('res', req.res);              
//console.log('_parsedOriginalUrl', req._parsedOriginalUrl);              
//console.log('originalMethod', req.originalMethod);              
//console.log('body', req.body);              
//console.log('secret', req.secret);              
//console.log('cookies', req.cookies);              
//console.log('signedCookies', req.signedCookies);              
//console.log('sessionStore', req.sessionStore);              
//console.log('sessionID', req.sessionID);              
//console.log('_passport', req._passport);              
//console.log('csrfToken', req.csrfToken);              
//console.log('route', req.route);  
//console.log('user', req.user);  
