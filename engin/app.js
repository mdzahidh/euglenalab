var io = require('socket.io-client');

var app = app || {};

var router = {
    connect: 'connect',
    disconnect: 'disconnect',
    authorize: 'setConnection',
    getQueue:'getJoinQueueDataObj',
    submitExperiment: '/bpuCont/#submitExperimentRequest'
};

var serverInfo = {
    Identifier: 'C422691AA38F9A86EC02CB7B55D5F542',
    name: 'radiantllama',
    // socketClientServerIP: '171.65.102.104',
    socketClientServerIP: 'localhost',
    socketClientServerPort: 5200
};

var user = {
    id: '5821046dbc2185411c4ba7fd', //'574885898bf18b9508193e2a',
    name: 'radiantllama',
    groups: ['default']
};

var session = {
    id: '5820fffd5781d5ddfd951ffa', //'574885a08bf18b9508193e2c',
    sessionID: 'i4bP9hXwNA3WuH0p6m0TCUIA9Wtz0Ydu', //'f5wrk6pHdo8bzWgPyd9qDtUtY26HsJCe',
    socketID: null,
    socketHandle: '/account/joinlabwithdata',
    url: '/account/joinlabwithdata'
};

var domain = "http://" + serverInfo.socketClientServerIP + ":" + serverInfo.socketClientServerPort;
console.info('connecting to BPU controller at ' + domain);

var socket = io.connect(domain, {multiplex: false, reconnect: true});

socket.on(router.disconnect, function () {
    console.error('BPU controller disconnected');
});


socket.on(router.connect, function () {
    console.info('BPU controller connected');

    socket.emit(router.authorize, serverInfo, function (err, auth) {
        if (err) {
            console.error(err);
        } else {
            console.info('connected with ' + auth.Name);
            // console.log(auth);

            app.auth = auth;
            session['socketID'] = socket.id;

            socket.emit(router.getQueue, serverInfo, function (err, queueObj) {
                  // console.log(queueObj);

                if(!err) {
                    var inputFiles = [{
                        eventsToRun: [
                            {topValue: 0, rightValue: 0, bottomValue: 0, leftValue: 0, time: 0},
                            {topValue: 100, rightValue: 0, bottomValue: 0, leftValue: 0, time: 30000},
                            {topValue: 0, rightValue: 50, bottomValue: 60, leftValue: 0, time: 50000},
                            {topValue: 0, rightValue: 0, bottomValue: 0, leftValue: 0, time: 60000}
                        ],
                        metadata: {
                            clientCreationDate: new Date(),
                            group_experimentType: "text",
                            runTime: 60000,
                            tag: "username",  // user name or any tag
                            userUrl: "/account/joinlabwithdata/"
                        }

                    }];

                    socket.prepareExperiment(inputFiles, app.auth, queueObj);
                }
            });
        }
    });
});

socket.on('update', function (bpuList, experimentList, queue) {
    console.log("******** experiment queue updated *********");
    // console.log(bpuList);
    // console.log(experimentList);
    console.log(queue);
});

socket.prepareExperiment = function (inputFiles, auth, queueObj) {
    var queue = [];

    inputFiles.forEach(function (fileObj) {
        var data = JSON.parse(JSON.stringify(queueObj));
        data.group_experimentType = 'text';
        data.exp_eventsToRun = fileObj.eventsToRun;
        data.exp_metaData = fileObj.metadata;
        queue.push(data);
    });

    if (queue.length > 0) {

        //Add common data to all
        queue.forEach(function (obj) {
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


        socket.submitExperiment(auth, queue, function (err, res) {
            console.log("******** submit experiment response *********");
            console.error(err);
            console.log(res);
        });
    }
};

socket.submitExperiment = function (auth, queue, callback) {
    socket.emit(router.submitExperiment, auth, queue, function (err, res) {
        callback(err, res);
    });
};


