'use strict';

var mainConfig=require('../shared/mainConfig.js');
var myMongoUri=mainConfig.adminFlags.getMongoUri();
var myServerPort=mainConfig.adminFlags.getWebServerPort();
var myServerAddr=mainConfig.adminFlags.getWebServerAddr();
var myWebServerName =mainConfig.adminFlags.getWebServerName();
var myWebServerIdentifier = mainConfig.adminFlags.getWebServerIdentifier();

exports.mainConfig=mainConfig;
exports.port = process.env.PORT || myServerPort;
exports.mongodb = {
  uri: process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || myMongoUri
};
exports.isDevelopment=true;
