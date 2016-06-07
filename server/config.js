'use strict';

var _systemEmail='euglena.hirk@gmail.com';

var zeroLeds={
  topValue:0,
  rightValue:0,
  bottomValue:0,
  leftValue:0,
}; 



var mainConfig=require('../shared/mainConfig.js');
var myMongoUri=mainConfig.adminFlags.getMongoUri();
var myServerPort=mainConfig.adminFlags.getServerPort();
var myServerAddr=mainConfig.adminFlags.getServerAddr();
var myControllerPort = mainConfig.adminFlags.getControllerPort();

exports.mainConfig=mainConfig;
exports.port = process.env.PORT || myServerPort;
exports.myServerPort = myServerPort;
exports.myServerAddr = myServerAddr;
exports.myControllerPort = myControllerPort;

exports.mongodb = {
  uri: process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || myMongoUri
};
exports.companyName = 'Riedel-Kruse Lab';
exports.projectName = 'Euglena Interactive BioTech';
exports.systemEmail=_systemEmail;
exports.cryptoKey = 'k3yb0ardc4t';
exports.loginAttempts = {
  forIp: 50,
  forIpAndUser: 7,
  logExpiration: '20m'
};
exports.requireAccountVerification = false;
exports.smtp = {
  from: {
    name: process.env.SMTP_FROM_NAME || exports.projectName +' Website',
    address: process.env.SMTP_FROM_ADDRESS || _systemEmail
  },
  credentials: {
    user: process.env.SMTP_USERNAME || _systemEmail,
    password: process.env.SMTP_PASSWORD || 'IngmarE350A',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    ssl: true
  }
};
exports.oauth = {
  twitter: {
    key: process.env.TWITTER_OAUTH_KEY || '',
    secret: process.env.TWITTER_OAUTH_SECRET || ''
  },
  facebook: {
    key: process.env.FACEBOOK_OAUTH_KEY || '',
    secret: process.env.FACEBOOK_OAUTH_SECRET || ''
  },
  github: {
    key: process.env.GITHUB_OAUTH_KEY || '',
    secret: process.env.GITHUB_OAUTH_SECRET || ''
  },
  google: {
    key: process.env.GOOGLE_OAUTH_KEY || '',
    secret: process.env.GOOGLE_OAUTH_SECRET || ''
  },
  tumblr: {
    key: process.env.TUMBLR_OAUTH_KEY || '',
    secret: process.env.TUMBLR_OAUTH_SECRET || ''
  }
};
