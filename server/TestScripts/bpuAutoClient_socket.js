var clientIO=require('socket.io-client');
var autoUserData=require('./data_autoUser.json');

var autoUserName='auto_user';
var autoUserType='pop1';


var mServerAddr='http://171.65.103.23';
var min=60;
var resendInterval=(min*60)*1000;
var isRunning=false;
var socket=clientIO(mServerAddr, {multiplex:false});
socket.on('connect', function () {
  console.log('connect to '+mServerAddr);
  socket.emit('/autoUser/#setConnection');
});
socket.on('/autoUser/#setConnectionRes', function (systemStatus) {
  console.log('/autoUser/#setConnectionRes', new Date().getTime());
  console.log(systemStatus.connectedBPUs);
  var connectedBPUs=systemStatus.connectedBPUs;
  var sendAuto=function() {
    console.log('SendAuto isRunning:', isRunning);
    if(!isRunning) {
      isRunning=true;
      var timeNow=new Date().getTime();
      var dataToSend=[]; 
      connectedBPUs.forEach(function(name) {
        var data={ 
          sessionID:timeNow+name,
          username:autoUserName,
          isLive:false,
          isAuto:true,
          autoType:autoUserType,
          useBpu:name,
          data:autoUserData, 
        }
        dataToSend.push(data);
      });
      var sendNext=function() {
        if(dataToSend.length>0) {
          var data=dataToSend.pop();
          console.log('sending', data.useBpu);
          socket.emit('/autoUser/#addTestScript', data);
          setTimeout(sendNext, 1000);
        } else {
          console.log('calling back in '+resendInterval+'ms');
          isRunning=false;
          setTimeout(sendAuto, resendInterval);
        }
      };
      sendNext();
    }
  }
  if(systemStatus.hasNoBPUs) {
    console.log('BPUs are all down.  Refresh Browser to check again');
    setTimeout(sendAuto, resendInterval);
  } else if(systemStatus.isQueueFull) {
    console.log('Queue is Full.  Refresh Browser to check again');
    setTimeout(sendAuto, resendInterval);
  } else {sendAuto();}
});
socket.on('disconnect', function(msg) {
  console.log('disconnect');
});
socket.on('error', function(msg) {
  console.log('err '+msg);
});
