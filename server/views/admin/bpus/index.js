'use strict';
var doPrint=true;
var myPrint=function(msg) {if(doPrint) console.log('(admin/bpus/index.js)'+'\t'+msg);};

exports.find = function(req, res, next) {
  myPrint('find');
  var outcome = {};

  var getStatusOptions = function(callback) {
    req.app.db.models.Status.find({ pivot: 'Account' }, 'name').sort('name').exec(function(err, statuses) {
      if (err) {
        return callback(err, null);
      }

      outcome.statuses = statuses;
      return callback(null, 'done');
    });
  };

  var getResults = function(callback) {
    req.query.search = req.query.search ? req.query.search : '';
    req.query.status = req.query.status ? req.query.status : '';
    req.query.limit = req.query.limit ? parseInt(req.query.limit, null) : 20;
    req.query.page = req.query.page ? parseInt(req.query.page, null) : 1;
    req.query.sort = req.query.sort ? req.query.sort : '_id';

    var filters = {};
    if (req.query.search) {
      filters.search = new RegExp('^.*?'+ req.query.search +'.*$', 'i');
    }

    if (req.query.status) {
      //filters['status.id'] = req.query.status;
    }

    req.app.db.models.Bpu.pagedFind({
      filters: filters,
      keys: 'name index isOn allowedGroups localAddr publicAddr currentStatus magnification avgStatsData',
      limit: req.query.limit,
      page: req.query.page,
      sort: req.query.sort
    }, function(err, results) {
      if (err) {
        return callback(err, null);
      }
      results.data.forEach(function(result) {
        if(result.currentStatus===null || result.currentStatus===undefined) {
          result.currentStatus={
            name: 'unknown',
            setTime: 'unknown',
            isReady: false,
            isOver: false,
            isCanceled: false,
            runTime: 'unknown',
            expId: 'unknown',
            username: 'unknown',
            timeLeft: 0,
            bpuStatus: 'unknown'
          };
        } else {
          if(typeof result.currentStatus.setTime.getTime==='function') {
            result.currentStatus.setTime=Math.round((new Date()-result.currentStatus.setTime)/60000);
          }
          if(typeof result.currentStatus.setTime.timeLeft==='number') {
            result.currentStatus.timeLeft=Math.round(result.currentStatus.timeLeft/1000);
          }
          if(typeof result.currentStatus.setTime.runTime==='number') {
            result.currentStatus.runTime=Math.round(result.currentStatus.runTime/1000);
          }
        }
      });
      outcome.results=results;
      return callback(null, 'done');
    });
  };

  var asyncFinally = function(err, results) {
    if (err) {
      return next(err);
    }

    if (req.xhr) {
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      outcome.results.filters = req.query;
      res.send(outcome.results);
    }
    else {
      outcome.results.filters = req.query;
      res.render('admin/bpus/index', {
        data: {
          results: escape(JSON.stringify(outcome.results)),
          statuses: outcome.statuses
        }
      });
    }
  };

  require('async').parallel([getStatusOptions, getResults], asyncFinally);
};

exports.read = function(req, res, next) {
  myPrint('read');
  var outcome = {};

  var getStatusOptions = function(callback) {
    req.app.db.models.Status.find({ pivot: 'Account' }, 'name').sort('name').exec(function(err, statuses) {
      if (err) {
        return callback(err, null);
      }
      outcome.statuses = statuses;
      return callback(null, 'done');
    });
  };
  var getRecord = function(callback) {
    req.app.db.models.Bpu.findById(req.params.id).exec(function(err, record) {
      if (err) {
        return callback(err, null);
      }
      outcome.mainImageIP=record.getMainImageStream();
      outcome.record = record;
      outcome.record.notes.forEach(function(note) {
        //note.userCreated.timeStr=note.userCreated.time.toLocaleDateString();
        //console.log(note);
      });
      return callback(null, 'done');
    });
  };
  var asyncFinally = function(err, results) {
    if (err) {
      return next(err);
    }

    if (req.xhr) {
      res.send(outcome.record);
    }
    else {
      if(outcome.record.currentStatus===null || outcome.record.currentStatus===undefined) {
        outcome.record.currentStatus={
          name: 'unknown',
          setTime: 'unknown',
          isReady: false,
          isOver: false,
          isCanceled: false,
          runTime: 'unknown',
          expId: 'unknown',
          username: 'unknown',
          timeLeft: 0,
          bpuStatus: 'unknown'
        };
      } else {
        if(typeof outcome.record.currentStatus.setTime.getTime==='function') {
          outcome.record.currentStatus.setTime=Math.round((new Date()-outcome.record.currentStatus.setTime)/60000);
        }
        if(typeof outcome.record.currentStatus.setTime.timeLeft==='number') {
          outcome.record.currentStatus.timeLeft=Math.round(outcome.record.currentStatus.timeLeft/1000);
        }
        if(typeof outcome.record.currentStatus.setTime.runTime==='number') {
          outcome.record.currentStatus.runTime=Math.round(outcome.record.currentStatus.runTime/1000);
        }
      }
      var statusStr='Status:';
      statusStr+=outcome.record.currentStatus.bpuStatus+', ';
      statusStr+='Mins Ago:';
      statusStr+=outcome.record.currentStatus.setTime+', ';
      statusStr+='username:';
      statusStr+=outcome.record.currentStatus.username+', ';
      statusStr+='timeLeft:';
      statusStr+=outcome.record.currentStatus.timeLeft+', ';
      statusStr+='runTime:';
      statusStr+=outcome.record.currentStatus.runTime;
      outcome.record.currentStatus=statusStr;
      var singletNames={};
      var singlets=[];
      outcome.record.plotData.forEach(function(plot) {
        if(singletNames[plot.name]) {
        } else {
          singletNames[plot.name]=plot.name;
          singlets.push(plot);
        }
      });
      res.render('admin/bpus/details', {
        data: {
          record: escape(JSON.stringify(outcome.record)),
          mainImageIP:outcome.mainImageIP,
          statuses: outcome.statuses,
          graphs:singlets,
        }
      });
    }
  };
  require('async').parallel([getStatusOptions, getRecord], asyncFinally);
};

