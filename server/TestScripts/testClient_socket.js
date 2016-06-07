var clientIO=require('socket.io-client');
var testUserData=require('./data_testUser.json');

var mServerAddr='http://171.65.102.138:3000';
//var mServerAddr='http://192.168.1.100:3100';

var socket=clientIO(mServerAddr, {multiplex:false});
socket.on('connect', function () {
  console.log('connect to '+mServerAddr);
});
socket.on('connectionRes', function (res) {
  console.log('connectionRes to '+res);
  socket.emit('addTextUser', testUserData)
});
socket.on('disconnect', function(msg) {
  console.log('disconnect');
});
socket.on('error', function(msg) {
  console.log('err '+msg);
});
