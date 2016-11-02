'use strict';

var jwt = require('jsonwebtoken');
var _ = require('lodash');

// a) MP -> API : POST /api/auth/register/ (Register user)
// {
//   username: '',
//   email:'',
//   password:''
// }
// Response -> user: {id, username, email, createdAt}
exports.register = function (req, res) {
    var workflow = req.app.utility.workflow(req, res);

    workflow.on('validate', function () {
        if (!req.body.username) {
            workflow.outcome.errfor.username = 'required';
        }
        else if (!/^[a-zA-Z0-9\-\_]+$/.test(req.body.username)) {
            workflow.outcome.errfor.username = 'only use letters, numbers, \'-\', \'_\'';
        }

        if (!req.body.email) {
            workflow.outcome.errfor.email = 'required';
        }
        else if (!/^[a-zA-Z0-9\-\_\.\+]+@[a-zA-Z0-9\-\_\.]+\.[a-zA-Z0-9\-\_]+$/.test(req.body.email)) {
            workflow.outcome.errfor.email = 'invalid email format';
        }

        if (!req.body.password) {
            workflow.outcome.errfor.password = 'required';
        }

        if (workflow.hasErrors()) {
            return workflow.emit('response');
        }

        workflow.emit('duplicateUsernameCheck');
    });

    workflow.on('duplicateUsernameCheck', function () {
        req.app.db.models.User.findOne({username: req.body.username}, function (err, user) {
            if (err) {
                return workflow.emit('exception', err);
            }

            if (user) {
                workflow.outcome.errfor.username = 'username already taken';
                return workflow.emit('response');
            }

            workflow.emit('duplicateEmailCheck');
        });
    });

    workflow.on('duplicateEmailCheck', function () {
        req.app.db.models.User.findOne({email: req.body.email.toLowerCase()}, function (err, user) {
            if (err) {
                return workflow.emit('exception', err);
            }

            if (user) {
                workflow.outcome.errfor.email = 'email already registered';
                return workflow.emit('response');
            }

            workflow.emit('createUser');
        });
    });

    workflow.on('createUser', function () {
        req.app.db.models.User.encryptPassword(req.body.password, function (err, hash) {
            if (err) {
                return workflow.emit('exception', err);
            }

            //add user to default group
            req.app.db.models.Group.findOne({name: 'default'}, function (err, dGroup) {
                if (dGroup === null) {
                    dGroup = req.app.db.models.Group();
                    dGroup.save();
                }

                //finish original
                var fieldsToSet = {
                    isActive: 'yes',
                    username: req.body.username,
                    email: req.body.email.toLowerCase(),
                    password: hash,
                    groups: [dGroup.name],
                    search: [
                        req.body.username,
                        req.body.email
                    ]
                };
                req.app.db.models.User.create(fieldsToSet, function (err, user) {
                    if (err) {
                        return workflow.emit('exception', err);
                    }
                    dGroup.users.push(user.username);
                    req.app.db.models.Group.findOneAndUpdate({name: dGroup.name}, {users: dGroup.users}, function (err, dGroup) {
                        if (err) {
                            return workflow.emit('exception', err);
                        }
                        workflow.user = user;
                        workflow.emit('createAccount');
                    });
                });
            });
        });
    });

    workflow.on('createAccount', function () {
        var fieldsToSet = {
            isVerified: 'yes',
            'name.full': workflow.user.username,
            user: {
                id: workflow.user._id,
                name: workflow.user.username
            },
            search: [
                workflow.user.username
            ]
        };

        req.app.db.models.Account.create(fieldsToSet, function (err, account) {
            if (err) {
                return workflow.emit('exception', err);
            }

            //update user with account
            workflow.user.roles.account = account._id;
            workflow.user.save(function (err, user) {
                if (err) {
                    return workflow.emit('exception', err);
                }

                workflow.outcome.user = {
                    id: workflow.user._id,
                    username: workflow.user.username,
                    email: workflow.user.email,
                    createdAt: workflow.user.timeCreated
                };

                workflow.emit('response');
            });
        });
    });

    workflow.emit('validate');
};

// b) MP -> API : POST /api/auth/login/ (Authenticate user)
// {
//   username: '',
//   password:''
// }
// 	Response: token - use this token in header of each request
// {
//   user: {}
//   token: "JWT 35252632632236"
// }
exports.login = function (req, res) {
    var workflow = req.app.utility.workflow(req, res);

    workflow.on('validate', function () {
        if (!req.body.username) {
            workflow.outcome.errfor.username = 'required';
        }

        if (!req.body.password) {
            workflow.outcome.errfor.password = 'required';
        }

        if (workflow.hasErrors()) {
            return workflow.emit('response');
        }

        workflow.emit('attemptLogin');
    });

    workflow.on('getSession', function(){

        var sessUpdate={
            url:'/account',
            sessionID:req.sessionID,
            user:{
                id:workflow.outcome.user.id,
                name:workflow.outcome.user.username,
                groups:["default"]
            },
            isVerified:false
        };

        req.app.db.models.Session.findOneAndUpdate({sessionID:req.sessionID}, sessUpdate, {new:true}, function(err, doc) {
            if(err) {
                workflow.outcome.errfor.session = err;
            } else if(doc===null || doc===undefined) {
                workflow.emit('newSession');
            } else {
                workflow.outcome.session=doc;
                workflow.emit('response');
            }

            if(workflow.hasErrors()){
                return workflow.emit('response');
            }
        });
    });

    workflow.on('newSession', function(){
        var sessInfo={
            url:'/account',
            sessionID:req.sessionID,
            user:{
                id:workflow.outcome.user.id,
                name:workflow.outcome.user.username,
                groups:["default"]
            }
        };

        req.app.db.models.Session.makeNewSession(sessInfo, function(err, newDoc) {
            if(err) {
                workflow.outcome.errfor.session = err;
            } else {
                workflow.outcome.session=newDoc;
                workflow.emit('response');
            }

            if(workflow.hasErrors()){
                return workflow.emit('response');
            }
        });
    });

    workflow.on('attemptLogin', function () {
        req._passport.instance.authenticate('local', function (err, user, info) {
            if (err) {
                return workflow.emit('exception', err);
            }

            req.login(user, function (err) {
                if (err) {
                    return workflow.emit('exception', err);
                }

                var secretOrKey = req.app.jwtOptions.secretOrKey;
                var token = jwt.sign(user, secretOrKey, {
                    expiresIn: 24 * 60 * 60 // 1 day
                });

                workflow.outcome.user = {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    createdAt: user.timeCreated
                };

                workflow.outcome.token = "JWT " + token;
                workflow.outcome.sessionID = req.sessionID;
                workflow.outcome.queue = req.app.db.models.BpuExperiment.getDataObjToJoinQueue();

                if(workflow.hasErrors()){
                    return workflow.emit('response');
                }

                workflow.emit('getSession');
            });

        })(req, res);
    });

    workflow.emit('validate');
};

