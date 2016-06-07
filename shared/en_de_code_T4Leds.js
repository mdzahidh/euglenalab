//Decoding
function getHeaderAndBody_deprecated(str) {
  retObj={};
  
  retObj.header=str.substr(0, 14);
  retObj.body=str.substr(14, str.length);
  return retObj;
}
function parseHeader(str) {
  var retObj={};
  retObj.version=str.substring(0, 2);
  retObj.len=str.substring(2, 4);
  retObj.sign=str.substring(4, 6);
  retObj.chunkSize=str.substring(6, 8);
  retObj.min=str.substring(8, 10);
  retObj.max=str.substring(10, 12);
  retObj.empty=str.substring(12, 14);
  return retObj;
}

function getHeaderAndBody(str) {
  retObj={};
  var version=str.substring(0, 2);
  var headerLen=parseInt(str.substring(2, 4), 16);
  retObj.header=str.substr(0, headerLen);
  retObj.body=str.substr(headerLen, str.length);
  return retObj;
}

function decodeHeader(obj) {
  var retObj={};
  Object.keys(obj).forEach(function(item) {
    if(item==='version' || item==='end') {retObj[item]=obj[item];
    } else {retObj[item]=parseInt(obj[item], 16);}
  });
  return retObj;
}
function parseBody(body, chunkSize) {
  var retObj=[];
  var len=body.length/chunkSize
  len+='';
  if(len.search('.')===-1) {return null;
  } else {
    for(var i=0;i<Number(len);i++) {
      var chunk='';
      if(i===0) {
        chunk=body.substr(i*chunkSize, chunkSize);
      } else {
        chunk=body.substr(i*chunkSize, chunkSize);
      }
      retObj.push({
        time:chunk.substr(0, 6),
        topValue:chunk.substr(6, 2),
        rightValue:chunk.substr(8, 2),
        bottomValue:chunk.substr(10, 2),
        leftValue:chunk.substr(12, 2),
      });
    }
    return retObj;
  }
}
function decodeBody(arr) {
  var retArr=[];
  arr.forEach(function(obj) {
    var retObj={}
    Object.keys(obj).forEach(function(item) {
      retObj[item]=parseInt(obj[item], 16);
    });
    retArr.push(retObj);
  }); 
  return retArr;
}
exports.decode=function(str, cb_fn) {
  var obj=getHeaderAndBody(str);
  obj.header=parseHeader(obj.header);
  obj.header=decodeHeader(obj.header);
  obj.body=parseBody(obj.body, obj.header.chunkSize);
  if(obj.body!==null) {
    obj.body=decodeBody(obj.body);
    cb_fn(null, obj.body); 
  } else {cb_fn('invalid body length', null);}
};

//Encoding
function indexByTime(arr) {
  arr.sort(function(a, b) {return Number(a.time)-Number(b.time)});
  var i=0; 
  arr.forEach(function(item) {item.index=i;i++;});
  return arr;
}
function convertArrayToHex(arr) {
  var retArr=[];
  arr.forEach(function(obj) {
    var retO={};
    Object.keys(obj).forEach(function(item) {
      if(item==='index') {retO[item]=obj[item]
      } else {retO[item]=Number(obj[item]).toString(16);}
    });
    retArr.push(retO);
  });
  return retArr;
}
function fixLength(d, length) {
  if(d.length<length) {
    var len=length-d.length;
    for(var i=0;i<len;i++) {d='0'+d;}
  } 
  return d;
} 
function fixHexLengths(arr) {
  var retArr=[];
  arr.forEach(function(obj) {
    var retO={};
    Object.keys(obj).forEach(function(item) {
      var len=2;
      if(item==='time') {len=6}
      retO[item]=fixLength(obj[item], len); 
    });
    retArr.push(retO);
  });
  return retArr;
}
function stringifyHexObjects(arr) {
  var retArr=[];
  arr.forEach(function(obj) {
    var retO={
      index:obj.index,
      str:obj.time+obj.topValue+obj.rightValue+obj.bottomValue+obj.leftValue,
    };
    retArr.push(retO);
  });
  return retArr;
}
function makeStringData(arr) {
  var retStr='';
  arr.sort(function(a, b) {return a.index-b.index;});
  arr.forEach(function(item) {retStr+=item.str;});
  return retStr;
}
function makeHeader(arr) {
  var version='3a';                                               //2
  var len=fixLength(Number(16).toString(16), 2);                  //4
  var sign=fixLength(Number(0).toString(16), 2);                  //6
  var chunkSize=fixLength(Number(6+2+2+2+2).toString(16), 2);     //8
  var min=fixLength(Number(0).toString(16), 2);                   //10
  var max=fixLength(Number(100).toString(16), 2);                 //12
  var empty=fixLength(Number(0).toString(16), 2);                 //14
  var ender=fixLength(Number(255).toString(16), 2);               //16
  var header=version+len+sign+chunkSize+min+max+empty+ender;
  return header;
}
exports.encode=function(arr, cb_fn) {
  arr=indexByTime(arr);
  arr=convertArrayToHex(arr);
  arr=fixHexLengths(arr);
  arr=stringifyHexObjects(arr);
  var dataStr=makeStringData(arr);
  var header=makeHeader();
  cb_fn(null, header+dataStr);
};

