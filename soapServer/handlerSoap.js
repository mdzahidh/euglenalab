var fs=require('fs');
var exec=require('child_process').exec;

var decoder=require('../shared/en_de_code_T4Leds.js');
var Identifier='C56A80D928264A0A900B30D610EDCB95';
var PassKey='ZTUzYzU3OGE5NmM2MjZmNDIzNTVhMjlm';

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

//Internal Functions
var roundMsToSec=function(ms) {
  return Math.round(ms/1000);
};
var _findExpIdInBpuObjs=function(app, bpuObjs, minTimeBpuData, expId, callback) {
  var foundExpTag=null;
  for(var i=0;i<bpuObjs.length;i++) {
    var bpuObj=bpuObjs[i];
    if(bpuObj.runningExpTag!==null) {
      if(bpuObj.runningExpTag.soapExperimentId===expId) {
        foundExpTag=bpuObj.runningExpTag;
      }
    }
    if(foundExpTag===null) {
      for(var j=0;j<bpuObj.currentList.length;j++) {
        var expTag=bpuObj.currentList[j];
        if(expTag.soapExperimentId===expId) {
          foundExpTag=expTag;
        }
      }
    }
  }
  if(foundExpTag===null) {
    app.db.models.BpuExperiment.findOne({'experimentData.soap.id':expId}, {}, function(err, exp) {
      if(err) {
        callback('could not find exp', null);
      } else if(exp===null) {
        callback('could not find exp', null);
      } else {
        var foundExpTag={
          expId:exp._id,
          isRunOver:exp.isRunOver,
          isCanceled:exp.isCanceled,
          isRunning:exp.isRunning,
          isWaitingToRun:exp.isWaitingToRun,
          runTime:exp.runTime,
          timeToFinish:exp.timeLeft+minTimeBpuData.processingTimePerExperiment,
          timeToLive:exp.timeToLive,
        }
        callback(null, foundExpTag);
      }
    });
  } else {
    callback(null, foundExpTag);
  }
};
exports.checkReq=function(app, req, callback) {
  var body=null;
  var reqDate=new Date();
  req.on('data', function(chunk) {body=chunk.toString();}); 
  req.on('end', function() {
    console.log(body);
    if(body!==undefined && body!==null && body.length>0) {
      var passKey=getXmlTag('passKey', body ,true);
      var identifier=getXmlTag('identifier', body ,true);
      if(passKey===app.PassKey && identifier===app.Identifier) {
        var type=getSoapType(body);
        if(Types[type]) {
          var reqObj=getReqObjFromType(Types[type], body);
          if(reqObj) {
            reqObj.type=type;
            callback(null, reqObj);
          } else {
            callback('failed getReqObjFromType', null);
          }
        } else {
          callback('failed type', null);
        }
      } else {
        callback('failed auth', null);
      }
    } else {
      callback('body null', null);
    }
  });
};

var _getMinTimeToLive=function(expTags) {
  if(expTags.length===0) {
    return 0;
  } else {
    expTags.sort(function(a, b) {
      return new Date(b.creationDate)-new Date(a.creationDate);
    });
    return roundMsToSec(expTags[0].timeToFinish);
  }
};
var _getEstWait=function(expTags, runTime) {
  if(expTags.length===0) {
    return 0;
  } else {
    var minTimetoLive=_getMinTimeToLive(expTags);
    return runTime+minTimetoLive;
  }
};


