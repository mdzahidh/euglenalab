var async=require('async');

//Mongoose
var mongoose=require('mongoose');
var mongoUri='mongodb://localhost:27017/'+'master';
//Socket Client
var socketIoClient=require('socket.io-client');
var socketClientServerIP='localhost';
var socketClientServerPort='4200';

var app={
  //Object Requires
  mainConfig:require('../shared/mainConfig.js'),
  genFuncs:require('../genFuncs/general.js'),
  trimmedBpuDocs:require('./debug/trimmedBpuDocs.json'),
  //Function Requires

  //Modules
  db:null,
  //Major Object 
  bpuDocs:null,
  bpuUpdateObj:{},

  //Debug
  debug:{ 
    doWriteTrimmedDocsToJson:true,
    pathToWriteTrimmedDocsToJson:'./debug/trimmedBpuDocs.json',
  },

  //Run Parameters of Interest
  updateCounter:0,
  updateFailedCounter:0,
  noUpdateCounter:0,
};

//Init Functions
var setupMongoose=function(callback) {
  app.db=mongoose.createConnection(mongoUri);
  app.db.on('error', function(err) {
    callback('init setupMongoose error:'+err);
  });
  app.db.once('open', function () {
    require('./mongoModels')(app, mongoose);
    callback(null);
  });
};
var getBpuDocs=function(callback) {
  var query=app.db.models.Bpu.find({
  });
  query.select({
    index:1, name:1, 
    isOn:1, 
    allowedGroups:1
  });
  query.exec(function(err, docs) {
    if(err) {
      callback('getBpuDocs '+err);
    } else if(docs===null || docs===undefined) {
      callback('getBpuDocs '+'docs===null || docs===undefined');
    } else if(docs.length===0) {
      callback('getBpuDocs '+'docs.length===0');
    } else {
      app.bpuDocs=docs;
      app.bpuDocs.sort(function(objA, objB) {return objA.index-objB.index;});
      callback(null);
    }
  }); 
};
var debug_writeTrimmedDocsToJson=function(callback) {
  //Trim Docs
  var writeObj={};
  Object.keys(app.bpuDocs).forEach(function(key) {
    writeObj[app.bpuDocs[key].name]={
      index:app.bpuDocs[key].index,
      name:app.bpuDocs[key].name,
      isOn:app.bpuDocs[key].isOn,
      allowedGroups:app.bpuDocs[key].allowedGroups
    };
  });
  app.genFuncs.writeObjectToJson(app.debug.pathToWriteTrimmedDocsToJson, writeObj, function(err) {
    if(err) {
      callback(err);
    } else if(debug_writeTrimmedDocsToJson) {
      callback('debug_writeTrimmedDocsToJson is true: i do not want read/update db.bpu and write');
    } else {
      callback(null);
    }
  });
};

//Init Function
var init=function(callbackToMain) {
  //Build Init Series 
  var initSeriesFuncs=[];
  initSeriesFuncs.push(setupMongoose);
  initSeriesFuncs.push(getBpuDocs);
  if(app.debug.doWriteTrimmedDocsToJson) initSeriesFuncs.push(debug_writeTrimmedDocsToJson);
  //Run Init Series
  async.series(initSeriesFuncs, function(err) {
    if(err) {
      callbackToMain('initSeries end err:'+err);
    } else {
      callbackToMain(null);
    }
  });
};

var updateMongoDbWithBpuInfo=function(callbackToMain) {
  console.log('name  '+'\t'+'isOn '+'\t'+'allowedGroups');
  var actionFunc=function(actionCallback) {
    var doc=this.doc;
    var json=this.json;
    var hadUpdate=false;
    Object.keys(json).forEach(function(key) {
      if(doc[key]!==null && doc[key]!==undefined) {
        if(doc[key].forEach) {
          var elemObj={};
          doc[key].forEach(function(docArrElem) {
            elemObj[docArrElem]=1;
          });
          json[key].forEach(function(jsonArrElem) {
            if(elemObj[jsonArrElem]===null || elemObj[jsonArrElem]===undefined) {
              hadUpdate=true;
              elemObj[jsonArrElem]=1;
            } else {
              elemObj[jsonArrElem]++;
            }
          });
          Object.keys(elemObj).forEach(function(key) {
            if(elemObj[key]!==2) hadUpdate=true;
          });
          if(hadUpdate) {
            doc[key]=json[key];
          }
        } else if(doc[key]!==json[key]) {
          hadUpdate=true;
          doc[key]=json[key];
        } else {
          console.log(doc.name, key, doc[key], json[key], doc[key]!==json[key]);
        }
      }
    });
    if(hadUpdate) {
      doc.save(function(err, savedDoc) {
        if(err) {
          app.updateFailedCounter++;
        } else {
          app.updateCounter++;
          console.log(savedDoc.name+'\t'+savedDoc.isOn+'\t'+savedDoc.allowedGroups);
        }
        actionCallback(null);
      }); 
    } else {
      app.noUpdateCounter++;
      actionCallback(null);
    }
  };
  //Build Actions 
  var actionFuncs=[]; 
  app.bpuDocs.forEach(function(bpuDoc) {
    if(app.trimmedBpuDocs[bpuDoc.name]) {
      actionFuncs.push(actionFunc.bind({doc:bpuDoc, json:app.trimmedBpuDocs[bpuDoc.name]})); 
    }
  });
  //Start Actions 
  async.parallel(actionFuncs, function(err) {
    if(err) {
      callbackToMain('async end '+err);
    } else {
      callbackToMain(null);
    }
  });
};

//Init Controller and RUn Loop
init(function(err) {
  if(err) {
    console.log('init err:'+err);
  } else {
    updateMongoDbWithBpuInfo(function(err) {
      if(err) {
        console.log('updateMongoDbWithBpuInfo err:'+err);
      } else {
        console.log('complete okay('+
            'docs:'+app.bpuDocs.length+
            ', jsons:'+Object.keys(app.trimmedBpuDocs).length+
            ', updates:'+app.updateCounter+
            ', failedUpdate:'+app.updateFailedCounter+
            ', noUpdates:'+app.noUpdateCounter+
            ', '+')');
      }
    });
  }
});
