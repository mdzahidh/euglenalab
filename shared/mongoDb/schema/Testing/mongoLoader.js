'use strict';
var _ScriptName='mongoLoader';
//Node deps  
var async=require('async');
var mongoose=require('mongoose');
var log4js=require('log4js');
//My deps  
var config=require('../../../../server/config.js');
var myFunctions=require('../../../myFunctions.js');
//Main Object
var app = {
  get:function() {return 'development';},
  log4js:log4js,
};
//Setup Logger
var LOGGER_LEVELS=['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'];
var myLogger=app.log4js.getLogger(_ScriptName); 
myLogger.setLevel(LOGGER_LEVELS[0]);
myLogger.info('logger initialized');
//Server Config
app.config=config;
//setup db
myLogger.info('loading schemas');
app.db=mongoose.createConnection(config.mongodb.uri);
app.db.on('error', console.error.bind(console, 'mongoose connection error: '));
//Load Mongo Schemas
require('../models')(app, mongoose);

app.db.once('open', function () {
  //myFunctions.clearConsole();
  myLogger.info('ready');
  var bpus=['eug0', 'eug1', 'eug2','eug3','eug15', 'eug16'];
  var action=function(cb_fn) {
    var options={bpuName:this};
    console.log('start', options);
    app.db.models.AutoUserStatsManager.getBpuScore(options, function(err, dat) {
      console.log('end', options);
      if(err) {
        myLogger.error('AutoUserStatsManager.getBpuScore:'+err);
      } else {
        myLogger.trace(dat.bpuName+' has a score of '+dat.bpuScore);
      }
      cb_fn(null);
    });
  };
  //Run Action on elements
  app.db.models.MyFunctions.runActionOnArrayElements(action, bpus, function(err, data) {
    console.log('done');
    if(err) {
      //callback(err);
    } else {
      //callback(null);
    }
  });
});