var processCancel=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  var resObj={
    CancelResult:false,
  };
  _findExpIdInBpuObjs(app, bpuObjs, minTimeBpuData, reqObj.experimentID, function(err, foundExpTag) {
    if(foundExpTag!==null) {
      app.db.models.BpuExperiment.cancelById(foundExpTag.expId, function(err, dat) {
        if(err) {
          resObj.CancelResult=false;
          callback('could not update experiment in database', resObj);
        } else {
          resObj.CancelResult=true;
          callback(null, resObj);
        }
      });
    } else {
      resObj.CancelResult=true;
      callback('exp '+reqObj.experimentID+' not found', resObj);
    }
  });
};
var processGetEffectiveQueueLength=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  var resObj={
    effectiveQueueLength:minTimeBpuData.effectiveQueueLength,
    estWait:roundMsToSec(minTimeBpuData.estWait),
  };
  callback(null, resObj);
};
var processGetExperimentStatus=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  //1 = in queue, 2 = running, 3 == results ready, 4 == error
  var resObj={
    statusCode:4,
    effectiveQueueLength:minTimeBpuData.currentList.length,
    estWait:0,
    estRuntime:0,
    estRemainingRuntime:0,
    minTimetoLive:0,
  };
  _findExpIdInBpuObjs(app, bpuObjs, minTimeBpuData, reqObj.experimentID, function(err, foundExpTag) {
    if(err) {
    } else if(foundExpTag===null) {
    } else {
      if(foundExpTag.isRunOver) {
        resObj.statusCode=3;
        resObj.estWait=0;
        resObj.estRuntime=roundMsToSec(foundExpTag.runTime);
        resObj.estRemainingRuntime=0;
        resObj.minTimetoLive=0;
      } else if(foundExpTag.isCanceled) {
        resObj.statusCode=4;
        resObj.estWait=0;
        resObj.estRuntime=0;
        resObj.estRemainingRuntime=0;
        resObj.minTimetoLive=0;
      } else if(foundExpTag.isRunning) {
        resObj.statusCode=2;
        resObj.estWait=roundMsToSec(foundExpTag.timeToFinish-(foundExpTag.runTime-foundExpTag.timeLeft));
        resObj.estRuntime=roundMsToSec(foundExpTag.runTime);
        resObj.estRemainingRuntime=roundMsToSec(foundExpTag.timeLeft);
        resObj.minTimetoLive=roundMsToSec(foundExpTag.timeToLive);
      } else if(foundExpTag.isWaitingToRun) {
        resObj.statusCode=1;
        resObj.estWait=roundMsToSec(foundExpTag.timeToFinish);
        resObj.estRuntime=roundMsToSec(foundExpTag.runTime);
        resObj.estRemainingRuntime=roundMsToSec(foundExpTag.timeLeft);
        resObj.minTimetoLive=roundMsToSec(foundExpTag.timeToLive);
      }
    }
    callback(null, resObj);
  });
};
var processGetLabConfiguration=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  var resObj={};
  callback(null, resObj);
};
var processGetLabStatus=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  var resObj={
    online:false,
    labStatusMessage:'none',
  };
  resObj.labStatusMessage='bpu online';
  if(minTimeBpuData!==null) {
    resObj.online=true;
  }
  callback(null, resObj);
};
var processRetrieveResult=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  console.log('reaobj', reqObj);
  //reqObj.experimentID='24890';
  //1 = in queue, 2 = running, 3 == results ready, 4 == error
  var resObj={
    statusCode:4,
    experimentResults:'',
    xmlResultExtension:'none',
    xmlBlobExtension:'none',
    warningMessages:['none', 'none'],
    errorMessage:'none',
  };
  app.db.models.BpuExperiment.findOne({'experimentData.soap.id':reqObj.experimentID}, {}, function(err, exp) {
    if(err) {
      resObj.statusCode=4;
      resObj.errorMessage='experimentData.soap.id '+reqObj.experimentID+' not found in db';
      callback(null, resObj);
    } else if(exp===null) {
      resObj.statusCode=4;
      resObj.errorMessage='experimentData.soap.id '+reqObj.experimentID+' was null in db';
      callback(null, resObj);
    } else if(exp.experimentData.soap.id!==reqObj.experimentID) {
      resObj.statusCode=4;
      resObj.errorMessage='experimentData.soap.id '+reqObj.experimentID+' did not match '+exp.experimentData.soap.id;
      callback(null, resObj);
    } else {
      var foundExpTag=exp;
      if(foundExpTag.isRunOver) {
        _verifyAndBinExpTarFile(exp, function(err, binData) {
          if(err) {
            resObj.statusCode=4;
            resObj.errorMessage='_verifyAdBinExpTarFile err:'+err;
            callback(null, resObj);
          } else if(binData===null || binData.length<=0) {
            resObj.statusCode=4;
            resObj.errorMessage='_verifyAdBinExpTarFile err:'+'no bin data';
            callback(null, resObj);
          } else {
            resObj.statusCode=3;
            resObj.experimentResults=binData;
            callback(null, resObj);
          }
        });
      } else if(foundExpTag.isRunning) {
        resObj.statusCode=2;
        resObj.errorMessage='isRunning';
        callback(null, resObj);
      } else if(foundExpTag.isWaitingToRun) {
        resObj.statusCode=1;
        resObj.errorMessage='isWaitingToRun';
        callback(null, resObj);
      } else if(foundExpTag.isCanceled) {
        resObj.statusCode=4;
        resObj.errorMessage='canceled';
        callback(null, resObj);
      } else {
        resObj.statusCode=4;
        resObj.errorMessage='exp tag found and pulled but could not type';
        callback(null, resObj);
      }
    }
  });
};
var processSubmit=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  var resObj={
    accepted:false,
    warningMessages:['none', 'none'],
    errorMessage:'none',
    estRuntime:0,
    labExperimentID:null,
    minTimetoLive:0,
    effectiveQueueLength:0,
    estWait:0,
  };
  resObj.accepted=reqObj.accepted;
  resObj.errorMessage=reqObj.errorMessage;
  resObj.estRuntime=roundMsToSec(reqObj.estRuntime+minTimeBpuData.processingTimePerExperiment);
  resObj.labExperimentID=reqObj.experimentID;
  resObj.minTimetoLive=0;//roundMsToSec(minTimeBpuData.estWait);  //not used by NWG studnet client
  resObj.effectiveQueueLength=minTimeBpuData.currentList.length;
  resObj.estWait=roundMsToSec(minTimeBpuData.estWait);
  callback(null, resObj);
};
var processValidate=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  var resObj={
    accepted:false,
    errorMessage:'none',
    estRuntime:0,
    warningMessages:['none', 'none'],
  };
  resObj.accepted=reqObj.accepted;
  resObj.errorMessage=reqObj.errorMessage;
  resObj.estRuntime=roundMsToSec(reqObj.estRuntime+minTimeBpuData.processingTimePerExperiment);
  callback(null, resObj);
};

