exports=module.exports=function(app, deps, options, mainCallback) {
  var moduleName='fakeMongo.js';

  //Assert Deps 
  if(app===null) {mainCallback(moduleName+' need app object');
  } else if(deps.fs===null) {mainCallback(moduleName+' need fs module');
  } else {

    //Check Options
    var o_savePath=options.savePath || '/home/pi/bpuData/tempExpData';

    var fakeDb={};
    
    fakeDb.BpuExperiment={};
    fakeDb.BpuExperiment.save=function(exp, callback) {
      if(exp!==null) {
        exp.exp_metaData.saveTime=new Date();
        exp.exp_metaData.lightDataSoapPath=o_savePath+"/"+"lightdata.json";
        exp.exp_metaData.lightDataPath=o_savePath+"/"+"lightdata_meta.json";
        var saveName=exp._id || "noExpId";
        var saveFullPath=o_savePath+"/"+saveName+".json";
        exp.exp_metaData.ExpFullPath=saveFullPath;
        exp.exp_metaData.ExpName=saveName;
        //Save Full Exp Schema 
        deps.fs.writeFile(exp.exp_metaData.ExpFullPath, JSON.stringify(exp, null, 4), function(err) {
          if(err) {
            callback('writeFile ExpFullPath '+err, null);
          } else {
            //Save Exp Light Data with Meta 
            var lightDataWithMeta={
              metaData:exp.exp_metaData,
              eventsToRun:exp.exp_eventsRan,
            };
            deps.fs.writeFile(exp.exp_metaData.lightDataPath, JSON.stringify(lightDataWithMeta, null, 4), function(err) {
              if(err) {
                callback('writeFile lightDataPath '+err, null);
              } else {
                //Save Exp Light Data
                var lightData={
                  eventsToRun:exp.exp_eventsRan,
                };
                deps.fs.writeFile(exp.exp_metaData.lightDataSoapPath, JSON.stringify(lightData, null, 4), function(err) {
                  if(err) {
                    callback('writeFile lightDataSoapPath '+err, null);
                  } else {
                    callback(null, exp);
                  }
                });
              }
            });
          }
        });
      } else {
        callback(moduleName+' fakeDb.BpuExperiment.save err:'+'exp DNE');
      }
    };
    mainCallback(null, fakeDb);
  }
};


