'use strict';
var handle='/admin_bpus';
var doPrintErr=true;
var doPrintInit=true;
var doPrint=true;
var myPrint=function(name, msg, init, err) {
  if(err!==null && err!==undefined && doPrintErr) {
    console.log('ERROR'+'\t'+handle+':'+name, err);
  } else if(init!==null && init!==undefined && doPrintInit) {
    console.log('INIT'+'\t'+handle+':'+name, init);
  } else if(doPrint) {
    console.log(handle+':'+name, msg);
  }
}; 

var socketIoClient=require('socket.io-client');
exports.setup=function(app, socket, callback) {
  myPrint(handle, 'setup', null, null);
  socket.on(handle+'/#setConnection', function(data) {
    myPrint(handle, 'setConnection', null, null);
    var resStr=handle+'/#setConnection'+'Res';
    var maxChecks=5; 
    var didFindBpu=false;
    var didFindBpuSocket=false;
    var checkForBpuConnected=function(cb_fn) {
      maxChecks--;
      if(maxChecks>0) {
        var bpuSocket=null;
        app.bpusConnected.forEach(function(bpuObj) {
          if(bpuObj.config.name===data.bpuName) {
            didFindBpu=true;
            if(bpuObj.socket!==null && bpuObj.socket!==undefined) {
              didFindBpuSocket=true;
              bpuSocket=bpuObj.socket;
            }
          }
        });
        if(didFindBpuSocket && didFindBpu && bpuSocket!==null) {
          cb_fn(null, didFindBpu, didFindBpuSocket, bpuSocket);
        } else {
          setTimeout(function() {
            checkForBpuConnected(cb_fn);
          }, 1000);
        }
      } else {
        if(!didFindBpu) {
          cb_fn(null, didFindBpu, didFindBpuSocket, null);
        } else if(!didFindBpuSocket) {
          cb_fn(null, didFindBpu, didFindBpuSocket, null);
        }
      }
    };
    checkForBpuConnected(function(err, didFindBpu, didFindBpuSocket, bpuSocket) {
      var resObj={
        didPass:false, didGetBpuStatus:false, bpuStatus:null,
        err:err,
        didFindBpu:didFindBpu,
        didFindBpuSocket:didFindBpuSocket,
      };
      if(err) {
        callback('checkForBpuConnected err:'+err, resObj);
        socket.emit(resStr, resObj);
      } else if(!didFindBpu) {
        resObj.err='checkForBpuConnected err:'+'did not find connected bpu in array';
        callback(resObj.err, resObj);
        socket.emit(resStr, resObj);
      } else if(!didFindBpuSocket) {
        resObj.err='checkForBpuConnected err:'+'connected bpu did not have a socket';
        callback(resObj.err, resObj);
        socket.emit(resStr, resObj);
      } else {
        socket.bpuSocket=bpuSocket;
        app.db.models.Bpu.getStatus({name:data.bpuName}, socket.bpuSocket, function(err, newDoc) {
          resObj.err=err;
          if(err) {
            callback(resObj.err, resObj);
            socket.emit(resStr, resObj);
          } else {
            socket.join('update-bpus');
            resObj.didGetBpuStatus=true;
            resObj.didPass=true;
            resObj.bpuStatus=newDoc.currentStatus;
            callback(null, resObj);
            socket.emit(resStr, resObj);
          }
        });
      }
    });
  });
  socket.on(handle+'/#flush', function(data) {
    var bpuSocket=null;
    app.bpusConnected.forEach(function(bpuObj) {
      if(bpuObj.config.name===data.bpuName) {
        if(bpuObj.socket!==null && bpuObj.socket!==undefined) {
          bpuSocket=bpuObj.socket;
        }
      }
    });
    if(bpuSocket!==null) {
      var flushTimeout=5000*2;
      if(data.flushTime) {
        flushTimeout=Number(data.flushTime)*2;
      }
      var emitStr='/admin_bpus/#flush';
      var resStr=emitStr+'Res';
      var didRespond=false; 
      setTimeout(function() {
        if(!didRespond) {
          didRespond=true;
          bpuSocket.removeEventListener(resStr, resFunc);
          socket.emit(handle+'/#flushRes', {err:'timeout'});
        }
      }, flushTimeout);
      var resFunc=function(resData) {   
        if(!didRespond) {
          bpuSocket.removeEventListener(resStr, resFunc);
          didRespond=true;
          socket.emit(handle+'/#flushRes', resData);
        }
      };
      bpuSocket.removeEventListener(resStr, resFunc);
      bpuSocket.addEventListener(resStr, resFunc);
      bpuSocket.emit(emitStr, data);
    }
  });
  socket.on(handle+'/#refreshGraphData', function(data) {
    myPrint(handle, 'refreshGraphData', null, null);
    var resStr=handle+'/#refreshGraphData'+'Res';
    var resData=data;
    app.db.models.AutoUserStatsManager.getOptions(data, function(err, options) {
      resData.options=options;
      if(err) {
        resData.err='getOptions err:'+ err;
        socket.emit(resStr, resData);
      } else {
        app.db.models.AutoUserStatsManager.buildGraph(options, function(err, graphUpdate) {
          if(err) {
            resData.err='buildGraph err:'+ err;
            socket.emit(resStr, resData);
          } else {
            resData.graphUpdate=graphUpdate.plotData;
            socket.emit(resStr, resData);
          }
        });
      }
    });
  });
};