exports.create = function(req, res, next){
  myPrint('create');
  var workflow = req.app.utility.workflow(req, res);

  workflow.on('validate', function() {
    if (!req.body['name.full']) {
      workflow.outcome.errors.push('Please enter a name.');
      return workflow.emit('response');
    }

    workflow.emit('createAccount');
  });

  workflow.on('createAccount', function() {
    var nameParts = req.body['name.full'].trim().split(/\s/);
    var fieldsToSet = {
      name: {
        first: nameParts.shift(),
        middle: (nameParts.length > 1 ? nameParts.shift() : ''),
        last: (nameParts.length === 0 ? '' : nameParts.join(' ')),
      },
      userCreated: {
        id: req.user._id,
        name: req.user.username,
        time: new Date().toISOString()
      }
    };
    fieldsToSet.name.full = fieldsToSet.name.first + (fieldsToSet.name.last ? ' '+ fieldsToSet.name.last : '');
    fieldsToSet.search = [
      fieldsToSet.name.first,
      fieldsToSet.name.middle,
      fieldsToSet.name.last
    ];

    req.app.db.models.Account.create(fieldsToSet, function(err, account) {
      if (err) {
        return workflow.emit('exception', err);
      }

      workflow.outcome.record = account;
      return workflow.emit('response');
    });
  });

  workflow.emit('validate');
};

exports.update = function(req, res, next){
  myPrint('update');

  var workflow = req.app.utility.workflow(req, res);

  workflow.on('validate', function() {
    if (!req.body.first) {
      workflow.outcome.errfor.first = 'required';
    }

    if (!req.body.last) {
      workflow.outcome.errfor.last = 'required';
    }

    if (workflow.hasErrors()) {
      return workflow.emit('response');
    }

    workflow.emit('patchAccount');
  });

  workflow.on('patchAccount', function() {
    var fieldsToSet = {
      name: {
        first: req.body.first,
        middle: req.body.middle,
        last: req.body.last,
        full: req.body.first +' '+ req.body.last
      },
      company: req.body.company,
      phone: req.body.phone,
      zip: req.body.zip,
      search: [
        req.body.first,
        req.body.middle,
        req.body.last,
        req.body.company,
        req.body.phone,
        req.body.zip
      ]
    };

    req.app.db.models.Account.findByIdAndUpdate(req.params.id, fieldsToSet, function(err, account) {
      if (err) {
        return workflow.emit('exception', err);
      }

      workflow.outcome.account = account;
      return workflow.emit('response');
    });
  });

  workflow.emit('validate');
};

exports.newNote = function(req, res, next){
  myPrint('newNote');

  var workflow = req.app.utility.workflow(req, res);

  workflow.on('validate', function() {
    if (!req.body.data) {
      workflow.outcome.errors.push('Data is required.');
      return workflow.emit('response');
    }

    workflow.emit('addNote');
  });

  workflow.on('addNote', function() {
    var noteToAdd = {
      data: req.body.data,
      userCreated: {
        id: req.user._id,
        name: req.user.username,
        time: new Date().toISOString()
      }
    };

    req.app.db.models.Bpu.findByIdAndUpdate(req.params.id, { $push: { notes: noteToAdd } }, function(err, account) {
      if (err) {
        return workflow.emit('exception', err);
      }

      workflow.outcome.account = account;
      return workflow.emit('response');
    });
  });

  workflow.emit('validate');
};

exports.newStatus = function(req, res, next){
  myPrint('newStatus');
  var workflow = req.app.utility.workflow(req, res);

  workflow.on('validate', function() {
    if (!req.body.id) {
      workflow.outcome.errors.push('Please choose a status.');
    }

    if (workflow.hasErrors()) {
      return workflow.emit('response');
    }

    workflow.emit('addStatus');
  });

  workflow.on('addStatus', function() {
    var statusToAdd = {
      id: req.body.id,
      name: req.body.name,
      userCreated: {
        id: req.user._id,
        name: req.user.username,
        time: new Date().toISOString()
      }
    };

    req.app.db.models.Account.findByIdAndUpdate(req.params.id, { status: statusToAdd, $push: { statusLog: statusToAdd } }, function(err, account) {
      if (err) {
        return workflow.emit('exception', err);
      }

      workflow.outcome.account = account;
      return workflow.emit('response');
    });
  });

  workflow.emit('validate');
};
