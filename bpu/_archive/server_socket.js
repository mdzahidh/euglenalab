var _decoder=require('../shared/en_de_code_T4Leds.js');

var _bpuScript=null;
var _myPrint=null;
var _addr=null;

var _serverHandler=function(req, res) {_myPrint('server_socket', 'web serverHandler NO CODE!');};

var _connectionHandler=function(socket) {
  if(_bpuScript.socket===null) {
    _bpuScript.socket=socket;
    _bpuScript.socket.on('addExp', function(exp) {
      console.log('server_socket', 'addExp ', exp.expId);
      if(exp.isLive) {
        _bpuScript.exp=exp;
        _bpuScript.exp.startTime=new Date().getTime();
        _bpuScript.exp.endRunDate=null;
        _bpuScript.exp.collectionDate=null;
        _bpuScript.exp.runTime=Number(_bpuScript.exp.runTime);
        _bpuScript.exp.timeLeft=Number(_bpuScript.exp.runTime);
      
        _bpuScript.eventsRan=[];
        _bpuScript.eventsToRun=[];

        _bpuScript.exp.expStatus='added';
        _bpuScript.exp.msg='okay';
        _bpuScript.socket.emit('addExpRes', _bpuScript.exp);
        _bpuScript.startLoop();
      } else {
        _decoder.decode(exp.data, function(err, specArr) {
          if(err) {
            _bpuScript.exp.expStatus='failed';
            _bpuScript.exp.msg='decode err';
            _bpuScript.socket.emit('addExpRes', _bpuScript.exp);
          } else {
            _bpuScript.exp=exp;
            _bpuScript.exp.startTime=new Date().getTime();
           
            _bpuScript.eventsRan=[];
            _bpuScript.eventsToRun=[];
            _bpuScript.exp.data=specArr;
            if(_bpuScript.exp.data.length>1) {_bpuScript.exp.data.sort(function(a, b) {return a.time-b.time;});}
            _bpuScript.exp.runTime=_bpuScript.exp.data[_bpuScript.exp.data.length-1].time;
            _bpuScript.exp.timeLeft=_bpuScript.exp.data[_bpuScript.exp.data.length-1].time;
            _bpuScript.exp.data.forEach(function(item) {_bpuScript.eventsToRun.push(item);});
            _bpuScript.eventsToRun.sort(function(a, b) {return a.time-b.time;});
            _bpuScript.exp.data='moved to bpu';
            
            _bpuScript.exp.expStatus='added';
            _bpuScript.exp.msg='okay';
            _bpuScript.socket.emit('addExpRes', _bpuScript.exp);

            _bpuScript.startLoop();
          }
        });
      }
    });
    _bpuScript.socket.on('clearExp', function() {
      _myPrint('server_socket', 'clearExp '+_bpuScript.exp.expStatus+' '+_bpuScript.exp.id);
      if(_bpuScript.exp.username==='dirk_joystick') {
        clearTimeout(_bpuScript.runTimer);
        _bpuScript.exp=null;
      } else {
        if(_bpuScript.exp.expStatus==='data ready') {
          _bpuScript.socket.emit('clearExpRes', _bpuScript.exp);
          _bpuScript.exp=null;
        } else if(_bpuScript.exp.expStatus==='run complete') {
        } else if(_bpuScript.exp.expStatus==='runnning') {
        } else {
        }
      }
    });
    _bpuScript.socket.on('getStatus', function() {
      if(_bpuScript.exp===null) {
          _bpuScript.socket.emit('getStatusRes', {msg:'addExp'});
      } else {
        if(_bpuScript.exp.expStatus==='data ready') {
          _bpuScript.exp.msg='data ready';
          _bpuScript.exp.dataPath=_bpuScript.exp.dataPath;
          _bpuScript.exp.dataFileName=_bpuScript.exp.dataFileName;
          _bpuScript.exp.dataParentFolder=_bpuScript.exp.dataParentFolder;
          _bpuScript.exp.bpuName=_bpuScript.exp.bpuNameFromBpu;
          _bpuScript.exp.collectionDate=new Date().getTime();
          _bpuScript.socket.emit('getStatusRes', _bpuScript.exp);
        } else if(_bpuScript.exp.expStatus==='run complete') {
          _bpuScript.exp.msg='run complete';
          _bpuScript.socket.emit('getStatusRes', _bpuScript.exp);
        } else {
          _bpuScript.exp.msg='running';
          console.log('server_socket', 'getStatus:'+_bpuScript.exp.msg, 'timeleft:', _bpuScript.exp.runTime-(new Date().getTime()-_bpuScript.exp.startTime));
          _bpuScript.socket.emit('getStatusRes', _bpuScript.exp);
        }
      }
    });
    _bpuScript.socket.on('ledsSet', function(data) {
      if(_bpuScript.exp && _bpuScript.exp.expId===data.expId) {
          _bpuScript.setLeds(data.ledsValues, 'socket live');
          _bpuScript.socket.emit('ledsSetRes', {msg:'ok'});
      } else {
        _bpuScript.socket.emit('ledsSetRes', {msg:'not available'});
      }
    });
  }
};


var exports=module.exports={
  startServer:function(bpu, myPrint, options, cb_fn) {
    _bpuScript=bpu;
    _bpuScript.socket=null;
    _bpuScript.exp=null;
    _myPrint=myPrint;
    _addr=options.localAddr.ip+':'+options.localAddr.serverPort;
    
    var server=require('http').createServer(_serverHandler);
    server.listen(options.localAddr.serverPort, options.localAddr.ip);
    
    var io=require('socket.io')(server);
    io.on('connection', function(socket) {
      _myPrint('server_socket', 'connection from '+socket.id);
      socket.on('pushDisconnect', function(data) {
        _myPrint('server_socket', 'pushDisconnect '+socket.id+':'+data+'\n\n');
        socket.disconnect();
        clearTimeout(_bpuScript.runTimer);
        _bpuScript.socket.emit('clearExpRes', _bpuScript.exp);
        _bpuScript.socket=null;
        _bpuScript.exp=null;
        _bpuScript.isRunning=false;
     });
      socket.on('disconnect', function(data) {
        _myPrint('server_socket', 'disconnect '+socket.id+':'+data+'\n\n');
        clearTimeout(_bpuScript.runTimer);
        _bpuScript.socket.emit('clearExpRes', _bpuScript.exp);
        _bpuScript.socket=null;
        _bpuScript.exp=null;
        _bpuScript.isRunning=false;
      });
      _connectionHandler(socket);
    });

    cb_fn(null, _addr);
  },
};
