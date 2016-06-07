var async=require('async');

//Mongoose
var mongoose=require('mongoose');
var mongoUri='mongodb://localhost:27017/'+'masterV2';

var app={
  //Object Requires
  mainConfig:require('../../shared/mainConfig.js'),
  genFuncs:require('../../genFuncs/general.js'),
  //Function Requires

  //Modules
  db:null,
  //Major Object 
  bpuDocs:null,
  bpuUpdateObj:{},

  //Debug
  debug:{ 
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
    require('../mongoModels')(app, mongoose);
    callback(null);
  });
};
var getBpuDocs=function(callback) {
  var query=app.db.models.Bpu.find({
    index:{ $in: ['0', '1', '2'] }
  });
  query.select({
    index:1, name:1, 
    performanceScores:1,
    pastPerformanceScores:1,
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
  //if(app.debug.doWriteTrimmedDocsToJson) initSeriesFuncs.push(debug_writeTrimmedDocsToJson);
  //Run Init Series
  async.series(initSeriesFuncs, function(err) {
    if(err) {
      callbackToMain('initSeries end err:'+err);
    } else {
      callbackToMain(null);
    }
  });
};


//Series Funcs
var refactorDocData=function(callbackToMain) {
  var actionFunc=function(actionCallback) {
    var doc=this.doc;
   
    //Fix PerformanceScores Object 
    //Fix PerformanceScores Object 
    var performanceScores=doc.performanceScores.toObject();
    //update old score name 
    if(performanceScores.lastSendDate) {
      performanceScores.bc_lastSendDate=performanceScores.lastSendDate;
      delete performanceScores.lastSendDate;
    }
    //remove old score names
    if(performanceScores.NextScript)     delete performanceScores.NextScript;
    if(performanceScores.activity)       delete performanceScores.activity;
    if(performanceScores.activityDate)   delete performanceScores.activityDate;
    if(performanceScores.populationDate) delete performanceScores.population;
    if(performanceScores.population)     delete performanceScores.populationDate;
    if(performanceScores.response)       delete performanceScores.response;
    if(performanceScores.responseDate)   delete performanceScores.responseDate;
    doc.performanceScores=performanceScores;

    //Fix Past Performance Score
    var newArry=[];
    doc.pastPerformanceScores.forEach(function(oldScore) {
      if(oldScore.date) {
        oldScore.processingDate=oldScore.date;
        delete oldScore.date;
        newArry.push(JSON.parse(JSON.stringify(oldScore)));
      } else {
        newArry.push(JSON.parse(JSON.stringify(oldScore)));
      }
    });
    
    doc.pastPerformanceScores=newArry;
    if(true) { 
    doc.save(function(err, newDoc) {
      if(err) {
        console.log(doc.name, 'refactorDocData save err:'+err);
      } else {
        console.log(doc.name, 'refactorDocData saved:', newDoc.name, newDoc._id);
      }
      actionCallback(null);
    });
    }
  };
  //Build Actions 
  var actionFuncs=[];
  app.bpuDocs.forEach(function(bpuDoc) {
    actionFuncs.push(actionFunc.bind({doc:bpuDoc})); 
  });
  actionFuncs.pop();
  actionFuncs.pop();
  //Start Actions 
  async.parallel(actionFuncs, function(err) {
    if(err) {
      callbackToMain('refactorDocData end '+err);
    } else {
      callbackToMain(null);
    }
  });
};
var printPastScores=function(callbackToMain) {
  var timeNow=new Date().getTime();
  console.log('scres  '+'\t'+'lastSendDate '+'\t'+'allowedGroups');
  var actionFunc=function(actionCallback) {
    var doc=this.doc;
    console.log(doc.name, doc.pastPerformanceScores.length);
    app.genFuncs.objArraySort(doc.pastPerformanceScores, 'newTime', true);
    var byType={};
    doc.pastPerformanceScores.forEach(function(pastScore) {
      if(pastScore.type==='scripterResponse') {
        if(byType[pastScore.type]===null || byType[pastScore.type]===undefined) {
          byType[pastScore.type]=[];
        }
        byType[pastScore.type].push(pastScore);
      }
    });
    Object.keys(byType).forEach(function(key) {
      var cnt=0;
      var zeroDate=new Date(byType[key][0].newTime);
      var preDate=new Date(byType[key][0].newTime);
      byType[key].forEach(function(score) {
        cnt++;
        var age=new Date()-new Date(score.newTime);
        var zeroAge=zeroDate-new Date(score.newTime);
        var preAge=preDate-new Date(score.newTime);
        console.log(
          app.genFuncs.addFrontZerosToNumber(cnt, 6),
          app.genFuncs.addFrontSpaceToString(key, 'scripterPopulation'.length),
          app.genFuncs.addDecimalZerosToNumber(Math.round(score.newValue*1000)/1000, 8), 
          app.genFuncs.addDecimalZerosToNumber(Math.round(age/60000), 8), 
          app.genFuncs.addDecimalZerosToNumber(Math.round(zeroAge/60000), 8),
          app.genFuncs.addDecimalZerosToNumber(Math.round(preAge/60000), 8),
          new Date(score.newTime));
        preDate=new Date(score.newTime);
      });
    });
  };
  //Build Actions 
  var actionFuncs=[];
  var debug_Limit=1; 
  var debug_limiter=-1;
  app.bpuDocs.forEach(function(bpuDoc) {
    debug_limiter++;
    if(debug_limiter<debug_Limit) {
      actionFuncs.push(actionFunc.bind({doc:bpuDoc})); 
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
var printCurrentScore=function(callbackToMain) {
  var timeNow=new Date();
  console.log('scres  '+'\t'+'lastSendDate '+'\t'+'allowedGroups');
  var actionFunc=function(actionCallback) {
    var doc=this.doc;
    var popAge=Math.round((timeNow-new Date(doc.performanceScores.scripterPopulationDate))/60000);
    var popScr=Math.round(doc.performanceScores.scripterPopulation*1000)/1000;
    var actAge=Math.round((timeNow-new Date(doc.performanceScores.scripterActivityDate))/60000);
    var actScr=Math.round(doc.performanceScores.scripterActivity*1000)/1000;
    var resAge=Math.round((timeNow-new Date(doc.performanceScores.scripterResponseDate))/60000);
    var resScr=Math.round(doc.performanceScores.scripterResponse*1000)/1000;
    console.log(doc.name, 
        'pop('+popScr+', '+popAge+')\t'+
        'act('+actScr+', '+actAge+')\t'+
        'res('+resScr+', '+resAge+')');
  };
  //Build Actions 
  var actionFuncs=[];
  app.bpuDocs.forEach(function(bpuDoc) {
    actionFuncs.push(actionFunc.bind({doc:bpuDoc})); 
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
    
    //Build Actions 
    var seriesFuncs=[];
    //seriesFuncs.push(refactorDocData); 
    //seriesFuncs.push(printPastScores); 
    seriesFuncs.push(printCurrentScore); 
    
    //Start Actions 
    async.series(seriesFuncs, function(err) {
      if(err) {
        console.log('series err:'+err);
      } else {
        console.log('series complete okay');
      }
    });
  }
});
