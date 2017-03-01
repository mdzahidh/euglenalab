//Modules
var rpi =require("wiring-pi");
rpi.wiringPiSPISetup(0,10000000);
var rst_buf = new Buffer ([0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00]);
rpi.wiringPiSPIDataRW(0,rst_buf);


var board = {};


    board.ledsSet=function(topValue, rightValue, bottomValue, leftValue) {
      var buf = new Buffer ([0x11,leftValue,0x11,bottomValue,0x11,rightValue,0x11,topValue]);
      rpi.wiringPiSPIDataRW(0,buf);
    };

    board.diffuserSet=function(value) {
      var buf = new Buffer ([0x00,0x00,0x00,0x00,0x00,0x00,0x12,value]);
      rpi.wiringPiSPIDataRW(0,buf);
    };

    board.backlightSet=function(value) {
      var buf = new Buffer ([0x00,0x00,0x00,0x00,0x12,value,0x00,0x00]);
      rpi.wiringPiSPIDataRW(0,buf);
    };

    board.culturelightSet=function(value) {
      var buf = new Buffer ([0x00,0x00,0x12,value,0x00,0x00,0x00,0x00]);
      rpi.wiringPiSPIDataRW(0,buf);
    };

    board.ambientlightSet=function(value) {
      var buf = new Buffer ([0x12,value,0x00,0x00,0x00,0x00,0x00,0x00]);
      rpi.wiringPiSPIDataRW(0,buf);
    };

board.ledsSet(0x00,0xff,0x00,0xff);
board.diffuserSet(0x00);
board.backlightSet(0xff);
board.culturelightSet(0xff);
board.ambientlightSet(0x00);
