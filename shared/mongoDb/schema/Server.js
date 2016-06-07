'use strict';
var _SchemaName='Server';

var async=require('async');
var fs=require('fs');
//Directories
var mserverBaseDir=__dirname.substr(0, __dirname.search('shared'));
var mainConfigFile=mserverBaseDir+'shared/'+'mainConfig';
var readyMongoFolder='/myData/bpu/readyMongo';
var tarsFolder='/myData/bpu/tars';
var mServerTarFolder='/myData/mServer';
var mServerDataReadyMongoFolder=mserverBaseDir+'/'+'datadump'+'/'+'readyMongo';
//Functions
var getDocById=function(app, id, callback) {
  app.db.models.Server.findById(id, {}, function(err, mongoDoc) {
    if(err) {
      callback(_SchemaName+' Schema:getDocById:err:'+err, null);
    } else if(mongoDoc===null) {
      callback(_SchemaName+' Schema:getDocById:err:'+'was null', null);
    } else {
      callback(null, mongoDoc);
    }
  });
};
var getDocByName=function(app, name, callback) {
  app.db.models.Server.findOne({name:name}, {}, function(err, mongoDoc) {
    if(err) {
      callback(_SchemaName+' Schema:getDocByName:err:'+err, null);
    } else if(mongoDoc===null) {
      callback(_SchemaName+' Schema:getDocByName:err:'+'was null', null);
    } else if(mongoDoc.name!==bpuName) {
      callback(_SchemaName+' Schema:getDocByName:err:'+'names do not match', null);
    } else {
      callback(null, mongoDoc);
    }
  });
};

exports=module.exports = function(app, mongoose) {
  var mySchema = new mongoose.Schema({
    index: { type: Number, default: -1 },
    name: { type: String, default: 'default' },
    description: { type: String, default: 'default' },
    type: { type: String, default: 'default' },
    isOn: { type:Boolean, default: false },
    dateTurnOn: { type:Date, default: null },
  });
  mySchema.index({ name: 1 });
  mySchema.set('autoIndex', app.config.isDevelopment);
  app.db.model(_SchemaName, mySchema);
  mySchema.statics.setServerInDb=function(serverJson, mainCallback) {
  };
};

