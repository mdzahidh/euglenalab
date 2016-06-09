var fs=require('fs');
var http=require('http');
var async=require('async');
var clientIO=require('socket.io-client');
var mongoose=require('mongoose');

var _connectToSocketWithAddr=function(socket, addr, callback) {
  var connectSocket=function(cb_fn) {
    var didTimeout=false;
    var didOkay=false;
    var interval=500;
    setTimeout(function() {
      if(!didOkay) {
        didTimeout=true;
        cb_fn('connectSocket timed out', null);
      }
    }, interval);
    var newSocket=clientIO(addr, {multiplex:false});
    newSocket.on('connect', function () {
      if(!didTimeout) {
        didOkay=true;
        cb_fn(null, newSocket);
      }
    });
  };
  var pingSocket=function(cb_fn) {
    var didTimeout=false;
    var didOkay=false;
    var interval=500;
    setTimeout(function() {
      if(!didOkay) {
        didTimeout=true;
        cb_fn('pingSocket timed out');
      }
    }, interval);
    var emitStr='ping';
    var resStr=emitStr+'Res';
    var resFunc=function() {
      socket.removeListener(resStr, resFunc);
      if(!didTimeout) {
        didOkay=true;
        cb_fn(null);
      }
    };
    socket.removeListener(resStr, resFunc);
    socket.on(resStr, resFunc);
    socket.emit(emitStr, {});
  };
  if(socket===null || socket===undefined) {
    connectSocket(function(err, newSocket) {
      callback(err, newSocket, false);
    });
  } else {
    pingSocket(function(err) {
      if(err) {
        connectSocket(function(err, newSocket) {
          callback(err, newSocket, false);
        });
      } else {
        callback(null, socket, true);
      }
    });
  }
};
var servers={
  serverNames:['test', 'dev', 'master'],
  setMainConfig:function(serverName, callback) {
    if(servers[serverName]===null || servers[serverName]===undefined) {
      servers[serverName]={
        name:serverName, 
        mainConfig:null, isMainConfigSet:true,
        db:null, isDbConnected:false, 
        socket:null, isSocketConnected:false, didSocketPing:false,
        config:{
          isDevelopment:true, mongoUri:'', port:'', addr:'',
          loginAttempts:{forIp:50, forIpAndUser:7, logExpiration:'20m'},
        },
        get:function() {return 'development';}
      };
    }
    servers[serverName].path='/home/mserver/'+servers[serverName].name+'_euglenalab';
    var configPath=servers[serverName].path+'/shared/mainConfig.js';
    delete require.cache[require.resolve(configPath)];
    servers[serverName].mainConfig=require(configPath);
    servers[serverName].config.port=servers[serverName].mainConfig.adminFlags.getWebServerPort();
    servers[serverName].config.addr=servers[serverName].mainConfig.adminFlags.getWebServerAddr();
    servers[serverName].config.mongoUri=servers[serverName].mainConfig.adminFlags.getMongoUri();
    servers[serverName].mainConfig.bpus.forEach(function(bpu) {
      bpu.isConnected='?????';
    });
    callback(null);
  },
  setServerDatabase:function(serverName, callback) {
    if(servers[serverName].db===null) {
      servers[serverName].db=mongoose.createConnection(servers[serverName].config.mongoUri);
      servers[serverName].db.on('error', function(err) {
        callback(err);
      });
      servers[serverName].db.once('open', function () {
        require(servers[serverName].path+'/shared/mongoDb/schema/models')(servers[serverName], mongoose);
        servers[serverName].isDbConnected=true;
        callback(null);
      });
    } else {
      callback(null);
    }
  },
  connectToServer:function(serverName, callback) {
    var sock=servers[serverName].socket;
    var addr=servers[serverName].config.addr;
    servers[serverName].didSocketPing=false;
    _connectToSocketWithAddr(sock, addr, function(err, socket, didPing) {
      if(err) {
        servers[serverName].isSocketConnected=false;
        servers[serverName].socket=null;
        callback(err);
      } else {
        servers[serverName].didSocketPing=didPing;
        servers[serverName].isSocketConnected=true;
        servers[serverName].socket=socket;
        callback(null);
      }
    });
  },
  connectToBpus:function(serverName, callback) {
    var tempBpus=[];
    servers[serverName].mainConfig.bpus.forEach(function(bpu) {
      bpu.isConnected='false';
      if(bpu.isOn) {
        tempBpus.push(bpu);
      }
    });
    var nextBpu=function() {
      if(tempBpus.length>0) {
        var bpu=tempBpus.shift();
        var sock=bpu.socket;
        var addr='http://'+bpu.localAddr.ip+':'+bpu.localAddr.serverPort;
        _connectToSocketWithAddr(sock, addr, function(err, socket, didPing) {
          if(err) {
            console.log('connectToBpus nextBpu ', addr, err);
            nextBpu(null);
          } else {
            bpu.isConnected=' true';
            bpu.didPing=didPing;
            bpu.socket=socket;
            nextBpu(null);
          }
        });
      } else {
        callback(null);
      }
    };
    nextBpu();
  },
  printInfo:function(serverName, callback) {
    if(servers[serverName]!==null) {
      servers[serverName].mainConfig.bpus.forEach(function(bpu) {
        if(bpu.isOn) {
          var nameStr=servers[serverName].name;
          var heading='Server';
          while(nameStr.length< heading.length) {
            nameStr=' '+nameStr;
          }
          console.log(
            nameStr+'('+servers[serverName].isSocketConnected+','+servers[serverName].didSocketPing+')'+'\t\t'+
            bpu.name+'('+bpu.isOn+','+bpu.isConnected+')'+'\t'+
            bpu.allowedGroups);
        }
      });
    }
    callback(null);
  },
  init:function(doPrint, mainCallback) {
    var tempServerNames=JSON.parse(JSON.stringify(servers.serverNames));
    var nextServer=function() {
      if(tempServerNames.length>0) {
        var serverName=tempServerNames.shift();
        async.waterfall([
            async.apply(servers.setMainConfig, serverName), 
            async.apply(servers.setServerDatabase, serverName), 
            async.apply(servers.connectToServer, serverName), 
            async.apply(servers.connectToBpus, serverName), 
            async.apply(servers.printInfo, serverName), 
        ], nextServer);
      } else {
        mainCallback(null);
      }
    };
    nextServer();
  },
};

//Loop
var clearConsole=function() {
  if(!true) {
    console.log('**********************');
  } else {
    console.log('\033c');
  }
};
var loopInterval=5000;
var lastLoopTime=new Date(new Date().getTime()-loopInterval);
var loopCnt=0;
var doPrint=true;
var reloop=function() {
  var dt=loopInterval-(new Date()-lastLoopTime);
  setTimeout(function() {
    lastLoopTime=new Date();
    clearConsole();
    console.log(lastLoopTime.toLocaleString());
    var header='Server'+'('+'IsConn'+','+'DidPing'+')'+'\t\t'+
      'Bpu'+'('+'IsOn'+','+'IsConn'+')'+'\t'+ 
      'Groups'; 
    console.log(header);
    console.log();
    servers.init(doPrint, function(err) {
      loopCnt++;
      reloop();
    });
  }, dt);
};
reloop();
