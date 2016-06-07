var clientIO=require('socket.io-client');
var fs=require('fs');
var mainConfig=require('./mainConfig.js');
var bpuDataPuller=require('./getBpuDataAndClean.js');
var myFunctions=require('./myFunctions.js');

var exp={
  _id:null,
  expId:'testClient',
  username:'testClient',
  usergroups:['default', 'admin'],
  isArray:true, 
  //eventsToRun:JSON.parse(JSON.stringify(mainConfig.BpuAutoLightData)),
  eventsToRun:JSON.parse(JSON.stringify(mainConfig.BpuTestLightData)),
};

//Local Functions
var checkForBpuData=function(callback) {
  bpuDataPuller.getData(bpuAddr, mainConfig.moveBpuDataFolders, function(err) {
    setTimeout(function() {
      callback(err);
    }, 1000);
  });
};
var failSafeTimeout=null;
var isFailSafeTimeoutRunning=false;
var failSafeResart=function(resetInterval) {
  if(!isFailSafeTimeoutRunning) {
    isFailSafeTimeoutRunning=true;
    failSafeTimeout=setTimeout(function() {
      socket.emit('resetBpu', {});
    }, resetInterval);
  }
};
//Socket
var bpuAddr='192.168.1.100'
var bpuPort='4000';
var bpuIp='http://'+bpuAddr+':'+bpuPort;
var socket=clientIO(bpuIp, {multiplex:false});
var isConnected=false;
console.log('connecting to '+bpuIp);
socket.on('connect', function () {
  clearTimeout(failSafeTimeout);
  if(isConnected) {  
    console.log('socket.on connect', 'AlreadyRunning');
  } else {
    isConnected=true;
    myFunctions.clearConsole();
    console.log('socket.on connect');
    checkForBpuData(function(err) {
      socket.emit('getStatus', {});
    });
  }
});
socket.on('disconnect', function(data) {
  clearTimeout(failSafeTimeout);
  console.log('socket.on disconnect', data);
  isConnected=false;
});
socket.on('reconnect', function(data) {
  clearTimeout(failSafeTimeout);
  console.log('socket.on reconnect', data);
  isConnected=false;
});
socket.on('error', function(data) {
  clearTimeout(failSafeTimeout);
  console.log('socket.on ererrorr ', data);
});

socket.on('/mServer/#ledsSetRes', function(data) {
  clearTimeout(failSafeTimeout);
  console.log('socket.on /mServer/#ledsSetRes ', data);
});
socket.on('/mServer/#getStatusRes', function(data) {
  clearTimeout(failSafeTimeout);
  console.log('/mServer/#getStatusRes', data);
  if(data.bpuStatus===mainConfig.bpuStatusTypes.bpuNull) {
    failSafeResart(10000);
    socket.emit('createBpu', {});
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.initializing) {
    failSafeResart(10000);
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.initializingDone) {
    failSafeResart(10000);
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.initializingFailed) {
    failSafeResart(1000);
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.expRunning) {
    failSafeResart(10*60*1000);
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.dataPacking) {
    failSafeResart(10*60*1000);
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.dataPackingFailed) {
    failSafeResart(1000);
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.dataProcessing) {
    failSafeResart(10*60*1000);
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.dataProcessingFailed) {
    failSafeResart(1000);
  } else if(data.bpuStatus===mainConfig.bpuStatusTypes.dataReady) {
    failSafeResart(10000);
    checkForBpuData(function(err) {
      setTimeout(function() {
        socket.emit('resetBpu', {});
      }, 1000);
    });
  }
});

socket.on('/mServer/#createBpuRes', function(data) {
  clearTimeout(failSafeTimeout);
  failSafeResart(10000);
  console.log('socket.on /mServer/#createBpuRes ', data);
});
socket.on('/mServer/#addExpRes', function(data) {
  clearTimeout(failSafeTimeout);
  failSafeResart(10*60*1000);
  console.log('socket.on /mServer/#addExpRes ', data);
});
socket.on('/mServer/#resetBpuRes', function(data) {
  clearTimeout(failSafeTimeout);
  failSafeResart(10000);
  console.log('socket.on /mServer/#resetBpuRes ', data);
  socket.emit('getStatus', {});
});

socket.on('/mServer/#initDone', function(data) {
  clearTimeout(failSafeTimeout);
  failSafeResart(10000);
  console.log('socket.on /mServer/#initDone ', data);
  socket.emit('addExp', exp);
});
socket.on('/mServer/#dataComplete', function(data) {
  clearTimeout(failSafeTimeout);
  failSafeResart(10*60*1000);
  console.log('socket.on /mServer/#dataComplete ', data);
});
socket.on('/mServer/#dataReady', function(data) {
  clearTimeout(failSafeTimeout);
  console.log('socket.on /mServer/#dataReady ', data);
  failSafeResart(10000);
  checkForBpuData(function(err) {
    setTimeout(function() {
      socket.emit('resetBpu', {});
    }, 1000);
  });
});
