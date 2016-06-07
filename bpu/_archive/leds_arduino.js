//Modules
var __five=require("johnny-five");
//Variables
var _valveState='valveClosed';
//Init
exports.init=function(options, myPrint, callback) {
  var board=new __five.Board();
  //REPL Console Commands
  var replFunctions=[
    {name:'helpMe', args:[], msg:'helpMe()'},
    {name:'ledsOff', args:[], msg:'ledsOff()'},
    {name:'ledsOn', args:[], msg:'ledsOn()'},
    {name:'ledSet', args:['pin', 'value'], msg:'ledSet(pin, value)'},
    {name:'ledsSet', args:['topValue', 'rightValue', 'bottomValue', 'leftValue'], 
      msg:'ledsSet(topValue, rightValue, bottomValue, leftValue)'},
    {name:'ledsTest', args:[], msg:'ledsTest(runCount)'},
    {name:'valveToggle', args:[], msg:'valveToggle()'},
    {name:'valveOpen', args:[], msg:'valveOpen()'},
    {name:'valveClose', args:[], msg:'valveClose()'},
    {name:'valveState', args:[], msg:'valveState()'},
  ];
  board.on("ready", function() {
    myPrint('myArduino', 'ready');
    //LEDs
    board.ledsOff=function() {
      myPrint('myArduino', 'board'+'\t'+'ledsOff'+'\t'+null);
      Object.keys(options.LedPins).forEach(function(item) {
        board.ledSet(options.LedPins[item], 0)
      });
    };
    board.ledsOn=function() {
      myPrint('myArduino', 'board'+'\t'+'ledsOn'+'\t'+null);
      Object.keys(options.LedPins).forEach(function(item) {
        board.ledSet(options.LedPins[item], 255)
      });
    };
    board.ledSet=function(pin, value) {
      //myPrint('myArduino', 'board'+'\t'+'ledSet'+'\t'+pin+'\t'+value);
      if(typeof pin!='number' && options.LedPins[pin]) {pin=options.LedPins[pin];}
      board.pinMode(pin, __five.Pin.PWM);
      board.analogWrite(pin, value);
    };
    board.ledsSet=function(topValue, rightValue, bottomValue, leftValue) {
      var msg=topValue+'\t'+rightValue+'\t'+bottomValue+'\t'+leftValue;
      myPrint('myArduino', 'board'+'\t'+'ledsSet'+'\t'+msg);
      board.ledSet(options.LedPins['Top'], topValue);
      board.ledSet(options.LedPins['Right'], rightValue);
      board.ledSet(options.LedPins['Bottom'], bottomValue);
      board.ledSet(options.LedPins['Left'], leftValue);
    };
    board.ledsTest=function(runCount, callback) {
      myPrint('myArduino', 'board'+'\t'+'ledsTest'+'\t'+runCount);
      if(typeof runCount!='number') {runCount=10;}
      var ledNames=Object.keys(options.LedPins);
      var nextLed=function() {
        for(var i=0;i<ledNames.length;i++) {
          var value=0;
          if(runCount%ledNames.length==i) {value=255;} 
          board.ledSet(options.LedPins[ledNames[i]], value)
        }
        if(runCount>0) {setTimeout(nextLed, 500);
        } else {
          board.ledsOff();
          if(callback) {
            myPrint('myArduino', 'board'+'\t'+'ledsTest'+'\t'+'callback');
            if(callback) {callback();}
          }
        }
        runCount--;
      };
      board.ledsOn(); 
      setTimeout(function() {
        board.ledsOff(); 
        nextLed();
      }, 1000)
    };
    //Valve
    board.valveToggle=function() {
      myPrint('myArduino', 'board'+'\t'+'valveToggle'+'\t'+_valveState);
      if(_valveState=='valveClosed') {board.valveOpen(); return _valveState;
      } else {board.valveClose(); return _valveState;} 
    } 
    board.valveOpen=function() {
      myPrint('myArduino', 'board'+'\t'+'valveOpen'+'\t'+_valveState);
      board.pinMode(options.ValvePin, __five.Pin.PWM);
      board.analogWrite(options.ValvePin, 255);
      _valveState='valveOpen';
    }
    board.valveClose=function() {
      myPrint('myArduino', 'board'+'\t'+'valveClose'+'\t'+_valveState);
      board.pinMode(options.ValvePin, __five.Pin.PWM);
      board.analogWrite(options.ValvePin, 0);
      _valveState='valveClosed';
    }
    board.valveState=function() {
      myPrint('myArduino', 'board'+'\t'+'valveState'+'\t'+_valveState);
      return _valveState;
    }, 
   /* 
    board.repl.inject({
      helpMe:function() {
        myPrint('myArduino', 'board.repl'+'\t'+'helpMe'+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          console.log('Socket/REPL Functions')
          replFunctions.forEach(function(item) {console.log('\t'+item.msg);});
          return 'your welcome';
        } 
      },
      //Leds 
      ledsOff:function(runCount) {
        myPrint('myArduino', 'board.repl'+'\t'+'ledsOff'+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          board.ledsOff(); return 'LEDs Off';
        }
      },
      ledsOn:function() {
        myPrint('myArduino', 'board.repl'+'\t'+'ledsOn'+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          board.ledsOn(); return 'LEDs On';
        }
      },
      ledSet:function(pin, value) {
        myPrint('myArduino', 'board.repl'+'\t'+'ledSet'+'\t'+pin+'\t'+value+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          board.ledSet(pin, value); 
          return 'LED set';
        }
      },
      ledsSet:function(topValue, rightValue, bottomValue, leftValue) {
        var msg=topValue+'\t'+rightValue+'\t'+bottomValue+'\t'+leftValue;
        myPrint('myArduino', 'board.repl'+'\t'+'ledsSet'+'\t'+msg+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          board.ledsSet(topValue, rightValue, bottomValue, leftValue); 
          return 'LEDs set';
        }
      },
      ledsTest:function(runCount) {
        myPrint('myArduino', 'board.repl'+'\t'+'ledsTest'+'\t'+runCount+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          board.ledsTest(runCount);
          return 'LEDs run';
        }
      },
      //Valve 
      valveToggle:function() {
        myPrint('myArduino', 'board.repl'+'\t'+'valveToggle'+'\t'+_valveState+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          board.valveToggle(); 
          return _valveState;
        } 
      }, 
      valveOpen:function() {
        myPrint('myArduino', 'board.repl'+'\t'+'valveOpen'+'\t'+_valveState+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          board.valveOpen(); 
          return _valveState;
        }
      }, 
      valveClose:function() {
        myPrint('myArduino', 'board.repl'+'\t'+'valveClose'+'\t'+_valveState+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          board.valveClose(); 
          return _valveState;
        }
      }, 
      valveState:function() {
        myPrint('myArduino', 'board.repl'+'\t'+'valveState'+'\t'+_valveState+'\t'+_sessionRunning);
        if(!_sessionRunning) {
          return board.valveState();
        }
      }, 
    });

    
    //Run Light 
    if(options.doRunBlink) {new __five.Led(options.RunPin).blink(500);}
    //Test on Start up
    if(options.doTestLeds) {board.testLeds(10, function() {callback(null, replFunctions)});
    } else {callback(null, replFunctions);}
*/
    exports.board=board;
callback(null, []);
  });
};
