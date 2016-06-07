'use strict';
var app={};
var PassKey='ZTUzYzU3OGE5NmM2MjZmNDIzNTVhMjlm';
var Identifier='C56A80D928264A0A900B30D610EDCB95';
exports = module.exports = function(_app, mongoose) {
  app=_app;
  var mySchema = new mongoose.Schema({
    //My Additions
    req: {
      time: { type: Date, default: new Date() },
      headers: { type: Object, default: null },
      bytesRead: { type: Object, default: null },
      body: { type: String, default: '' },
    },
    auth: {
      err: { type: String, default: '' },
      didPass: { type: Boolean, default: false },
      passKey: { type: String, default: '' },
      identifier: { type: String, default: '' },
    },
    reqObj: {
      err: { type: String, default: '' },
      didPass: { type: Boolean, default: false },
      type: { type: String, default: '' },
    },
  });

  mySchema.set('autoIndex', (app.get('env') === 'development'));
  addStatics(mySchema);
  addMethods(mySchema);
  app.db.model('SoapReq', mySchema);
};
var addStatics=function(mySchema) {
  var getSoapType=function(body) {
    var retValue=null; 
    var typeLine=getXmlTag('<soap:Body>', body ,true);
    var stop=typeLine.search('xmlns');
    if(stop>-1) {
      retValue=typeLine.substring(0, stop);
    };
    if(retValue) {
      retValue=makeLetterNumber(retValue);
    }
    return retValue;
  };
  var checkBodyAuth=function(body) {
    var auth={
      err:null,
      didPass:false,
      passKey:null,
      identifier:null,
    };
    if(body===undefined || body===null) {
      auth.err='body undefined or null';
    } else if(body.length===0) {
      auth.err='body length 0';
    } else {
      auth.passKey=getXmlTag('passKey', body ,true);
      auth.identifier=getXmlTag('identifier', body ,true);
      if(auth.passKey!==PassKey) {
        auth.err='PassKey failed';
      } else if(auth.identifier!==Identifier) {
        auth.err='Identifier failed';
      } else {
        auth.didPass=true;
      }
    }
    return auth;
  };
  var getReqObjFromType=function(body) {
    var reqObj={
      err:'',
      didPass:false,
      type:'',
    }
    if(body===undefined || body===null) {
      reqObj.err='body undefined or null';
    } else {
      reqObj.type=getSoapType(body);
      if(Types[reqObj.type]===null || Types[reqObj.type]===undefined) {
        reqObj.err='Type dne';
      } else {
        reqObj.didPass=true;
        var tags=Types[reqObj.type].reqTags;
        tags.forEach(function(item) {
          reqObj[item]=getXmlTag(item, body, true);
        });
      }
    }
    return reqObj;
  };
  mySchema.statics.getNew=function(req, callback) {
    try {
      var newSoapReq=app.db.models.SoapReq();
      newSoapReq.req.headers=req.headers;
      newSoapReq.req.bytesRead=req.connection.bytesRead;
      req.on('data', function(chunk) {newSoapReq.req.body=chunk.toString();}); 
      req.on('end', function() {
        newSoapReq.req.body=null;
        var auth=checkBodyAuth(newSoapReq.req.body);
        newSoapReq.auth.err=auth.err;
        newSoapReq.auth.didPass=auth.didPass;
        newSoapReq.auth.passKey=auth.passKey;
        newSoapReq.auth.identifier=auth.identifier;
        
        var reqObj=getReqObjFromType(newSoapReq.req.body);
        newSoapReq.reqObj.err=reqObj.err;
        newSoapReq.reqObj.didPass=reqObj.didPass;
        newSoapReq.reqObj.type=reqObj.type;
        
        callback(null, newSoapReq);
      });
    } catch(err) {
      callback('SoapReq:getNew catch err:'+err, null);
    }
  };
};
var addMethods=function(mySchema) {
  mySchema.methods.pingSocket=function(cb_fn) {
  };
};

