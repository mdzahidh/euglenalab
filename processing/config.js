'use strict';

var mainConfig=require('../shared/mainConfig.js');
var myMongoUri=mainConfig.adminFlags.getMongoUri();
var myServerPort=mainConfig.adminFlags.getServerPort();
var myServerAddr=mainConfig.adminFlags.getServerAddr();
exports.mainConfig=mainConfig;
exports.port = process.env.PORT || myServerPort;
exports.mongodb = {
  uri: process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || myMongoUri
};
exports.isDevelopment=true;
