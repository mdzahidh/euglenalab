var Client = require('node-rest-client').Client;
var http = require('http');
var io = require('socket.io-client');

var client = new Client();

var domain = "http://localhost:5000";
// var domain = "http://euglena.stanford.edu";

var sessionID = null;

var handle = '/account/joinlabwithdata';  //socketHandle for socket connections for the page

var routes = {
    connection: '/#setConnection',
    error: '/#serverError',
    update: '/#update',
    submitExperiment: '/#submitExperimentRequest'
};

var user = null;
var token = null;

function register() {
    var args = {
        data: {
            username: 'test2',
            email: 'test2@noname.org',
            password: 'r3w53235623'
        },
        headers: {"Content-Type": "application/json"}
    };

    client.post(domain + "/api/auth/register/ ", args, function (data, response) {
        // parsed response body as js object
        console.log(data);
    });
}

// register();
// { success: true,
//   errors: [],
//   errfor: {},
//   user:
//    { id: '581129364999d6fa1a7042f9',
//      username: 'test2',
//      email: 'test2@noname.org',
//      timeCreated: '2016-10-26T22:07:50.947Z'} }


function getBioUnits() {
    var args = {
        data: {},
        headers: {"Content-Type": "application/json", "Authorization": token}
    };

    client.get(domain + "/api/bio-units/ ", args, function (data, response) {
        // parsed response body as js object
        // console.log(data);
    });
}

function submitExperiment(socket, inputFiles, joinQueueDataObj, session) {
    console.log('submitting experiment...');

    var experiment = {
        isSubmitting: false,
        MaxTextFileLoad: 10,
        MaxTextTime: 10 * 60 * 1000,
        loadedTextRunTime: 0,
        loadedTextFiles: [],
        queueTextRunTime: 0,
        queueTextFiles: 0
    };

    var joinQueueDataObjects = [];
    var doSend = false;

    inputFiles.forEach(function (fileObj) {
        var joinQueueData = JSON.parse(JSON.stringify(joinQueueDataObj));

        joinQueueData.group_experimentType = 'text';
        joinQueueData.exp_eventsToRun = fileObj.eventsToRun;
        joinQueueData.exp_metaData = fileObj.metadata;
        joinQueueDataObjects.push(joinQueueData);
    });

    if (joinQueueDataObjects.length > 0) {
        doSend = true;
    }

    if (doSend) {
        var user = session.user;

        //Add common data to all
        joinQueueDataObjects.forEach(function (obj) {
            obj.user.id = user.id;
            obj.user.name = user.name;
            obj.user.groups = session.groups;

            obj.session.id = session.id;
            obj.session.sessionID = session.sessionID;
            obj.session.socketHandle = session.socketHandle;
            obj.session.socketID = session.socketID;

            obj.exp_metaData.group_experimentType = obj.group_experimentType;
            obj.exp_wantsBpuName = null; // don't choose any specific bpu

            obj.exp_metaData.clientCreationDate = new Date();
            obj.exp_metaData.userUrl = session.url;
        });

        console.log(joinQueueDataObjects);

        // request to webserver
        socket.emit(routes.submitExperiment, joinQueueDataObjects, function (err, validationObjs) {
            if(err) {
                console.log('Err:'+err);

                if(validationObjs && validationObjs.forEach) {
                    validationObjs.forEach(function(validationObj, index) {
                        validationObj.errs.forEach(function(err, index1) {
                            console.log(''+index+', '+index1+'. submitExperiment Err:', err);
                        });
                    });
                }

            } else {
                if(validationObjs && validationObjs.forEach) {
                    validationObjs.forEach(function(validationObj, index) {
                        console.log(validationObj);
                        console.log(''+index+'. submitExperiment', validationObj.expInfo.exp_eventsRunTime, validationObj.expInfo.isValid);
                    });

                } else {
                    console.log('submitExperiment', 'Response:'+'NA');

                }
            }
        });
    }
}

