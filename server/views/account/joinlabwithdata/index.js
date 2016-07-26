'use strict';
var exec=require('child_process').exec;
var async=require('async');
var fs=require('fs');
var temp = require('temp');
var rmdir = require('rimraf');

var trackCGI = 'cgi/downloadTrack/writeXLSX.py';

temp.track();

exports.find = function(req, res, next) {
  var outcome={
    joinQueueDataObj:req.app.db.models.BpuExperiment.getDataObjToJoinQueue(),
  };

  outcome.session=null;
  var getSession=function(callback) {
    var sessUpdate={
      url:req.url,
      sessionID:req.sessionID,
      user:{
        id:req.user.id,
        name:req.user.username,
        groups:req.user.groups,
      },
      isVerified:false,
    };
    req.app.db.models.Session.findOneAndUpdate({sessionID:req.sessionID}, sessUpdate, {new:true}, function(err, doc) {
      if(err) {
        return callback('getSession:'+err);
      } else if(doc===null || doc===undefined) {
        var sessInfo={
          url:req.url,
          sessionID:req.sessionID,
          user:{
            id:req.user.id,
            name:req.user.username,
            groups:req.user.groups,
          },
        };
        req.app.db.models.Session.makeNewSession(sessInfo, function(err, newDoc) {
          if(err) {
            return callback('getSession:'+err);
          } else {
            outcome.session=newDoc;
            return callback(null);
          }
        });
      } else {
        outcome.session=doc;
        return callback(null);
      }
    });
  };

  outcome.user=null;
  var getUser=function(callback) {
    req.app.db.models.User.findById(outcome.session.user.id, 'username  groups').exec(function(err, doc) {
      if(err) {
        return callback('getUser:'+err);
      } else if(doc===null || doc===undefined) {
        return callback('getUser:'+'dne');
      } else {
        outcome.user=doc;
        return callback(null);
      }
    });
  };

  outcome.bpus=null;
  outcome.bpuJadeObjects=[];
  var getBpus=function(callback) {
    var query=req.app.db.models.Bpu.find({
      isOn:true,
      allowedGroups:{$in: outcome.user.groups},
    });
    query.select('isOn bpuStatus index name magnification allowedGroups localAddr publicAddr bpu_processingTime session liveBpuExperiment performanceScores');
    query.exec(function(err, docs) {
      if(err) {
        return callback('getBpus:'+err);
      } else if(docs===null || docs===undefined) {
        return callback('getBpus:'+'dne');
      } else {
        outcome.bpus=docs;

        //Make Jade Object for each bpu
        outcome.bpus.forEach(function(bpu) {
          var bpuJadeObj={};
          bpuJadeObj.name=bpu.name;
          bpuJadeObj.index=bpu.index;

          bpuJadeObj.titleLabelJadeName='BpuTitleLabel'+bpu.index;
          bpuJadeObj.titleLabel=bpu.name+', User:None';

          bpuJadeObj.userLabelJadeName='BpuUserLabel'+bpu.index;
          bpuJadeObj.userLabel='Time Left:0 seconds';

          bpuJadeObj.statusLabelJadeName='BpuStatusLabel'+bpu.index;
          bpuJadeObj.statusLabel='Status:'+'Unknown';

          bpuJadeObj.timeLabelJadeName='BpuTimeLabel'+bpu.index;
          bpuJadeObj.timeLabel='Time:? sec';

          bpuJadeObj.joinLiveJadeName='bpuJoinLiveButton'+bpu.index;   //do not change used in client

          bpuJadeObj.submitTextJadeName='bpuSubmitTextButton'+bpu.index;//do not change used in client

          bpuJadeObj.imageSrc=bpu.getWebSnapShotUrl();

          outcome.bpuJadeObjects.push(bpuJadeObj);
        });
        return callback(null);
      }
    });
  };

  outcome.bpuWithExp=null;
  outcome.liveBpuExperiment=null;
  var checkBpusAgainstLiveSessionExperiment=function(callback) {
    for(var ind=0;ind<outcome.bpus.length;ind++) {
      var bpu=outcome.bpus[ind];
      if(outcome.session.liveBpuExperiment && outcome.session.liveBpuExperiment.id && bpu.liveBpuExperiment && bpu.liveBpuExperiment.id) {
        if(outcome.session.liveBpuExperiment.id===bpu.liveBpuExperiment.id) {
          outcome.bpuWithExp=bpu;
          break;
        }
      }
    }
    if(outcome.bpuWithExp) {
      return callback('send to lab');
    } else {
      return callback(null);
    }
  };

  var getExperimentData=function(callback) {
    req.query.wasDataProcessed = req.query.wasDataProcessed ? req.query.wasDataProcessed : true;
    req.query.isRunOver = req.query.isRunOver ? req.query.isRunOver : true;
    req.query.limit = req.query.limit ? parseInt(req.query.limit, null) : 20;
    req.query.page = req.query.page ? parseInt(req.query.page, null) : 1;
    req.query.sort = req.query.sort ? req.query.sort : '-_id';

    var filters = {}; //filters is the first object givne to the db.model.collection.find(filters, ..);
    filters['user.name']=req.user.username;
    filters['exp_status']='finished';
    req.app.db.models.BpuExperiment.pagedFind({
      filters: filters,
      keys: '',
      limit: req.query.limit,
      page: req.query.page,
      sort: req.query.sort
    }, function(err, results) {
      if (err) {
        return next(err);
      }
      outcome.results=results;
      outcome.results.filters=req.query;
      return callback(null);
    });
  };

  outcome.data=null;
  var buildClientSideData=function(callback) {
    outcome.data={
      results: JSON.stringify(outcome.results),
      user: JSON.stringify(outcome.user),
      bpus: escape(JSON.stringify(outcome.bpus)),
      session: escape(JSON.stringify(outcome.session)),
      joinQueueDataObj: escape(JSON.stringify(outcome.joinQueueDataObj)),
      eugs:outcome.bpuJadeObjects,
    };
    return callback(null);
  };
  //Build Init Series
  var initSeriesFuncs=[];
  initSeriesFuncs.push(getSession);
  initSeriesFuncs.push(getUser);
  initSeriesFuncs.push(getBpus);
  initSeriesFuncs.push(checkBpusAgainstLiveSessionExperiment);
  initSeriesFuncs.push(getExperimentData);
  initSeriesFuncs.push(buildClientSideData);
  //Run Init Series
  async.series(initSeriesFuncs, function(err) {
    if(err) {
      return next(err);
    } else {
      if(req.xhr) {
        res.header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.send(outcome.results);
      }
      else {
        res.render('account/joinlabwithdata/index', {data: outcome.data});
      }
    }
  });
};

