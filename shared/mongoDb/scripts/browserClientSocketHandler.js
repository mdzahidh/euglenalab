exports.connected=function(app, user, clientSocket, mainCallback) { 
  console.log(new Date()+':'+'connect');
  clientSocket.on('disconnect', function(msg) {
    console.log(new Date().getTime()+':'+'disconnect');
    clientSocket.disconnect();
    clientSocket.close();
  });
  clientSocket.on('/account/#ping', function() {
    console.log(new Date().getTime()+':'+'/account/#ping');
    clientSocket.emit('/account/#pingRes');
  });
  clientSocket.on('/account/#updateBpus', function(bpusUpdate) {
    //console.log(new Date().getTime()+':'+'/account/#updateBpus');
    bpusUpdate.forEach(function(bpu) {
      //console.log(bpu.name+':'+bpu.bpuStatus+':'+bpu.timeLeft);
    });
  });
  //Set Connection
  var setConnectionRes=function(conResData) { 
    console.log(new Date()+':'+'/account/#setConnectionRes', 'didPass:'+conResData.didPass, 'err:'+conResData.err);
    clientSocket.removeEventListener('/account/#setConnectionRes', setConnectionRes);
    if(!conResData.didPass) {
      mainCallback('failed with err:'+conResData.err);
    } else {
      mainCallback(null);
    }
  }
  clientSocket.on('/account/#setConnectionRes', setConnectionRes);
  var setConnectionData={
    username:user.username,
    socketID:user.socketID,
    sessionID:user.sessionID,
  };
  clientSocket.emit('/account/#setConnection', setConnectionData);
};
exports.accountJoinQueue=function(app, user, joinQueueReqData, clientSocket, mainCallback) {   
  var joinQueueReqRes=function(data, cb_fn) {
    var didTimeout=false;
    var didRespond=false;
    var resTimeout=setTimeout(function() {
      if(!didRespond) {
        didTimeout=true;
        cb_fn('timed out', null);
      }
    }, 5000);
    var emitStr='/account/#joinQueue';
    var resStr=emitStr+'Res';
    var response=function(resData) { 
      if(!didTimeout) {
        didRespond=true;
        clientSocket.removeEventListener(resStr, response);
        cb_fn(null, resData);
      }
    };
    clientSocket.on(resStr, response);
    clientSocket.emit(emitStr, data);
  };
  var confirmJoinQueue=function(timeout, cb_fn) {
    var didTimeout=false;
    var didRespond=false;
    var resTimeout=setTimeout(function() {
      if(!didRespond) {
        didTimeout=true;
        cb_fn('timed out', null);
      }
    }, timeout);
    if(!didTimeout) {
      didRespond=true;
      cb_fn(null, true);
    }
  }; 

  var goToLabReqRes=function(cb_fn) {
    var resStr='/account/#bpuRunningExp'+'Res';
    var response=function(resData) { 
      console.log(new Date()+':'+resStr, resData);
      clientSocket.removeEventListener(resStr, response);
      cb_fn(null, resData);
    };
    clientSocket.on(resStr, response);
  };
  var confirmGoToLabReqRes=function(timeout, cb_fn) {
    var didTimeout=false;
    var didRespond=false;
    var resTimeout=setTimeout(function() {
      if(!didRespond) {
        didTimeout=true;
        cb_fn('timed out', null);
      }
    }, timeout);
    if(!didTimeout) {
      didRespond=true;
      cb_fn(null, true);
    }
  }; 

  //Flow
  //Flow
  //Flow
  console.log('\nattempt joinQueueReqRes'); 
  joinQueueReqRes(joinQueueReqData, function(err, joinQueueResData) {
    console.log('joinQueueReqRes with err:'+err);
    if(err) {
      console.log('joinQueueReqRes err:'+err)
    } else {
      console.log('\nattempt confirmJoinQueue');
      confirmJoinQueue(joinQueueResData.confirmTimeout, function(err, isPositiveConfirmation) {
        console.log('confirmJoinQueue with err:'+err+' and confirm:'+isPositiveConfirmation);
        if(err || !isPositiveConfirmation) {
          clientSocket.emit('/account/#joinQueueResConfirm', {didConfirm:false});
        } else {
          console.log('\nattempt goToLabReqRes');
          goToLabReqRes(function(err, bpuRunningExpData) {
            console.log('goToLabReqRes with err:'+err);
            if(err) {
              clientSocket.emit('/account/#bpuRunningExpRes', {didConfirm:false});
              setTimeout(function() {
                mainCallback({goToLab:false, text:""});
              }, 200);
            } else {
              console.log('\nattempt confirmGoToLabReqRes');
              confirmGoToLabReqRes(bpuRunningExpData.confirmTimeout, function(err, isPositiveConfirmation) {
                console.log('confirmGoToLabReqRes with err:'+err+' and confirm:'+isPositiveConfirmation);
                if(err || !isPositiveConfirmation) {
                  clientSocket.emit('/account/#bpuRunningExpRes', {didConfirm:false});
                  setTimeout(function() {
                    mainCallback({goToLab:false, text:""});
                  }, 200);
                } else {
                  clientSocket.emit('/account/#bpuRunningExpRes', {didConfirm:true});
                  setTimeout(function() {
                    mainCallback({goToLab:true, text:"location.href = '/livejoylab/'"});
                  }, 200);
                }
              });
            }
          });
          clientSocket.emit('/account/#joinQueueResConfirm', {didConfirm:true});
        }
      });
    }
  });
};