function socketSetup(sessionID, user, queue) {
    // setup socket connection
    var socket = io.connect(domain, {reconnect: true});

    socket.on('connect', function () {
        console.log('connected');
    });

    // Add a connect listener
    socket.on(routes.connection, function (callback) {
        console.log('socket authenticated to server');

        var session = {
            socketHandle: handle,
            socketID: socket.id,
            sessionID: sessionID,
            url: '/account',
            user: {
                name: user.username,
                id: user.id
            },
            groups: ["default"]
        };

        session['socketHandle'] = handle;
        session['socketID'] = socket.id;

        callback(session);

        // fetch input files
        // todo: read from a csv file instead
        var inputFiles = [{
            eventsToRun:[
                {topValue: 0, rightValue: 0, bottomValue: 0, leftValue: 0, time: 0},
                {topValue: 100, rightValue: 0, bottomValue: 0, leftValue: 0, time: 30000},
                {topValue: 0, rightValue: 50, bottomValue: 60, leftValue: 0, time: 50000},
                {topValue: 0, rightValue: 0, bottomValue: 0, leftValue: 0, time: 60000}
            ],
            metadata:{
                clientCreationDate: new Date(),
                group_experimentType: "text",
                runTime: 60000,
                tag: "alan",  // user name or any tag
                userUrl: "/account/joinlabwithdata/"
            }

        }];

        submitExperiment(socket, inputFiles, queue, session);
    });

    socket.on(routes.error, function (error) {
        console.log('Socket Error!');
        console.log(error);
    });

    socket.on(routes.update, function (updateObj) {
        var clientUpdateObj = {};

        //Queue info for UI update
        clientUpdateObj.queueExps = [];
        clientUpdateObj.liveQueueExp = null;
        clientUpdateObj.textTotalRunTime = 0;
        clientUpdateObj.textTotalExps = 0;

        //Bpu Info for UI update
        clientUpdateObj.bpuLiveExp = null;
        clientUpdateObj.bpuLiveFinishTime = 0;
        clientUpdateObj.bpuTextTotalRunTime = 0;
        clientUpdateObj.bpuTextTotalExps = 0;

        //Go through active bpu exps
        updateObj.bpuExps.forEach(function (bpuExp) {
            if (bpuExp.liveBpuExperiment.group_experimentType === 'live') {
                clientUpdateObj.bpuLiveExp = bpuExp;
                clientUpdateObj.bpuLiveFinishTime = bpuExp.liveBpuExperiment.bc_timeLeft;
            } else {
                clientUpdateObj.bpuTextTotalRunTime += bpuExp.liveBpuExperiment.bc_timeLeft;
                clientUpdateObj.bpuTextTotalExps++;
            }
        });

        //Go through queue bpu exps
        updateObj.queueExpTags.forEach(function (expTag) {
            if (expTag.session.sessionID !== null && expTag.session.sessionID !== undefined) {
                if (expTag.group_experimentType === 'live') {
                    clientUpdateObj.liveQueueExp = expTag;
                } else {
                    clientUpdateObj.textTotalRunTime += expTag.exp_eventsRunTime + expTag.exp_lastResort.totalWaitTime;
                    clientUpdateObj.textTotalExps++;
                }
            }
        });

        //Go through bpu groups
        clientUpdateObj.bpusPackage = [];
        updateObj.groupBpus.forEach(function (bpu) {
            clientUpdateObj.bpusPackage.push(bpu);
        });

        // callback(clientUpdateObj);

    });


}


function login() {
    var args = {
        data: {
            username: 'test2',
            password: 'r3w53235623'
        },
        headers: {"Content-Type": "application/json"}
    };

    client.post(domain + "/api/auth/login/ ", args, function (data, response) {

        // parsed response body as js object
        var sess = response.headers['set-cookie'][0];
        sess = sess.replace("; Path=/; HttpOnly", "");
        var cookieParts = sess.split('connect.sid');
        if (cookieParts.length > 0) {
            cookieParts = cookieParts[cookieParts.length - 1].split('s%3A');
            if (cookieParts.length > 0) {
                var temp = cookieParts[cookieParts.length - 1].split('.')[0];
                if (temp.length === 32) {
                    sessionID = temp;
                }
            }
        }

        user = data.user;
        token = data.token;
        queue = data.queue;


        socketSetup(sessionID, user, queue);


        // getBioUnits();
        //  {
        //   success: true,
        //   errors: [],
        //   errfor: {},
        //   results:
        //   [
        //    	{
        //    	   id: '563ac5e53211e05409c71d5a',
        //        name: 'unknown',
        //        index: 0,
        //        magnification: 10,
        //        isOn: false,
        //        processingTimePerExperiment: 'unknown',
        //        bpuStatus: 'unknown',
        //        expId: 'unknown',
        //        username: 'unknown',
        //        allowedGroups: 'unknown',
        //        isReady: false,
        //        isOver: false,
        //        isCanceled: false,
        //        err: null,
        //        setTime: 'unknown',
        //        runTime: 'unknown',
        //        timeLeft: 0
        //     }
        //   ],
        //   pages:
        //   { current: 1,
        //      prev: 0,
        //      hasPrev: false,
        //      next: 0,
        //      hasNext: false,
        //      total: 1 },
        //   items: { begin: 1, end: 11, total: 11 }
        // }


    });
}