exports.processReq=function(app, reqObj, bpuObjs, minTimeBpuData, callback) {
  if(minTimeBpuData===null) {
    callback('minTimeBpuData was null', null, null);
  } else {
    var getResXml=function(err, resObj) {
      var resXml=getResXmlFromResObj(Types[resObj.type], resObj);
      if(resXml!==null && resXml!==undefined) {
        callback(null, err, resXml);
      } else {
        callback('failed getResXmlFromResObj', err, null);
      }
    };
    if(Types[reqObj.type].type==='Cancel') {
      processCancel(app, reqObj, bpuObjs, minTimeBpuData, function(err, resObj) {
        resObj.type=reqObj.type;
        getResXml(err, resObj);
      });
    } else if(Types[reqObj.type].type==='GetEffectiveQueueLength') {
      processGetEffectiveQueueLength(app, reqObj, bpuObjs, minTimeBpuData, function(err, resObj) {
        console.log('\t'+'processGetEfectiveQueueLength'+
          ' effectiveQueueLength:'+resObj.effectiveQueueLength+
          ' estWait:'+resObj.estWait+
          ' with err:'+resObj.errorMessage);
        resObj.type=reqObj.type;
        getResXml(err, resObj);
      });
    } else if(Types[reqObj.type].type==='GetExperimentStatus') {
      processGetExperimentStatus(app, reqObj, bpuObjs, minTimeBpuData, function(err, resObj) {
        console.log('\t'+'processGetExperimentStatus'+
          ' soap ID:'+reqObj.experimentID+
          ' statusCode:'+resObj.statusCode+
          ' estRuntime:'+resObj.estRuntime+
          ' estRemainingRuntime:'+resObj.estRemainingRuntime+
          ' minTimetoLive:'+resObj.minTimetoLive+
          ' effectiveQueueLength:'+resObj.effectiveQueueLength+
          ' estWait:'+resObj.estWait+
          ' with err:'+resObj.errorMessage);
        resObj.type=reqObj.type;
        getResXml(err, resObj);
      });
    } else if(Types[reqObj.type].type==='GetLabConfiguration') {
      processGetLabConfiguration(app, reqObj, bpuObjs, minTimeBpuData, function(err, resObj) {
        resObj.type=reqObj.type;
        getResXml(err, resObj);
      });
    } else if(Types[reqObj.type].type==='GetLabStatus') {
      processGetLabStatus(app, reqObj, bpuObjs, minTimeBpuData, function(err, resObj) {
        console.log('\t'+'processGetLabStatus isOnline:'+resObj.online+' with err:'+err);
        resObj.type=reqObj.type;
        getResXml(err, resObj);
      });
    } else if(Types[reqObj.type].type==='RetrieveResult') {
      processRetrieveResult(app, reqObj, bpuObjs, minTimeBpuData, function(err, resObj) {
        console.log('\t'+'processRetrieveResult'+
          ' soap ID:'+reqObj.experimentID+
          ' statusCode:'+resObj.statusCode+
          ' experimentResults length:'+resObj.experimentResults.length+
          ' with err:'+resObj.errorMessage);
        resObj.type=reqObj.type;
        getResXml(err, resObj);
      });
    } else if(Types[reqObj.type].type==='Submit') {
      processSubmit(app, reqObj, bpuObjs, minTimeBpuData, function(err, resObj) {
        console.log('\t'+'processSubmit'+
          ' soap ID:'+resObj.labExperimentID+
          ' isAccecpted:'+resObj.accepted+
          ' estRuntime:'+resObj.estRuntime+
          ' minTimetoLive:'+resObj.minTimetoLive+
          ' effectiveQueueLength:'+resObj.effectiveQueueLength+
          ' estWait:'+resObj.estWait+
          ' with err:'+resObj.errorMessage);
        resObj.type=reqObj.type;
        getResXml(err, resObj);
      });
    } else if(Types[reqObj.type].type==='Validate') {
      processValidate(app, reqObj, bpuObjs, minTimeBpuData, function(err, resObj) {
        console.log('\t'+'processValidate'+
          ' isAccecpted:'+resObj.accepted+
          ' estRuntime:'+resObj.estRuntime+
          ' with err:'+resObj.errorMessage);
        resObj.type=reqObj.type;
        getResXml(err, resObj);
      });
    }
  }
};

