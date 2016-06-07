var async=require('async');

exports = module.exports = function(app, _mySchema, _schemaLogger, _SchemaName) {
  _mySchema.methods.getBpuScore=function(options, mainCallback) {
    var funcName='getBpuScore';
    _schemaLogger.info(funcName);
    var thisDocument=this; 
    var outcome={
      scores:{},
      bpuName:options.bpuName,
    };
    var getUsers=function(callback) {
      _schemaLogger.debug('getUsers');
      var options={};
      app.db.models.AutoUserStatsManager.getUsers(options, function(err, users) {
        if(err) {
          err='AutoUserStatsManager.getUsers '+err;
          _schemaLogger.error(err);
          return callback(err);
        } else {
          users.forEach(function(user) {
            _schemaLogger.trace('getUsers name:'+user.username+', type:'+user.autoUserType);
          });
          outcome.users=users;
          return callback(null);
        }
      });
    };
    var getUsersStats=function(callback) {
      _schemaLogger.debug('getUsersStats');
      //Action to Run on array
      var action=function(cb_fn) {
        var user=this;
        var opts=JSON.parse(JSON.stringify(options));
        opts.scriptType=user.autoUserType;
        app.db.models.AutoUserStatsManager.getStats(user, opts, function(err, statsObj) {
          if(err) {
            err='AutoUserStatsManager.getStats '+err;
            _schemaLogger.error(err);
            return cb_fn(err);
          } else {
            _schemaLogger.trace(statsObj.stats.length+' '+statsObj.scriptType+' stats for '+statsObj.bpuName+' out of '+statsObj.expsFound+' all bpus exps.');
            if(statsObj.bpuNameFail>0) _schemaLogger.warn('bpuNameFail='+statsObj.bpuNameFail);
            if(statsObj.valueFail>0) _schemaLogger.warn('valueFail='+statsObj.valueFail);
            if(statsObj.timeFail>0) _schemaLogger.warn('timeFail='+statsObj.timeFail);
            outcome.scores[statsObj.scriptType]=statsObj.inverseTimeWeightedAvg;
            return cb_fn(null);
          }
        });
      };
      //Run Action on elements
      app.db.models.MyFunctions.runActionOnArrayElements(action, outcome.users, function(err, data) {
        if(err) {
          return callback(err);
        } else {
          return callback(null);
        }
      });
    };
    var setBpuScore=function(callback) {
      app.db.models.Bpu.scoreBpu({name:outcome.bpuName}, outcome.scores, function(err, score) {
        if(err) {
          return callback(err);
        } else {
          outcome.bpuScore=score;
          return callback(null);
        }
      });
    };
    var asyncFinally=function(err) {
      if(err) {
        err=funcName+' end err:'+err;
        _schemaLogger.error(err);
        mainCallback(err, null);
      } else {
        _schemaLogger.debug(funcName+' end');
        mainCallback(null, {bpuName:outcome.bpuName, bpuScore:outcome.bpuScore});
      }
    };
    async.waterfall([getUsers, getUsersStats, setBpuScore], asyncFinally);
  };
};