login();
// { success: true,
//  errors: [],
//  errfor: {},
//  user:
//   { id: '581129364999d6fa1a7042f9',
//     username: 'test2',
//     email: 'test2@noname.org',
//     createdAt: '2016-10-26T22:07:50.947Z' },
//  token: 'JWT eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyIkX18iOnsic3RyaWN0TW9kZSI6dHJ1ZSwiZ2V0dGVycyI6e30sIndhc1BvcHVsYXRlZCI6ZmFsc2UsImFjdGl2ZVBhdGhzIjp7InBhdGhzIjp7Imdyb3VwcyI6ImluaXQiLCJsYXN0RXhwZXJpbWVudFJ1bkRhdGUiOiJpbml0IiwidGltZUNyZWF0ZWQiOiJpbml0Iiwic2VhcmNoIjoiaW5pdCIsInJvbGVzLmFjY291bnQiOiJpbml0IiwiX192IjoiaW5pdCIsInBhc3N3b3JkIjoiaW5pdCIsImVtYWlsIjoiaW5pdCIsInVzZXJuYW1lIjoiaW5pdCIsImlzQWN0aXZlIjoiaW5pdCIsIl9pZCI6ImluaXQifSwic3RhdGVzIjp7Imlnbm9yZSI6e30sImRlZmF1bHQiOnt9LCJpbml0Ijp7InJvbGVzLmFjY291bnQiOnRydWUsIl9fdiI6dHJ1ZSwiZ3JvdXBzIjp0cnVlLCJsYXN0RXhwZXJpbWVudFJ1bkRhdGUiOnRydWUsInRpbWVDcmVhdGVkIjp0cnVlLCJzZWFyY2giOnRydWUsInBhc3N3b3JkIjp0cnVlLCJlbWFpbCI6dHJ1ZSwidXNlcm5hbWUiOnRydWUsImlzQWN0aXZlIjp0cnVlLCJfaWQiOnRydWV9LCJtb2RpZnkiOnt9LCJyZXF1aXJlIjp7fX0sInN0YXRlTmFtZXMiOlsicmVxdWlyZSIsIm1vZGlmeSIsImluaXQiLCJkZWZhdWx0IiwiaWdub3JlIl19LCJlbWl0dGVyIjp7ImRvbWFpbiI6bnVsbCwiX2V2ZW50cyI6e30sIl9ldmVudHNDb3VudCI6MCwiX21heExpc3RlbmVycyI6MH19LCJpc05ldyI6ZmFsc2UsIl9kb2MiOnsiZ3JvdXBzIjpbImRlZmF1bHQiXSwibGFzdEV4cGVyaW1lbnRSdW5EYXRlIjoiMTk3MC0wMS0wMVQwMDowMDowMC4wMDBaIiwicm9sZXMiOnsiYWNjb3VudCI6IjU4MTEyOTM2NDk5OWQ2ZmExYTcwNDJmYSJ9LCJ0aW1lQ3JlYXRlZCI6IjIwMTYtMTAtMjZUMjI6MDc6NTAuOTQ3WiIsInNlYXJjaCI6WyJ0ZXN0MiIsInRlc3QyQG5vbmFtZS5vcmciXSwiX192IjowLCJwYXNzd29yZCI6IiQyYSQxMCRZVVVTZEREUC9oRWJTSm1BTEFjQVZPblZiSWdiM3F3WDNYTTJzT3dGQk5aZFFKaXJRbm44bSIsImVtYWlsIjoidGVzdDJAbm9uYW1lLm9yZyIsInVzZXJuYW1lIjoidGVzdDIiLCJpc0FjdGl2ZSI6InllcyIsIl9pZCI6IjU4MTEyOTM2NDk5OWQ2ZmExYTcwNDJmOSJ9LCJfcHJlcyI6eyIkX19vcmlnaW5hbF9zYXZlIjpbbnVsbCxudWxsXSwiJF9fb3JpZ2luYWxfdmFsaWRhdGUiOltudWxsXSwiJF9fb3JpZ2luYWxfcmVtb3ZlIjpbbnVsbF19LCJfcG9zdHMiOnsiJF9fb3JpZ2luYWxfc2F2ZSI6W10sIiRfX29yaWdpbmFsX3ZhbGlkYXRlIjpbXSwiJF9fb3JpZ2luYWxfcmVtb3ZlIjpbXX0sImlhdCI6MTQ3NzUyMDI4NSwiZXhwIjoxNDc3NjA2Njg1fQ.uDR3jvGG0aNcqZ_JqxbCWFbLbPU47c-DtpbO_8voelA' }




