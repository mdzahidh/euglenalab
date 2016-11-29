var io = require('socket.io-client');
var _ = require('lodash');
var http = require('http');
var fs = require('fs');

var app = app || {};
app.experiments = [];
app.downloads = [];


//*** DO NOT MODIFY THIS SECTION **********
var router = {
    connect: 'connect',
    disconnect: 'disconnect',
    authorize: 'setConnection',
    getQueue: 'getJoinQueueDataObj',
    submitExperiment: '/bpuCont/#submitExperimentRequest'
};

var serverInfo = {
    Identifier: 'C422691AA38F9A86EC02CB7B55D5F542',
    name: 'radiantllama',
    socketClientServerIP: 'biotic.stanford.edu',
    socketClientServerPort: 8084
};

var user = {
    id: '582125878414c9532bafabaa',
    name: 'radiantllama',
    groups: ['default']
};

var session = {
    id: '582117b8ba3546ad26e4a452',
    sessionID: 'i4bP9hXwNA3WuH0p6m0TCUIA9Wtz0Ydu',
    socketID: null,
    socketHandle: '/account/joinlabwithdata',
    url: '/account/joinlabwithdata'
};

var downloadServer = "http://" + serverInfo.socketClientServerIP + "/account/joinlabwithdata/downloadFile/";

var domain = "http://" + serverInfo.socketClientServerIP + ":" + serverInfo.socketClientServerPort;
//*** DO NOT MODIFY THIS SECTION **********


// connect to BPU controller
console.info('connecting to BPU controller at ' + domain);
var socket = io.connect(domain, {multiplex: false, reconnect: true});


// register listener hooks

// on connection lost
socket.on(router.disconnect, function () {
    console.error('BPU controller disconnected');
});


// on connection
socket.on(router.connect, function () {
    console.info('BPU controller connected');

    socket.emit(router.authorize, serverInfo, function (err, auth) {
        if (err) {
            console.error(err);
        } else {
            console.info('connected with ' + auth.Name);

            app.auth = auth;
            session['socketID'] = socket.id;

            socket.emit(router.getQueue, serverInfo, function (err, queueObj) {
                // console.log(queueObj);

                if (!err) {

                    // format of input files to setup an experiment
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
                            tag: user.name,  // user name or any tag
                            userUrl: "/account/joinlabwithdata/"
                        }

                    }];

                    // trigger an experiment using text mode
                    socket.prepareExperiment(inputFiles, app.auth, queueObj);
                }
            });
        }
    });
});


// keep updating the current status of BPUs and experiment queue
socket.on('update', function (bpuList, experimentList, queue) {
    var experiments = _.filter(bpuList, function (bpu) {
        return bpu.isOn && bpu.bpuStatus == "running" && bpu.liveBpuExperiment.username == user.name && _.indexOf(app.experiments, bpu.liveBpuExperiment.id) >= 0;
    });

    console.log(queue);

    if (experiments && experiments.length > 0) {
        experiments.forEach(function (bpu) {
            console.log("Experiment " + bpu.liveBpuExperiment.id + " running on " + bpu.name + " : " + bpu.liveBpuExperiment.bc_timeLeft / 1000 + " seconds left");

            if (bpu.liveBpuExperiment.bc_timeLeft < 2000 && _.indexOf(app.downloads, bpu.liveBpuExperiment.id) < 0) {

                // cache experiment id once it is complete
                app.downloads.push(bpu.liveBpuExperiment.id);

                console.log("processing experiment...");

                setTimeout(function () {
                    console.log("downloading experiment...");

                    // download all experiment files
                    // use any particular file based on requirement
                    socket.download(downloadServer + bpu.liveBpuExperiment.id + "/" + bpu.liveBpuExperiment.id + ".json/", bpu.liveBpuExperiment.id + ".json");
                    socket.download(downloadServer + bpu.liveBpuExperiment.id + "/" + "lightdata.json" + "/", "lightdata.json");
                    socket.download(downloadServer + bpu.liveBpuExperiment.id + "/" + "movie.mp4" + "/", "movie.mp4");
                    socket.download(downloadServer + bpu.liveBpuExperiment.id + "/" + "tracks_thresholded_10.mp4" + "/", "tracks_thresholded_10.mp4");
                    socket.download(downloadServer + bpu.liveBpuExperiment.id + "/" + "lightdata_meta.json" + "/", "lightdata_meta.json");
                    socket.download(downloadServer + bpu.liveBpuExperiment.id + "/" + "tracks.json" + "/", "tracks.json");
                    socket.download(downloadServer + bpu.liveBpuExperiment.id + "/" + "tracks_thresholded_10.ogg" + "/", "tracks_thresholded_10.ogg");
                }, 30000); // processing takes about 15-20 seconds

            }
        });
    }

});


// setting up experiment and pushing to queue
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

        //Add common data to all - user and session info
        queue.forEach(function (obj) {
            obj.user.id = user.id;
            obj.user.name = user.name;
            obj.user.groups = session.groups;

            obj.session.id = session.id;
            obj.session.sessionID = session.sessionID;
            obj.session.socketHandle = session.socketHandle;
            obj.session.socketID = session.socketID;

            obj.session.user = user;
            obj.session.user.groups = session.groups;

            obj.exp_metaData.group_experimentType = obj.group_experimentType;
            obj.exp_wantsBpuName = null; // choose any specific bpu or leave it null for any bpu

            obj.exp_metaData.clientCreationDate = new Date();
            obj.exp_metaData.userUrl = session.url;
        });

        var submitExperiment = function (auth, queue, callback) {
            socket.emit(router.submitExperiment, auth, queue, function (err, res) {
                callback(err, res);
            });
        };

        submitExperiment(auth, queue, function (err, res) {
            console.log("******** submit experiment response *********");

            if (err != null) {
                console.error(err);
            }

            if (err == null && res && res.length > 0) {
                // this data can be persisted in database to query experiments later.
                // for now it is all in-memory based
                console.log(res);
                app.experiments.push(res[0]._id);
            }
        });
    }
};


socket.download = function (url, dest) {
    var file = fs.createWriteStream(dest);

    var request = http.get(url, function (response) {
        response.pipe(file);

        file.on('finish', function () {
            console.log("download complete");
            file.close(); // close() is async, call callback after close completes.
        });

        file.on('error', function (err) {
            fs.unlink(dest); // Delete the file async. (But we don't check the result)

            console.log(err.message);
        });
    });
};




