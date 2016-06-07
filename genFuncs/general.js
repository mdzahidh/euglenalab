var exec=require('child_process').exec;
var fs=require('fs');
var mongoose=require('mongoose');
//See bottom for function list and headings

//Print 
var _clearConsole=function(cmdStr) {
  console.log('\033c');
};
var _addFrontSpaceToString=function(str, len) {
  while(str.length<len) str=' '+str;
  return str;
};
var _addFrontZerosToNumber=function(num, len) {
  var str=''+num;
  while(str.length<len) str='0'+str;
  return str;
};
var _addDecimalZerosToNumber=function(num, len) {
  if(typeof num==='number' && typeof num==='number') {
    if(len<3) len=3;
    var str=''+num;
    if(str==='0') {
      str='0.0';
    } else {
      var iDec=str.indexOf('.');
      if(iDec===-1) str=str+'.';
    }
    while(str.length<len) str+='0';
    return str;
  } else {
    return Number('NaN');
  }
};

//Array
var _objArraySort=function(arr, prop, doReverse) {
  if(doReverse!==null && doReverse!==undefined && !doReverse) {
    return arr.sort(function(objA, objB) {return objB[prop]-objA[prop];});
  } else {
    return arr.sort(function(objA, objB) {return objA[prop]-objB[prop];});
  }
};

//Write to File
var _writeObjectToJson=function(fullPath, object, callback) {
  fs.writeFile(fullPath, JSON.stringify(object, null, 4), function(err) {
    callback(err);
  });
};
//Running Scripts
var _runBashCommand=function(cmdStr, callback) {
  var child=exec(cmdStr, function (error, stdout, stderr) {
    if(error!==null) {callback('error: ' + error, stdout);
    } else if(stderr) {callback('stderr: ' + stderr, stdout);
    } else if(stdout) {callback(null, stdout);
    } else {callback(null, null);}
  });
};

//Mongo
var _getMongoObjectIdFromTimestamp=function(timestamp) {
  // Convert string date to Date object (otherwise assume timestamp is a date)
  if(typeof(timestamp)=='string') {
    timestamp=new Date(timestamp);
  }
  // Convert date object to hex seconds since Unix epoch
  var hexSeconds=Math.floor(timestamp/1000).toString(16);
  // Create an ObjectId with that hex timestamp
  var constructedObjectId=mongoose.Types.ObjectId(hexSeconds+"0000000000000000");
  return constructedObjectId;
};

//Print 
exports.clearConsole=_clearConsole;
exports.addFrontSpaceToString=_addFrontSpaceToString;
exports.addFrontZerosToNumber=_addFrontZerosToNumber;
exports.addDecimalZerosToNumber=_addDecimalZerosToNumber;
//Array
exports.objArraySort=_objArraySort;
//Write to File 
exports.writeObjectToJson=_writeObjectToJson;
//Running Scripts
exports.runBashCommand=_runBashCommand;
//Mongo
exports.getMongoObjectIdFromTimestamp=_getMongoObjectIdFromTimestamp;
