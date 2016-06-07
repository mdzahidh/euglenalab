var _doPrint=true;
var myPrint=function(msg) {
  if(_doPrint) {console.log('(BpuSchema.bpu_mainConfig):'+msg);}
};
exports.run=function(app, bpus, appConnectedBpus, doPrint, mainCallback) {
  _doPrint=doPrint;
  myPrint('exports.run');
  var outcome={
    syncdMongoConfigs:[],
    unsyncdMongoConfigs:[],
    stillConnected:[],
    killConnected:[],
    doConnectConfigs:[],
    doNothingConfigs:[],
  }; 
  //
  var syncBpuConfigToMongo=function(callback) {
    myPrint('exports.run.syncBpuConfigToMongo');
    var bpuIndex=0;
    var nextConfig=function() {
      if(bpuIndex<bpus.length) {
        var bpuConfig=bpus[bpuIndex];
        bpuIndex++;
        app.db.models.Bpu.findOne({name:bpuConfig.name}, {}, '', function(err, monBpu) {
          if(err) {
            myPrint('exports.run.syncBpuConfigToMongo findOne.err:'+err);
            nextConfig();
          } else {
            if(monBpu===null) monBpu=app.db.models.Bpu();
            Object.keys(bpuConfig).forEach(function(key) {
              if(monBpu[key]!==null) {
                monBpu[key]=bpuConfig[key];
              }
            });
            monBpu.save(function(err, dat) {
              if(err) {
                myPrint('exports.run.syncBpuConfigToMongo save.err:'+err);
                outcome.unsyncdMongoConfigs.push(monBpu);
              } else {
                outcome.syncdMongoConfigs.push(monBpu);
              }
              nextConfig();
            });
          }
        });
      } else {
        myPrint('exports.run.syncBpuConfigToMongo='+
            'configs:'+bpus.length+' '+
            'syncd:'+outcome.syncdMongoConfigs.length+' '+
            'unsyncd:'+outcome.unsyncdMongoConfigs.length);
        callback();
      }
    };
    nextConfig();
  }; 
  //
  var checkAlreadyConnected=function(callback) {
    myPrint('exports.run.checkAlreadyConnected');
    var bpuIndex=0;
    var next=function() {
      if(bpuIndex<outcome.syncdMongoConfigs.length) {
        var bpuConfig=bpus[bpuIndex];
        bpuIndex++;
        var bpuObj={
          config:bpuConfig, 
          id:null, 
          socket:null, 
          currentStatus:null, 
          pastStatuses:[],
          isConnectedAlready:false,
        };
        //Check if already in app.bpusConencted
        for(var i=0;i<app.bpusConnected.length;i++) {
          var bpuConnect=app.bpusConnected[i];
          if(bpuConnect.config.name===bpuObj.config.name) {
            bpuObj.id=bpuConnect.id;
            bpuObj.socket=bpuConnect.socket;
            bpuObj.currentStatus=bpuConnect.currentStatus;
            bpuObj.pastStatuses=bpuConnect.pastStatuses;
            bpuObj.isConnectedAlready=true;
            if(bpuObj.config.isOn) {
              outcome.stillConnected.push(bpuObj);
            } else {
              outcome.killConnected.push(bpuObj);
            }
            break;
          }
        }
        if(!bpuObj.isConnectedAlready) {
          if(bpuObj.config.isOn) {
            outcome.doConnectConfigs.push(bpuObj);
          } else {
            outcome.doNothingConfigs.push(bpuObj);
          }
        }
        next();
      } else {
        myPrint('exports.run.checkAlreadyConnected='+
            'still:'+outcome.stillConnected.length+' '+
            'kill:'+outcome.killConnected.length+' '+
            'nada:'+outcome.doNothingConfigs.length+' '+
            'connect:'+outcome.doConnectConfigs.length);
        callback();
      }
    };
    next();
  }; 
  ////
  syncBpuConfigToMongo(function() {
    checkAlreadyConnected(function() {
      mainCallback(null, outcome);
    });
  });
};
