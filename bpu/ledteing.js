var rpi =require("wiring-pi");
rpi.setup('sys');
//rpi.pinMode(25, rpi.OUTPUT);
rpi.softPwmCreate(25,0,100);
rpi.softPwmWrite(25,100);

setTimeout(function(){}, 5000);
