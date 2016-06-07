// Example of using PWM
var wpi = require('wiring-pi');
//var async = require('async');

wpi.setup('wpi');

var pins = [5,6,9,10];
var levels = [0,33,67,100];
diffuserPin = 12;
valvePin = 11;
//wpi.pinMode(pin, wpi.PWM_OUTPUT);

for(var p in pins) {
    console.log(pins[p]);
    wpi.softPwmCreate(pins[p],0,100);
}

//wpi.softPwmCreate(diffuserPin,0,100);
wpi.pinMode(diffuserPin,wpi.OUTPUT);
wpi.digitalWrite(diffuserPin,1);

wpi.pinMode(valvePin,wpi.OUTPUT);

/*
async.series([
  function (cb) {
    for(var p in pins){
        wpi.softPwmWrite(pins[p], 10);
    }
    cb();
  },
  function (cb) {
    setTimeout(cb, 1000);
  },
  function (cb) {
    wpi.softPwmWrite(pin, 100);
    cb();
  },
  function (cb) {
    setTimeout(cb, 1000);
  },
  function (cb) {
    wpi.softPwmWrite(pin, 0);
    cb();
  }
], function (err) {
});

*/


var count = 0;
setInterval(function(){
    for(var p in pins){
        wpi.softPwmWrite(pins[p],levels[p]);
    }
    //wpi.softPwmWrite(diffuserPin,(count*20)%100);
    if( count % 5 == 0){
        wpi.digitalWrite(valvePin,1);
        setTimeout(function(){
            wpi.digitalWrite(valvePin,0);
        },1000);
    }
    levels.push(levels.shift());  
    count = count + 1;
},1000);
