'use strict';


var async=require('async');
var fs=require('fs');

var _SchemaName='ListExperiment';
exports = module.exports = function(app, mongoose) {
  //Schema Base
  var _mySchema=new mongoose.Schema({
    _lostList:{type:Array, default:[]},
    newExps:{type:Array, default:[]},
    eug0:{type:Array, default:[]},
    eug1:{type:Array, default:[]},
    eug2:{type:Array, default:[]},
    eug3:{type:Array, default:[]},
    eug15:{type:Array, default:[]},
    eug16:{type:Array, default:[]},
    eug18:{type:Array, default:[]},
    eug19:{type:Array, default:[]},
    eug20:{type:Array, default:[]},
  });
  
  //Script Additions
  
  //Default Additions
  _mySchema.plugin(require('./plugins/pagedFind'));
  _mySchema.index({ search: 1 });
  if(app.config) _mySchema.set('autoIndex', (app.get('env') === 'development'));
  
  //How to get document
  _mySchema.statics.getInstanceDocument=function(mainCallback) {
    var funcName='getInstanceDocument';
    var thisSchema=this;
    thisSchema.find({}, {}, function(err, docs) {
      if(err) {
        mainCallback(err, null);
      } else {
        //Find a Doc
        var doc=null;
        
        //Create a new doc 
        if(docs.length===0) {
          doc=thisSchema(); //Creates a new list experiment?
          doc.save(function(err, saveDoc) {
            //Callback
            if(typeof mainCallback==='function') mainCallback(err, saveDoc);
          }); 
        
        //Remove older docs 
        } else if(docs.length>1) {
          docs.sort(function(objA, objB) {return objB._id.getTimestamp()-objA._id.getTimestamp();});
          doc=docs[0];
          app.db.models.ListExperiment.remove({_id:{$lt:docs[0]._id}}, function(err, info) {
            if(typeof mainCallback==='function') mainCallback(null, doc);
          });
        
        //Use the only Doc 
        } else {
          doc=docs[0];
          //Callback
          if(typeof mainCallback==='function') mainCallback(null, doc);
        }
      }
    });
  };

  //Functions
  //addNewExpTagToList
  _mySchema.statics.addNewExpTagToList=function(expTag, mainCallback) {
    app.db.models.ListExperiment.getInstanceDocument(function(err, doc) {
      if(err) {
        mainCallback('getInstanceDocument '+err);
      } else {
        doc.addNewExpTagToList(expTag, mainCallback);
      }
    });
  };
  _mySchema.methods.addNewExpTagToList=function(expTag, mainCallback) {
    var thisDoc=this;
    app.db.models.ListExperiment.update({_id:thisDoc._id}, {$push: {newExps:expTag}}, function(err, newDoc) {
      if(err) {
        mainCallback('ListExperiment.update '+err);
      } else {
        mainCallback(null, newDoc);
      }
    });
  };
  //getOneList
  _mySchema.methods.nc_getOneList=function() {
    var thisDoc=this;
    var oneList=[];
    Object.keys(app.listExperimentDoc._doc).forEach(function(key) {
      if(key[0]!=='_' && (key.search('eug')>-1 || key==='newExps')) {
        oneList=oneList.concat(app.listExperimentDoc[key]);
      }
    });
    return oneList;
  };
  _mySchema.methods.nc_clearBpuLists=function() {
    var thisDoc=this;
    Object.keys(thisDoc._doc).forEach(function(key) {
      if(key[0]!=='_' && (key.search('eug')>-1)) {
        thisDoc[key]=[];
      }
    });
  };
  _mySchema.methods.nc_printBpuLists=function(inObj) {
    var thisDoc=this;
    if(inObj) {
      Object.keys(inObj).forEach(function(key) {
        if(key[0]!=='_' && (key.search('eug')>-1 || key==='newExps')) {
          console.log(key, inObj[key].length);
        }
      });
    } else {
      Object.keys(app.listExperimentDoc._doc).forEach(function(key) {
        if(key[0]!=='_' && (key.search('eug')>-1 || key==='newExps')) {
          console.log(key, app.listExperimentDoc[key].length);
        }
      });
    }
  };
  //Done
  app.db.model('ListExperiment', _mySchema);
};
