var filename='(admin/bpus/admin_bpus-client.js)';
var handle='/admin_bpus';
var doPrintErr=true;
var doPrintInit=true;
var doPrint=true;
var myPrint=function(name, msg, init, err) {
  if(err!==null && err!==undefined && doPrintErr) {
    console.log('ERROR'+'\t'+filename+':'+name, err);
  } else if(init!==null && init!==undefined && doPrintInit) {
    console.log('INIT'+'\t'+filename+':'+name, init);
  } else if(doPrint) {
    console.log(filename+':'+name, msg);
  }
}; 
(function() {
  'use strict';
  app = app || {};
  var me={};
  me.options=null;
  me.mySocket=null;
  me.lastPing=new Date();
  me.connectionInfo=null;
  me.didConnectionTimeout=false;
  app.socketClient=me;
  
  me.setConnection=function(options, mainViewCallback) {
    myPrint('setConnection', null, 'initializing socket', null);
    me.options=options;
    me.didConnectionTimeout=false;
    //SetConnection Timeout 
    var didCallback=false;
    var resTimeout=setTimeout(function() {
      if(!didCallback) {
        didCallback=true;
        myPrint('setConnection', null, 'resTimeout', null);
        me.didConnectionTimeout=true;
        mainViewCallback('timed out', null);
      }
    }, me.options.timeoutInterval);
    //Try Connect 
    me.mySocket=io.connect();
    me.mySocket.on('connect', function() {
      //Send Conenction Info 
      myPrint('setConnection connect', null, 'setting connection', null);
      me.connectionInfo={bpuName:me.options.bpuName, socketID:me.mySocket.id};
      var emitStr=handle+'/#setConnection';
      var resStr=emitStr+'Res';
      var resFunc=function(resData) {
        if(!didCallback) {
          clearTimeout(resTimeout);
          didCallback=true;
          myPrint('setConnection connect', null, 'setting connection complete', null);
          me.mySocket.removeListener(resStr, resFunc);
          //Start Ping
          _startPing();
          //Call back to mainView 
          mainViewCallback(null, resData);
        }
      };
      me.mySocket.on(resStr, resFunc);
      me.mySocket.emit(emitStr, me.connectionInfo);
    });
  };

  var _startPing=function() {
    myPrint('_startPing', null, 'starting', null);
    me.mySocket.on(handle+'/#ping', function() {
      myPrint(handle, 'ping', null, null);
      var time=new Date()-app.mainView.lastPing;
      me.lastPing=new Date();
      me.mySocket.emit(handle+'/#pingRes');
    });
  };
  me.flushBpu=function(options, callback) {
    myPrint('flushBpu', 'emit', null, null);
    console.log(options);
    var emitStr=handle+'/#flush';
    var resStr=emitStr+'Res';
    var resFunc=function(resData) {
      console.log(resData);
      myPrint('flushBpu', 'resFunc', null, null);
      me.mySocket.removeListener(resStr, resFunc);
      callback(null, resData);
    };
    me.mySocket.on(resStr, resFunc);
    me.mySocket.emit(emitStr, options);
  };
  me.refreshGraphData=function(options, callback) {
    myPrint('refreshGraphData', 'emit', null, null);
    var emitStr=handle+'/#refreshGraphData';
    var resStr=emitStr+'Res';
    var resFunc=function(resData) {
      myPrint('refreshGraphData', 'resFunc', null, null);
      me.mySocket.removeListener(resStr, resFunc);
      callback(null, resData);
    };
    me.mySocket.on(resStr, resFunc);
    me.mySocket.emit(emitStr, options);
  };
  me.startUpdateBpus=function(updateBpusCallback) {
    myPrint('startUpdateBpus', 'no msg');
    var processFoundBpu=function(bpu) {
      var updateObj={};
      updateObj.bpuStatus=bpu.bpuInfo.bpuStatus;
      updateObj.username=bpu.bpuExpInfo.username;
      updateObj.runTime=bpu.bpuExpInfo.runTime;
      updateObj.timeLeft=bpu.bpuExpInfo.timeLeft;
      updateObj.processingTimePerExperiment=bpu.bpuInfo.overheadPerExp;
      updateBpusCallback(updateObj);
    };
    me.mySocket.on('/updateBpus', function(bpusUpdateObj) {
      myPrint(handle, 'updateBpus length:'+bpusUpdateObj.bpus.length);
      var isFound=false;
      if(bpusUpdateObj && bpusUpdateObj.bpus && bpusUpdateObj.bpus.forEach) {
        bpusUpdateObj.bpus.forEach(function(bpu) {
          if(!isFound && me.connectionInfo.bpuName===bpu.bpuInfo.name) {
            isFound=true;
            processFoundBpu(bpu);
          }
        });
      }
    });
  };
}());
