var async=require('async');
exports = module.exports = function(app, _mySchema, _SchemaName) {
  var MainConfig_Path=app.serverBase+'/'+'shared/mainConfig.js';
  var funcName='setupMainConfig';
  //Waterfall 
  _mySchema.statics.setMainConfigBpus_Actual=function(mainCallback) {
    var funcName='setMainConfigBpus';
    var funcStartTime=new Date();
    var outcome={
      mainConfig:null,
      availableBpus:[],
      savedBpus:[],
    }; 
    //1. remove and require mainConfig file - no timeout or parallel actions
    var tc_requireMainConfig=function(callback) {
      var opts={
        funcName:'tc_requireMainConfig', 
        timeout:null,
        desc:'requires mainConfig in try catch.  No time out, no parallel actions.'
      };
      var catchErr=null;
      try {
        delete require.cache[require.resolve(MainConfig_Path)];
        outcome.mainConfig=require(MainConfig_Path);
      } catch(err) {
        catchErr=err;
      } finally {
        callback(catchErr);
      }
    };
    //2.
    var updateBpusWithConfig=function(callback) {
      var opts={
        funcName:'updateBpusWithConfig', 
        timeout:500,
        desc:'updates bpus by name with config.'
      };
      //Action to Bind to Items - requires all the json files and puts into outcome
      var actionFunc=function(cb_fn) {
        var actionObj=this;
        var didCallback=false;
        setTimeout(function() {
          if(!didCallback) {
            didCallback=true;
            cb_fn(null);
          }
        }, opts.timeout);
        app.db.models.Bpu.findOneAndUpdate({name:actionObj.bpuName}, actionObj.config, {new:true}, function(err, newDoc) {
          if(!didCallback) {
            didCallback=true;
            if(err) {
            } else {
              if(newDoc!==null) {
                outcome.availableBpus.push(newDoc);
              }
            }
            cb_fn(null);
          }
        });
      };
      //Setup Object for Action Function
      var actionItems=[];
      outcome.mainConfig.bpus.forEach(function(bpuConfig) {
        actionItems.push({name:'save new config to bpu', bpuName:bpuConfig.name, config:bpuConfig});
      });
      //Build Func Array
      var actionFuncs=[];
      actionItems.forEach(function(item) {actionFuncs.push(actionFunc.bind(item));});
      //Start parallel
      var startTime=new Date(); 
      async.parallel(actionFuncs, function(err) {
        if(err) {
          return callback(opts.funcName+':'+err);
        } else {
          return callback(null);
        }
      });
    };
    var syncBpuConfigToMongo=function(callback) {
      var bpuIndex=0;
      var nextConfig=function() {
        if(bpuIndex<outcome.mainConfig.bpus.length) {
          var bpuConfig=outcome.mainConfig.bpus[bpuIndex];
          bpuIndex++;
          app.db.models.Bpu.findOne({name:bpuConfig.name}, {}, '', function(err, monBpu) {
            if(err) {
              nextConfig();
            } else {
              if(monBpu===null) monBpu=app.db.models.Bpu();
              Object.keys(bpuConfig).forEach(function(key) {
                if(monBpu[key]!==null) {
                  monBpu[key]=bpuConfig[key];
                }
              });
              monBpu.save(function(err, newDoc) {
                if(err) {
                } else {
                  outcome.savedBpus.push(monBpu);
                }
                nextConfig();
              });
            }
          });
        } else {
          callback();
        }
      };
      nextConfig();
    }; 
    //Start Waterfall
    async.waterfall([
      tc_requireMainConfig,
      updateBpusWithConfig,
      syncBpuConfigToMongo,
    ], function(err) {
      var funcEndTime=new Date();
      if(err) {
        err=funcName+' end err:'+err;
        mainCallback(err, null);
      } else {
        mainCallback(null, outcome);
      }
    });
  };  //schema function setMainConfigBpus_Actual end
};  //export function end