var _createXLSXFile = function(userExp,expId,trackIdStr,res,cb){
  temp.mkdir( 'trackdata', function(err,path){
    if (err){
      console.log('Failed to create temporary mkdir');
      return cb('Failed to ceate temporary mkdir');
    }
    else{
      var dest = path + '/' + expId + '_tracks.xlsx';
      var cmdStr='python ' + trackCGI + ' ' + userExp.proc_endPath + ' ' + dest + ' ' + '"' + trackIdStr + '"';
      var child=exec(cmdStr, function (error, stdout, stderr) {
        if (error){
          return cb('cgi script failed ' + cmdStr);
        }else{
          res.download(dest, function (err) {
              if(err) {
                return cb('sendXLSXFile failed ' + err);
              }
              rmdir(path, function(err){});
          });
        }
      });
    }
  });
};

exports.downloadTrack = function(req,res,next) {

  console.log('GET: ' + req);

  var expId = req.params.id;
  var trackId = req.params.trackId;

  req.app.db.models.BpuExperiment.findById(req.params.id, {}, function(err, userExp) {
    if(err) {
      return next('Find Experiment Error: '+err);
    } else if(userExp===null || userExp===undefined) {
      return next('Find Experiment Error: '+'exp dne');
    } else {
      _createXLSXFile(userExp, expId, trackId, res, function(err) {
        if(err) {
          //return next('downloadTrack failed: '+err);
          //return next(null);
          //res.redirect('/account/joinlabwithdata/'+ expId);
        }
      });
    }
  });
};

