'use strict';

var async=require('async');

//Mongoose
var mongoose=require('mongoose');
var mongoUri='mongodb://localhost:27017/'+'master';

var mainConfig = require("../shared/mainConfig");

var schemaPath='../shared/mongoDb/schema';

var app = {
    db:null
};

var initMongoose = function( cb ){
    app.db = mongoose.createConnection( mongoUri );
    app.db.on('error', function(err){
        cb('Error on opening database: ' + err);
    })
    app.db.once('open',function(err){
        require('./mongoModels')(app, mongoose);
        cb(null);
    })
};

var createDataBase = function( cb ) {
    mainConfig.bpus.forEach( function(bpu){
        app.db.models.Bpu.update({name:bpu.name}, bpu, {upsert:true,setDefaultsOnInsert:true}, function(err,newBPU){
            if(err){
                console.log('Error in creating new BPU: ' + err);
                cb(err);
            }
            else{
                console.log(newBPU);
            }
        });
    } );
    cb(null)
}

async.series( [initMongoose, createDataBase], function(err){
    if(err){
        console.log('Error from series: ' + err);
    }
})