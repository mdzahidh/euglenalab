//Modules
var rpi =require("wiring-pi");
rpi.wiringPiSPISetup(0,10000000);
var rst_buf = new Buffer ([0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00]);
rpi.wiringPiSPIDataRW(0,rst_buf);

var board = {};

 
    board.ledsSet=function(topValue, rightValue, bottomValue, leftValue) {   
      topValue = Math.round(( topValue / 100.0 ) * 255.0);
      rightValue = Math.round(( rightValue / 100.0 ) * 255.0);
      bottomValue = Math.round(( bottomValue / 100.0 ) * 255.0);
      leftValue = Math.round(( leftValue / 100.0 ) * 255.0);
      var buf = new Buffer ([0x11,leftValue,0x11,bottomValue,0x11,rightValue,0x11,topValue]); 
      rpi.wiringPiSPIDataRW(0,buf);
    };
   
    board.diffuserSet=function(diffuserValue) { 
      diffuserValue = Math.round(( diffuserValue / 100.0 ) * 255.0);
      var buf = new Buffer ([0x00,0x00,0x00,0x00,0x00,0x00,0x12,diffuserValue]); 
      rpi.wiringPiSPIDataRW(0,buf);
    };
  
    board.backlightSet=function(backlightValue) {
      backlightValue = Math.round(( backlightValue / 100.0 ) * 255.0);  
      var buf = new Buffer ([0x00,0x00,0x00,0x00,0x12,backlightValue,0x00,0x00]); 
      rpi.wiringPiSPIDataRW(0,buf);
    };    

    board.culturelightSet=function(culturelightValue) {
      culturelightValue = Math.round(( culturelightValue / 100.0 ) * 255.0);
      var buf = new Buffer ([0x00,0x00,0x12,culturelightValue,0x00,0x00,0x00,0x00]); 
      rpi.wiringPiSPIDataRW(0,buf);
    };
  
    board.ambientlightSet=function(ambientlightValue) {
      ambientlightValue = Math.round(( ambientlightValue / 100.0 ) * 255.0);
      var buf = new Buffer ([0x12,ambientlightValue,0x00,0x00,0x00,0x00,0x00,0x00]); 
      rpi.wiringPiSPIDataRW(0,buf);
    }; 


board.ledsSet(100,100,100,100);
board.diffuserSet(100);
board.backlightSet(100);
board.culturelightSet(100);
board.ambientlightSet(100);