//Ret Results Helper
var _verifyAndBinExpTarFile=function(exp, callback) {
  exp.tarFileLocation='/myData/mServer/'+exp.bpu.name+'_'+exp.tarFilename+'.gz';
  var tarFileLocation=exp.tarFileLocation;
  if(tarFileLocation!==null && tarFileLocation!==null && 
      typeof tarFileLocation==='string' && tarFileLocation.length>0) {
    fs.stat(tarFileLocation, function(err, stat) {
      if(err) {
        callback('stat err:'+err, null);
      } else {
        _base64aTarGz(exp.tarFileLocation, true, function(err, binFilePath) {
          if(err) {
            callback('_base64aTarGz err:'+err, null);
          } else {
            fs.readFile(binFilePath, 'utf8', function(err, data) {
              if(err) {
                callback('readFile err:'+err, null);
              } else {
                console.log('................................', data.length);
                callback(null, data);
              }
            });
          }
        });
      }
    });
  }
};
var _base64aTarGz=function(tarFile, doOneLine, callback) {
  var filename='';   
  var parts=tarFile.split('.');
  parts.pop(); parts.pop(); 
  parts.forEach(function(item) {filename+=item;}); 
  if(doOneLine) {filename=filename;}
  var outFilename=filename+'.bin';
  var cmd='base64 '+tarFile+' >'+outFilename;
  console.log(cmd);
  var child=exec(cmd, function (error, stdout, stderr) {
    if(error!==null) {
      callback('_base6aTarGz exec error: ' + error, null)
    } else if(stderr.length>0) {
      callback('_base6aTarGz stderr: ' + stderr, null);
    } else {
      if(doOneLine) {
        _removeNewLinesFromFile(outFilename, function(err, newOutFilename) {
          if(err) {
            callback('_base6aTarGz _removeNewLinesFromFile err: ' + err, null);
          } else {
            callback(null, newOutFilename);
          }
        });
      } else {
        callback(null, outFilename);
      }
    }
  });
};
var _removeNewLinesFromFile=function(inFile, callback) {
  var filename='';   
  var parts=inFile.split('.');
  parts.pop();
  parts.forEach(function(item) {filename+=item;}); 
  var outFilename=filename+'_delined.bin';
  var cmd="tr -d '\n' <  "+inFile+' >'+outFilename
  var child=exec(cmd, function (error, stdout, stderr) {
    if(error!==null) {
      callback('_removeNewLinesFromFile exec error: ' + error, null)
    } else if(stderr.length>0) {
      callback('_removeNewLinesFromFile stderr: ' + stderr, null)
    } else {
      callback(null, outFilename);
    }
  });
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
var getReqObjFromType=function(theType, body) {
  var retObj={};
  var tags=theType.reqTags
  tags.forEach(function(item) {
    retObj[item]=getXmlTag(item, body, true);
  });
  return retObj;
};
var getSoapType=function(xml) {
  var retValue=null; 
  var typeLine=getXmlTag('<soap:Body>', xml ,true);
  var stop=typeLine.search('xmlns');
  if(stop>-1) {
    retValue=typeLine.substring(0, stop);
  };
  if(retValue) {
    retValue=makeLetterNumber(retValue);
  }
  return retValue;
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
