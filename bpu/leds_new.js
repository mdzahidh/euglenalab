//Modules
var rpi =require("wiring-pi");
rpi.wiringPiSPISetup(0,10000000);
var rst_buf = new Buffer ([0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00,0x13,0x00]);
rpi.wiringPiSPIDataRW(0,rst_buf);

var board = {};

 
    board.ledsSet=function(topValue, rightValue, bottomValue, leftValue) {
      topValue = "0x" + topValue;
      topValue = parseInt(topValue,16);
      topValue = topValue.toString(16);

      rightValue = "0x" + rightValue;
      rightValue = parseInt(rightValue,16);
      rightValue = rightValue.toString(16);

      bottomValue = "0x" + bottomValue;
      bottomValue = parseInt(bottomValue,16);
      bottomValue = bottomValue.toString(16);

      leftValue = "0x" + leftValue;
      leftValue = parseInt(leftValue,16);
      leftValue = leftValue.toString(16);

      var buf = new Buffer ([0x11,leftValue.toString(16),0x11,bottomValue.toString(16),0x11,rightValue.toString(16),0x11,topValue.toString(16)]);
      console.log (buf); 
      rpi.wiringPiSPIDataRW(0,buf);
    };
   
    board.diffuserSet=function(diffuserValue) {
      diffuserValue = "0x" + diffuserValue;
      diffuserValue = parseInt(diffuserValue,16);
      diffuserValue = diffuserValue.toString(16);
      var buf = new Buffer ([0x00,0x00,0x00,0x00,0x00,0x00,0x12,diffuserValue.toString(16)]); 
      rpi.wiringPiSPIDataRW(0,buf);
    };
  
    board.backlightSet=function(backlightValue) {
      backlightValue = "0x" + backlightValue;
      backlightValue = parseInt(backlightValue,16);
      backlightValue = backlightValue.toString(16);
      var buf = new Buffer ([0x00,0x00,0x00,0x00,0x12,backlightValue.toString(16),0x00,0x00]); 
      rpi.wiringPiSPIDataRW(0,buf);
    };    

    board.culturelightSet=function(culturelightValue) {
      culturelightValue = "0x" + culturelightValue;
      culturelightValue = parseInt(culturelightValue,16);
      culturelightValue = culturelightValue.toString(16);
      var buf = new Buffer ([0x00,0x00,0x12,culturelightValue.toString(16),0x00,0x00,0x00,0x00]); 
      rpi.wiringPiSPIDataRW(0,buf);
    };
  
    board.ambientlightSet=function(ambientlightValue) {
      ambientlightValue = "0x" + ambientlightValue;
      ambientlightValue = parseInt(ambientlightValue,16);
      ambientlightValue = ambientlightValue.toString(16);
      var buf = new Buffer ([0x12,ambientlightValue,0x00,0x00,0x00,0x00,0x00,0x00]); 
      rpi.wiringPiSPIDataRW(0,buf);
    }; 


board.ledsSet(255,255,255,255);
board.diffuserSet(255);
board.backlightSet(255);
board.culturelightSet(255);
board.ambientlightSet(255);
