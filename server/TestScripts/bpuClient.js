var clientIO=require('socket.io-client');

var clearConsole=function() {
  console.log('\033c');
};
var bpuStatusTypes:{
  bpuNull:'bpu null',
  bpuCreateFailed:'bpu create failed',
  bpuCreateAccepted:'bpu create accepted',
  addExpFailed:'add exp failed',
  addExpAccepted:'add exp accepted',
  expRunning:'exp running', 
  expComplete:'exp complete', 
  expReady:'exp ready',
};

var mServerAddr='http://192.168.1.100:8090';
console.log('attempt connect to '+mServerAddr);
var socket=clientIO(mServerAddr, {multiplex:false});
socket.on('connect', function () {
  clearConsole();
  console.log('socket.on connect on '+mServerAddr+' id:'+socket.id);
  socket.emit('getStatus', {});
});
socket.on('disconnect', function(data) {
  console.log('socket.on disconnect', data);
});
socket.on('error', function(data) {
  console.log('socket.on ererrorr ', data);
});

//Rx Emits
socket.on('/mServer/#initDone', function(data) {
  console.log('socket.on /mServer/#initDone ', data);
});
socket.on('/mServer/#dataComplete', function(data) {
  console.log('socket.on /mServer/#dataComplete ', data);
});
socket.on('/mServer/#dataReady', function(data) {
  console.log('socket.on /mServer/#dataReady ', data);
});
//Rx Responses
socket.on('/mServer/#createBpuRes', function(data) {
  console.log('socket.on /mServer/#createBpuRes ', data);
});
socket.on('/mServer/#addExpRes', function(data) {
  console.log('socket.on /mServer/#addExpRes ', data);
});
socket.on('/mServer/#getStatusRes', function(data) {
  console.log('socket.on /mServer/#getStatusRes ', data);
});
socket.on('/mServer/#ledsSetRes', function(data) {
  console.log('socket.on /mServer/#ledsSetRes ', data);
});