exports.download = function(req, res, next) {
  var sendTar=function(dir, filename) {
    if(dir && filename) {
      res.download(dir, filename, function (err) {
        if(err) {
          console.log('download err:'+err);
          //return next('Download Experiment res.download Error:'+err);
        }
      });
    } else {
        return next('Download Experiment sendTar Error:'+'path and filename dne');
    }
  };
  req.app.db.models.BpuExperiment.findById(req.params.id, {}, function(err, userExp) {
    if(err) {
      return next('Find Experiment Error:'+err);
    } else if(userExp===null || userExp===undefined) {
      return next('Find Experiment Error:'+'exp dne');
    } else if(false && userExp.user_tarFilePath && userExp.user_tarFilename) {
        sendTar(userExp.user_tarFilePath, userExp.user_tarFilename);
    } else {
      _runRepackaging(userExp, function(err, newTarLoc, newTarFilename) {
        if(err) {
          return next('Download Experiment _runRepackaging Error:'+err);
        } else {
          userExp.user_tarFilePath=newTarLoc;
          userExp.user_tarFilename=newTarFilename;
          userExp.save(function(err, saveDoc) {
            if(err) {
              sendTar(userExp.user_tarFilePath, userExp.user_tarFilename);
            } else {
              sendTar(saveDoc.user_tarFilePath, saveDoc.user_tarFilename);
            }
          });
        }
      });
    }
  });
};
var _runRepackaging=function(userExp, callback) {
  var destPath=__dirname.split('/server/')[0]+'/'+'server/public/media/tars';
  var outcome={
    destPath:destPath,
    srcPath:null,
    filename:null,
  };
  var checkProcessingFolderPath=function(cb_fn) {
    fs.stat(userExp.proc_endPath, function(err, stat) {
      if(err) {
        cb_fn('checkProcessingFolderPath '+err);
      } else {
        outcome.srcPath=userExp.proc_endPath;
        outcome.filename=userExp._id;
        cb_fn(null);
      }
    });
  };
  var tarFolderToServerPublicMedia=function(cb_fn) {
    //untar and move
    var src=outcome.srcPath;
    var dest=outcome.destPath+'/'+outcome.filename+'.tar.gz';
    //var dest=outcome.filename+'.tar.gz';
    var cmdStr='tar -cvzf '+dest+' -C '+src+' .';
    var child=exec(cmdStr, function (error, stdout, stderr) {
      if(error!==null) {return cb_fn('tarFolderToServerPublicMedia exec error ' + stderr);
      } else if(stderr) {
        //it may exist
        fs.stat(dest, function(err, stat) {
          if(err) {
            return cb_fn('tarFolderToServerPublicMedia fs.stat ' + stderr);
          } else {
            return cb_fn(null);
          }
        });
      } else if(stdout) {return cb_fn(null);
      } else {return cb_fn(null);}
    });
  };
  //Init Run Funcs
  var funcs=[
    checkProcessingFolderPath,
    tarFolderToServerPublicMedia,
  ];
  //Start Run Init
  async.series(funcs, function(err) {
    //outcome.tmpCleanupCallback();
    if(err) {
      callback(err);
    } else {
      callback(null, outcome.destPath+'/'+outcome.filename+'.tar.gz', outcome.filename+'.tar.gz');
    }
  });
};

exports.read = function(req, res, next) {
  req.app.db.models.BpuExperiment.findById(req.params.id).populate('roles.admin', 'name.full').populate('roles.account', 'name.full').exec(function(err, userExp) {
    if (err) {
      return next(err);
    }

    if (req.xhr) {
      res.send(userExp);
    }
    else {
      res.render('account/joinlabwithdata/details', { data: { record: escape(JSON.stringify(userExp)) } });
    }
  });
};

exports.create = function(req, res, next){
  var workflow = req.app.utility.workflow(req, res);

  workflow.on('validate', function() {
    if (!req.body.username) {
      workflow.outcome.errors.push('Please enter a username.');
      return workflow.emit('response');
    }

    if (!/^[a-zA-Z0-9\-\_]+$/.test(req.body.username)) {
      workflow.outcome.errors.push('only use letters, numbers, -, _');
      return workflow.emit('response');
    }

    workflow.emit('duplicateUsernameCheck');
  });

  workflow.on('duplicateUsernameCheck', function() {
    req.app.db.models.User.findOne({ username: req.body.username }, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }

      if (user) {
        workflow.outcome.errors.push('That username is already taken.');
        return workflow.emit('response');
      }

      workflow.emit('createUser');
    });
  });

  workflow.on('createUser', function() {
    var fieldsToSet = {
      username: req.body.username,
      search: [
        req.body.username
      ]
    };
    req.app.db.models.User.create(fieldsToSet, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }

      workflow.outcome.record = user;
      return workflow.emit('response');
    });
  });

  workflow.emit('validate');
};

exports.update = function(req, res, next){
  var workflow = req.app.utility.workflow(req, res);
  workflow.on('patchBpuExperiment', function(user) {
    var fieldsToSet = {
      note:req.body.note
    };
    req.app.db.models.BpuExperiment.findByIdAndUpdate(req.body._id, fieldsToSet, function(err, bpuExperiment) {
      if (err) {
        return workflow.emit('exception', err);
      }

      //workflow.outcome.user = populatedUser;
      workflow.emit('response');
    });
  });

  workflow.emit('patchBpuExperiment');
};

exports.delete = function(req, res, next){
  var workflow = req.app.utility.workflow(req, res);

  workflow.on('validate', function() {
    if (!req.user.roles.admin.isMemberOf('root')) {
      workflow.outcome.errors.push('You may not delete users.');
      return workflow.emit('response');
    }

    if (req.user._id === req.params.id) {
      workflow.outcome.errors.push('You may not delete yourself from user.');
      return workflow.emit('response');
    }

    workflow.emit('deleteUser');
  });

  workflow.on('deleteUser', function(err) {
    req.app.db.models.User.findByIdAndRemove(req.params.id, function(err, user) {
      if (err) {
        return workflow.emit('exception', err);
      }

      workflow.emit('response');
    });
  });

  workflow.emit('validate');
};
