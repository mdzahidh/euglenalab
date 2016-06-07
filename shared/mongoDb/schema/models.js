'use strict';

var schemaPath='./';

exports = module.exports = function(app, mongoose) {
  require(schemaPath+'/Note')(app, mongoose);
  require(schemaPath+'/Status')(app, mongoose);
  require(schemaPath+'/StatusLog')(app, mongoose);
  require(schemaPath+'/Category')(app, mongoose);
  
  require(schemaPath+'/BpuExperiment')(app, mongoose);
  require(schemaPath+'/Bpu')(app, mongoose);
  require(schemaPath+'/BpuGroup')(app, mongoose);
  require(schemaPath+'/Group')(app, mongoose);
  require(schemaPath+'/ListExperiment')(app, mongoose);
  require(schemaPath+'/SoapReq')(app, mongoose);

  require(schemaPath+'/User')(app, mongoose);
  require(schemaPath+'/Admin')(app, mongoose);
  require(schemaPath+'/AdminGroup')(app, mongoose);
  require(schemaPath+'/Account')(app, mongoose);
  require(schemaPath+'/LoginAttempt')(app, mongoose);
  
  require(schemaPath+'/Server')(app, mongoose);
  require(schemaPath+'/Session')(app, mongoose);

  //require(schemaPath+'/AutoUserStatsManager')(app, mongoose);
  require(schemaPath+'/UrlEvent')(app, mongoose);
  
  require(schemaPath+'/MyFunctions')(app, mongoose);
};