// c) MP -> API : GET /api/bio-units/ (List of bio processing units)
// 	Response: list of units
exports.get_bio_units = function (req, res) {
    var workflow = req.app.utility.workflow(req, res);

    workflow.on('find', function () {
        req.query.search = req.query.search ? req.query.search : '';
        req.query.status = req.query.status ? req.query.status : '';
        req.query.limit = req.query.limit ? parseInt(req.query.limit, null) : 20;
        req.query.page = req.query.page ? parseInt(req.query.page, null) : 1;
        req.query.sort = req.query.sort ? req.query.sort : '_id';

        var filters = {};
        if (req.query.search) {
            filters.search = new RegExp('^.*?' + req.query.search + '.*$', 'i');
        }

        if (req.query.status) {
            filters['status.id'] = req.query.status;
        }

        req.app.db.models.Bpu.pagedFind({
            filters: filters,
            keys: 'name index isOn currentStatus magnification',
            limit: req.query.limit,
            page: req.query.page,
            sort: req.query.sort
        }, function (err, results) {
            if (err) {
                return workflow.emit('exception', err);
            }

            var data = _.map(results.data, function (result) {
                var newResult = {};

                if (result.currentStatus === null || result.currentStatus === undefined) {

                    newResult.id = result._id;
                    newResult.name = 'unknown';
                    newResult.index = result.index;
                    newResult.magnification = result.magnification;
                    newResult.isOn = result.isOn;
                    newResult.processingTimePerExperiment = 'unknown';
                    newResult.bpuStatus = 'unknown';
                    newResult.expId = 'unknown';
                    newResult.username = 'unknown';
                    newResult.allowedGroups = 'unknown';
                    newResult.isReady = false;
                    newResult.isOver = false;
                    newResult.isCanceled = false;
                    newResult.err = null;
                    newResult.setTime = 'unknown';
                    newResult.runTime = 'unknown';
                    newResult.timeLeft = 0;

                    return newResult;
                } else {
                    newResult.id = result._id;
                    newResult.name = result.name;
                    newResult.index = result.index;
                    newResult.magnification = result.magnification;
                    newResult.isOn = result.isOn;
                    newResult.processingTimePerExperiment = result.currentStatus.processingTimePerExperiment;
                    newResult.bpuStatus = result.currentStatus.bpuStatus;
                    newResult.expId = result.currentStatus.expId;
                    newResult.username = result.currentStatus.username;
                    newResult.allowedGroups = result.currentStatus.allowedGroups;
                    newResult.isReady = result.currentStatus.isReady;
                    newResult.isOver = result.currentStatus.isOver;
                    newResult.isCanceled = result.currentStatus.isCanceled;
                    newResult.err = result.currentStatus.err;

                    if (typeof result.currentStatus.setTime.getTime === 'function') {
                        newResult.setTime = Math.round((new Date() - result.currentStatus.setTime) / 60000);
                    }
                    if (typeof result.currentStatus.setTime.timeLeft === 'number') {
                        newResult.timeLeft = Math.round(result.currentStatus.timeLeft / 1000);
                    }
                    if (typeof result.currentStatus.setTime.runTime === 'number') {
                        newResult.runTime = Math.round(result.currentStatus.runTime / 1000);
                    }

                    return newResult;
                }
            });

            workflow.outcome.results = data;
            workflow.outcome.pages = results.pages;
            workflow.outcome.items = results.items;
            workflow.emit('response');
        });
    });

    workflow.emit('find');
};

// d) MP -> API : POST /api/experiment/ (Choose BPU to experiment with)
// 	Response: experimentID, queueID and waitTime


// e) MP -> API : GET /api/experiment/{id}/status/ (Get status of experiment)
// 	Response: status and waitTime
exports.get_experiment_status = function (req, res) {
    /*

     */
};

// f) MP -> API : GET /api/experiment/{id}/filter={type of data} (Get data from experiment)
// 	Response: zip file with all filtered data
exports.get_experiment_detail = function (req, res) {
    // /account/joinlabwithdata/download/58014fd349a92e241293f04c/
};

exports.find = function(req, res) {
    var outcome={
        joinQueueDataObj:req.app.db.models.BpuExperiment.getDataObjToJoinQueue()
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
            if(req.xhr) {
                res.header("Cache-Control", "no-cache, no-store, must-revalidate");
                results.filters = req.query;
                res.send(results);
            }
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
            console.log(outcome.data);
            res.render('account/joinlabwithdata/index', {data:outcome.data});
        }
    });
};
