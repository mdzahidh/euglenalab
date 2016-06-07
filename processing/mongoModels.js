'use strict';
var schemaPath='../shared/mongoDb/schema';
exports = module.exports = function(app, mongoose, mainCallback) {
  require(schemaPath+'/Note')(app, mongoose);
  require(schemaPath+'/Bpu')(app, mongoose);
  require(schemaPath+'/BpuExperiment')(app, mongoose);
  require(schemaPath+'/ListExperiment')(app, mongoose);
  require(schemaPath+'/User')(app, mongoose);
  if(mainCallback) mainCallback(null);
};
