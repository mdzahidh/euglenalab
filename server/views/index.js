'use strict';
var __exec=require('child_process').exec;
var __fs=require('fs');

var renderSettings = function(req, res, next, oauthMessage) {
  var asyncFinally = function(err, results) {
    if (err) {
      return next(err);
    }
    res.render('index', {
      data: {
      },
    });
  };
  require('async').parallel([], asyncFinally);
};

exports.init = function(req, res, next){
  renderSettings(req, res, next, '');
};