var Types={
  Cancel:{
    type:'Cancel',
    path:'./responses/Cancel.xml', 
    reqTags:['experimentID'],
    resTags:['CancelResult'],
  },
  GetEffectiveQueueLength:{
    type:'GetEffectiveQueueLength',
    path:'./responses/GetEffectiveQueueLength.xml', 
    reqTags:['userGroup', 'priorityHint'],
    resTags:['effectiveQueueLength', 'estWait'],
  },
  GetExperimentStatus:{
    type:'GetExperimentStatus',
    path:'./responses/GetExperimentStatus.xml', 
    reqTags:['experimentID'],
    resTags:['statusCode', 'effectiveQueueLength', 'estWait', 'estRuntime', 'estRemainingRuntime', 'minTimetoLive'],
  },
  GetLabConfiguration:{
    type:'GetLabConfiguration',
    path:'./responses/GetLabConfiguration.xml', 
    reqTags:['userGroup'],
    resTags:[],
  },
  GetLabStatus:{
    type:'GetLabStatus',
    path:'./responses/GetLabStatus.xml', 
    reqTags:[],
    resTags:['online', 'labStatusMessage'],
  },
  RetrieveResult:{
    type:'RetrieveResult',
    path:'./responses/RetrieveResult.xml', 
    reqTags:['experimentID'],
    resTags:['statusCode', 'experimentResults', 'xmlResultExtension', 'xmlBlobExtension', 'errorMessage'],
  },
  Submit:{
    type:'Submit',
    path:'./responses/Submit.xml', 
    reqTags:['experimentID', 'experimentSpecification', 'userGroup', 'priorityHint'],
    resTags:['accepted', 'errorMessage', 'estRuntime', 'labExperimentID', 'minTimetoLive', 'effectiveQueueLength', 'estWait'],
  },
  Validate:{
    type:'Validate',
    path:'./responses/Validate.xml', 
    reqTags:['experimentSpecification', 'userGroup'],
    resTags:['accepted', 'errorMessage', 'estRuntime'],
  },
};

//Xml Helpers
var getResXmlFromResObj=function(theType, reqData) {
  var retResXml=null;
  var tags=theType.resTags
  var resXml=fs.readFileSync(theType.path, 'utf8');
  var keys=Object.keys(reqData);
  keys.forEach(function(key) {
    if(key=='warningMessages') {
      resXml=setXmlTag('warning1', reqData[key][0], resXml);
      resXml=setXmlTag('warning2', reqData[key][1], resXml);
    } else if(key!='type') {
      if(key=='experimentResults') {
        var startStr="&lt;experimentResult&gt;&lt;base64targz&gt;";
        var endStr="&lt;/base64targz&gt;&lt;/experimentResult&gt;"
        reqData[key]=startStr+reqData[key]+endStr;
        var replaceString='';
        if(key[0]=='x') {
          replaceString=key.substring(1);
          replaceString='y'+replaceString;
        } else {
          replaceString=key.substring(1);
          replaceString='x'+replaceString;
        }
        resXml=setXmlTag(replaceString, reqData[key], resXml);
        reqData[key]=startStr+'wasmade'+endStr;
      } else {
        var replaceString='';
        if(key[0]=='x') {
          replaceString=key.substring(1);
          replaceString='y'+replaceString;
        } else {
          replaceString=key.substring(1);
          replaceString='x'+replaceString;
        }
        resXml=setXmlTag(replaceString, reqData[key], resXml);
      }
    }
  });
  return resXml;
};
var getXmlTag=function(tag, xml, doStrip) {
  var retValue=null;
  var start=xml.search(tag);
  if(start>-1) {
    var value=xml.substring(start+tag.length+1, xml.length);
    var stop=value.search(tag);
    if(stop>-1) {retValue=value.substring(0, stop-2);
    } else {
      stop=value.search('>');
      retValue=value.substring(0, stop+1);
    }
  }
  if(doStrip && retValue) {retValue=makeLetterNumber(retValue);}
  return retValue;
};
var makeLetterNumber=function(str) {
  var resStr='';
  for(var i=0;i<str.length;i++) {
    var c=str.charCodeAt(i);
    if((c>=48 && c<=57) || (c>=65 && c<=90) || (c>=97 && c<=122)) {
      resStr+=str[i];
    }
  }
  return resStr;
};
var setXmlTag=function(replaceString, data, xml) {
  var indx=xml.search(replaceString);
  var firstHalf=xml.substring(0, indx);
  var lastHalf=xml.substring(indx+replaceString.length);
  xml=firstHalf+data+lastHalf; 
  return xml;
}

