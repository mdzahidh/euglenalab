var Canvas_Joystick=function(canvasDiv) {
  var thisJoy=this; 
  //Class Variables
  thisJoy.snapBack=true;
  thisJoy.className='canvas-joystick';
 
  //Touch Events
  thisJoy.canvasDiv=canvasDiv;

  //Create Canvas
  var canvasPCT=1.0;
  thisJoy.canvas=document.createElement('canvas');
  thisJoy.canvas.id='JoystickCanvas';
  thisJoy.canvas.width=canvasDiv.clientWidth*canvasPCT;
  thisJoy.canvas.height=canvasDiv.clientHeight*canvasPCT;
  thisJoy.canvas.className=thisJoy.className + '-' + 'off';
  thisJoy.canvas.style.left=canvasDiv.clientWidth*((1 - canvasPCT)*0.500) + 'px';
  thisJoy.canvas.style.top=canvasDiv.clientHeight*((1 - canvasPCT)*0.500) + 'px';
  thisJoy.canvas.style.position='relative';
  canvasDiv.appendChild(thisJoy.canvas);
 
  //Set Context
  var context=thisJoy.canvas.getContext('2d');
  context.strokeStyle="#ff00ff";
  context.lineWidth=2;
 
  //OriginalValues
  thisJoy.org={};
  thisJoy.org.textIntensity={x:5, y:44, size:'20'};
  thisJoy.org.textAngle={x:5, y:20, size:'20'};
  
  //Static Joystick Parameters 
  thisJoy.RADS_TO_DEGREES=180/Math.PI;  
  thisJoy.TWO_PI=2*Math.PI;  
  thisJoy.segs=48;
  thisJoy.arcLength=(thisJoy.TWO_PI)/thisJoy.segs;
  thisJoy.textIntensity=JSON.parse(JSON.stringify(thisJoy.org.textIntensity));
  thisJoy.textAngle=JSON.parse(JSON.stringify(thisJoy.org.textAngle));
  //Resize Joystick Parameters
  thisJoy.centerPoint={x:thisJoy.canvas.width*0.500, y:thisJoy.canvas.height*0.550};
  thisJoy.maxJoyRadius=thisJoy.canvas.width*0.300;
  thisJoy.joyHeadRadius=thisJoy.maxJoyRadius*0.200;
  //Dynamic Joystick Parameters
  thisJoy.dx_evt=0;
  thisJoy.dy_evt=0;
  thisJoy.mag_evt=0;
  thisJoy.inten_evt=0;
  thisJoy.degs_evt=0;
  thisJoy.rads_evt=0;
  thisJoy.sin_evt=0;
  thisJoy.cos_evt=0;
  thisJoy.x_evt=thisJoy.centerPoint.x;
  thisJoy.y_evt=thisJoy.centerPoint.y;

  //Draw Updates

  this.updateDraw=function() {
    //Clear Draw Context
    context.clearRect(0, 0, thisJoy.canvas.width, thisJoy.canvas.height);
    
    //Resize Joystick Parameters
    //thisJoy.maxJoyRadius=thisJoy.canvas.width*0.300;
    //if(thisJoy.canvas.height<thisJoy.canvas.width) {thisJoy.maxJoyRadius=thisJoy.canvas.height*0.300;}
    //thisJoy.joyHeadRadius=thisJoy.maxJoyRadius*0.200;
    //thisJoy.centerPoint={x:thisJoy.canvas.width*0.500, y:thisJoy.canvas.height*0.550};
    //thisJoy.textIntensity={x:10, y:44};
    //thisJoy.textAngle={x:0, y:20};
   
    //Draw Sequence
    
    //Static 
    drawBoundingCircle();
    drawBoundingCircleHalf();
   
    //Dynamic - Fillstyle(opacity) Depends on intensity of joystick
    drawIntensityCircle(thisJoy.inten_evt);

    //Static    
    drawCenterMark();
   
    //Dynamic -  
    drawJoystickStick(thisJoy.x_evt, thisJoy.y_evt);
    drawJoystickHead(thisJoy.x_evt, thisJoy.y_evt);
   
    //Text  
    drawIntensityText(thisJoy.inten_evt);    
    drawAngleText(thisJoy.degs_evt);        
  };

  //Draw Functions
  //Dynamic 
  var drawIntensityCircle=function(alpha) {  //alpha: Depends on intensity of joystick
    context.beginPath();
    context.fillStyle = "rgba(255, 255, 0, "+alpha+")";
    context.arc(thisJoy.centerPoint.x, thisJoy.centerPoint.y, thisJoy.maxJoyRadius*0.95, 0, thisJoy.TWO_PI, true);
    context.fill();
  };
  var drawJoystickStick=function(xPos, yPos) {  //xPos, yPos: joystick x, y coordinantes
    context.beginPath();
    context.strokeStyle="rgba(255, 255, 255, "+'0.666'+")";
    context.lineWidth=2;
    context.moveTo(thisJoy.centerPoint.x, thisJoy.centerPoint.y);
    context.lineTo(xPos, yPos);
    context.stroke();
  };
  var drawJoystickHead=function(xPos, yPos) {
    context.beginPath();
    context.fillStyle="rgba(53, 103, 191, "+1.0+")";
    context.arc(xPos, yPos, thisJoy.joyHeadRadius, 0, thisJoy.TWO_PI, true);
    context.fill();
  };
  //Static
  var drawCenterMark=function() {
    context.beginPath();
    context.strokeStyle="rgba(255, 255, 255, 1)";
    context.lineWidth=2;
    context.moveTo(thisJoy.centerPoint.x, thisJoy.centerPoint.y-4);
    context.lineTo(thisJoy.centerPoint.x, thisJoy.centerPoint.y+4);
    context.moveTo(thisJoy.centerPoint.x-4, thisJoy.centerPoint.y);
    context.lineTo(thisJoy.centerPoint.x+4, thisJoy.centerPoint.y);
    context.stroke();
  };
  var drawBoundingCircle=function() {
    for(var i=0;i<thisJoy.segs;i=i+2) {
      context.beginPath();
      context.strokeStyle="rgba(255, 255, 255, 0.5)";
      context.lineWidth=2;
      context.arc(thisJoy.centerPoint.x, thisJoy.centerPoint.y, thisJoy.maxJoyRadius, i*thisJoy.arcLength+thisJoy.arcLength, i*thisJoy.arcLength, true);
      context.stroke();
    }
  };
  var drawBoundingCircleHalf=function() {
    var arcLengthHalf=thisJoy.arcLength*0.500;
    for(var i=0;i<thisJoy.segs*2;i=i+2) {
      context.beginPath();
      context.strokeStyle="rgba(255, 255, 255, 0.5)";
      context.lineWidth=2;
      context.arc(thisJoy.centerPoint.x, thisJoy.centerPoint.y, thisJoy.maxJoyRadius*0.500, i*arcLengthHalf+arcLengthHalf, i*arcLengthHalf, true);
      context.stroke();
    }
  };


  //Text
  var drawIntensityText=function(alpha) {
    context.beginPath();
    context.fillStyle="rgba(255, 255, 255, "+1.0+")"; 
    context.font=thisJoy.textIntensity.size+'px Veranda';
    var txt=Math.round(alpha*100)/100 + '';
    if(txt.length===1) {txt+='.00';}
    else if(txt.length===3) {txt+='0';}
    context.fillText('Intensity: ' + txt, thisJoy.textIntensity.x, thisJoy.textIntensity.y);
  };
  var drawAngleText=function(angle) {
    context.beginPath();
    context.fillStyle="rgba(255, 255, 255, "+1.0+")"; 
    context.font=thisJoy.textAngle.size+'px Veranda';
    var num=Number(angle);
    if(num<=0) {num=Math.abs(num);}
    else {num=360-num;}
    var txt=Math.round(num*100)/100 + '';
    if(txt.length===1) {txt='  '+txt;}
    else if(txt.length===2) {txt=' '+txt;}
    context.fillText('Angle: ' + txt + ' degs', thisJoy.textAngle.x, thisJoy.textAngle.y);
  };

  return this;
};
Canvas_Joystick.prototype=Object.create(Object.prototype);
Canvas_Joystick.prototype.reset=function(index) {
  this.setPositionFromLightValues(lightValues);
};
Canvas_Joystick.prototype.resize=function(width, height) {
  this.canvas.width=width;
  this.canvas.height=height;

  //Resize Joystick Parameters
  this.maxJoyRadius=this.canvas.width*0.300;
  if(this.canvas.height<this.canvas.width) {this.maxJoyRadius=this.canvas.height*0.300;}
  this.joyHeadRadius=this.maxJoyRadius*0.200;
  this.centerPoint={x:this.canvas.width*0.500, y:this.canvas.height*0.550};
  
  if(this.canvas.width<200) {
    this.textAngle.size='12';
    this.textAngle.x=0;
    this.textAngle.y=44;
    
    this.textIntensity.size='12';
    this.textIntensity.x=0;
    this.textIntensity.y=20;

  } else {

    this.textIntensity.size=this.org.textIntensity.size;
    this.textIntensity.x=this.org.textIntensity.x;
    this.textIntensity.y=this.org.textIntensity.y;
    
    this.textAngle.size=this.org.textAngle.size;
    this.textAngle.x=this.org.textAngle.x;
    this.textAngle.y=this.org.textAngle.y;
  }
};
Canvas_Joystick.prototype.toggleJoystick=function(toggle) {
  if(this.canvas.className!==this.className + '-' +toggle) {
    this.canvas.className=this.className + '-' +toggle;
  }
};
Canvas_Joystick.prototype.update=function(text) {
  this.updateDraw(text);
};
Canvas_Joystick.prototype.getXyFromLightValues=function(lightValues, from) {
  
  var x=this.centerPoint.x;
  if(lightValues.leftValue>0) {x-=this.maxJoyRadius*(lightValues.leftValue/100);
  } else if(lightValues.rightValue>0) {x+=this.maxJoyRadius*(lightValues.rightValue/100);}
  
  var y=this.centerPoint.y;
  if(lightValues.topValue>0) {y-=this.maxJoyRadius*(lightValues.topValue/100);
  } else if(lightValues.bottomValue>0) {y+=this.maxJoyRadius*(lightValues.bottomValue/100);}
  
  return {x:Math.round(x), y:Math.round(y)};
};
Canvas_Joystick.prototype.setLightValuesFromXY=function(ledsSetObj, from) {
  
  //Convert Event Vector to Joystick Center
  this.dx_evt=ledsSetObj.metaData.layerX-this.centerPoint.x;
  this.dy_evt=ledsSetObj.metaData.layerY-this.centerPoint.y;
  
  //Get parameters
  this.mag_evt=Math.sqrt((this.dx_evt*this.dx_evt)+(this.dy_evt*this.dy_evt));
  this.rads_evt=Math.atan2(this.dy_evt, this.dx_evt);
  if(this.mag_evt===0) {
    this.sin_evt=0;
    this.cos_evt=0;
  } else {
    this.sin_evt=this.dy_evt/this.mag_evt;
    this.cos_evt=this.dx_evt/this.mag_evt;
  }
  
  //Check parameters outside joystick radius 
  //  scale down to max
  if(this.mag_evt>this.maxJoyRadius) {
    this.dx_evt=this.maxJoyRadius*this.cos_evt;
    this.dy_evt=this.maxJoyRadius*this.sin_evt;
    this.mag_evt=this.maxJoyRadius;
  }
 
  //Joystick head point 
  this.x_evt=this.centerPoint.x+this.dx_evt;
  this.y_evt=this.centerPoint.y+this.dy_evt;

  //Get degrees for for text display
  this.degs_evt=(this.rads_evt*this.RADS_TO_DEGREES).toFixed(0);
  //Set intensity/alpha for draw
  this.inten_evt=(this.mag_evt/this.maxJoyRadius).toFixed(2);
  
  //Parse light values, Scale to 100, and Set Light Values
  if(this.sin_evt<=0) {
    ledsSetObj.topValue=Math.round(Math.abs(this.sin_evt*this.inten_evt)*100);
    ledsSetObj.bottomValue=0;
  } else {
    ledsSetObj.topValue=0;
    ledsSetObj.bottomValue=Math.round(Math.abs(this.sin_evt*this.inten_evt)*100);
  }
  if(this.cos_evt<=0) {
    ledsSetObj.leftValue=Math.round(Math.abs(this.cos_evt*this.inten_evt)*100);
    ledsSetObj.rightValue=0;
  } else {
    ledsSetObj.leftValue=0;
    ledsSetObj.rightValue=Math.round(Math.abs(this.cos_evt*this.inten_evt)*100);
  }

  //Add info to ledsSetObj  
  ledsSetObj.metaData.intensity=this.inten_evt;
  ledsSetObj.metaData.degs=this.degs_evt;
  ledsSetObj.metaData.rads=this.rads_evt;
  ledsSetObj.metaData.x=this.x_evt;
  ledsSetObj.metaData.y=this.y_evt;
  
  return ledsSetObj;
};
