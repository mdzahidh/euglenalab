'use strict';
var async=require('async');
var assert=require('assert');
var fs=require('fs');
var exec=require('child_process').exec;
exports = module.exports = function(app, mongoose) {
  var _SchemaName='MyFunctions';
  //Schema Base
  var _mySchema=require('./_'+_SchemaName+'/'+'schemaBase'+'.js')(app, mongoose);
  //Initialize From Database and Config
  //My Functions 
  _mySchema.statics.runActionOnArrayElements=function(action, array, mainCallback) {
    var functionsArray=[];
    array.forEach(function(item) {
      var func=action.bind(item);
      functionsArray.push(func);
    });
    async.parallel(functionsArray, mainCallback);
  };
  _mySchema.statics.runBashCommand=function(cmdStr, mainCallback) {
    var child=exec(cmdStr, function (error, stdout, stderr) {
      if(error!==null) {mainCallback('error: ' + stderr, stdout);
      } else if(stderr) {mainCallback('stderr: ' + stderr, stdout);
      } else if(stdout) {mainCallback(null, stdout);
      } else {mainCallback(null, null);}
    });
  };
  _mySchema.statics.searchBackForFilename=function(filename, startPath, stopPath, mainCallback) {
    var didCallback=false;
    var catchErr=null;
    try {
      //Build Array 
      var ind=startPath.search(stopPath);
      if(ind<=-1) {
        mainCallback('stop path is not contained in start path', null);
      } else {
        //Parse Folders
        var prePath=startPath.substr(0, stopPath.length);
        var checkFolders=startPath.substr(stopPath.length, startPath.length-stopPath.length).split('/');
        if(checkFolders[0]==='') checkFolders.shift();
        var baseFolder=checkFolders.shift();
        //Create Full and Relative Paths to filename      
        var pathObjects=[]; 
        var absoluteBase=prePath+'/'+baseFolder;
        var cnt=checkFolders.length-1; 
        checkFolders.forEach(function(fld) {
          absoluteBase+='/'+fld;
          var relativeBase='';
          for(var ist=0;ist<cnt;ist++) {relativeBase+='../';}
          cnt--;
          pathObjects.push({
            absolutePath:absoluteBase+'/'+filename,
            relativePath:relativeBase+filename,
          });
        });
        //Stat Call Loop
        var fsStatWrapper=function(pathObj, callback) {
          fs.stat(pathObj.absolutePath, function(err, stat) {
            if(err!==null) return callback(false);
            else return callback(true);
          });
        };
        //Sequence
        async.filter(pathObjects, fsStatWrapper, function(results) {
          if(!didCallback) {
            didCallback=true;
            if(results.length===0) {
              mainCallback('could not find file', null);
            } else {
              mainCallback(null, results[0]);
            }
          }
        });
      }
    } catch(err) {
      catchErr=err;
    } finally {
      if(!didCallback && catchErr!==null) {
        didCallback=true;
        mainCallback('catchErr:'+catchErr, null);
      }
    }
  };
  _mySchema.statics.isLeapYear=function(year) {
    return new Date(year, 1, 29).getMonth() == 1;
  };
  _mySchema.statics.getMilliSecToTodayHourMin=function(hour, min) {
    var timeNow=new Date();
    var nextTime=new Date(new Date().setHours(hour, min, 0, 0));
    if(nextTime-new Date()<0) {
      nextTime=new Date(nextTime.setDate(nextTime.getDate()+1));  //next midnight
    }
    return nextTime-timeNow; //diff in ms between now and next midnight
  };
  _mySchema.statics.assertMyObject=function(objToTest, xProps) {
    var catchErr=null; 
    try { 
      for(var ind=0;ind<xProps.length;ind++) {
        var xProp=xProps[ind];
        var prop=objToTest[xProp.key];
        var baseMsg='property('+xProp.key+') with value('+prop+')';
        //Does the key exist in the object 
        assert.notEqual(prop, null, baseMsg+' is null.');
        assert.notEqual(prop, undefined, baseMsg+' is undefined.');  //redundant?, assert seems to think null=undefined
        //Checks Type 
        assert.equal(typeof prop, xProp.type, baseMsg+' is of type('+typeof prop+') and not type('+xProp.type+').');
        //Check type object function
        if(typeof prop==='object' && xProp.objectFunciton!==null && xProp.objectFunciton!==undefined) {
          assert.equal(typeof prop[xProp.objectFunciton], 'function', baseMsg+' does not have function('+xProp.objectFunciton+').');
        }
        //Check Allowed Values 
        if(xProp.allowedValues && xProp.allowedValues.length>0) {
          assert.notEqual(xProp.allowedValues.indexOf(prop), -1, baseMsg+' is not allowed.');
        }
        //Check Limits on Numbers 
        if(typeof prop==='number') {
          //Lower Limit
          if(xProp.lowLim!==null &&  xProp.lowLim!==undefined) {
            assert(prop>=xProp.lowLim, baseMsg+' is below lower limit('+xProp.lowLim+').');
          }
          //Upper Limit
          if(xProp.upLim!==null &&  xProp.upLim!==undefined) {
            assert(prop<=xProp.upLim, baseMsg+' is above lower limit('+xProp.upLim+').');
          }
        }
      }
    } catch(err) {
      catchErr=err;
    } finally {
      if(catchErr!==null) {
        console.log(catchErr.message); 
        return false; 
      } else {
        return true;
      }
    }
  };
  //Schema Finished
  app.db.model(_SchemaName, _mySchema);
};
