/*
 * https://www.npmjs.com/package/assert
 * https://nodejs.org/api/assert.html#assert_assert_fail_actual_expected_message_operator
 * https://nelsonic.gitbooks.io/node-js-by-example/content/core/assert/README.html
 */

var assert=require('assert');

var assertMyObject=function(objToTest, xProps) {
  /*
   * My way to test if object has proper keys, values, and types.
   */

    var catchErr=null; 
    try { 
      for(var ind=0;ind<xProps.length;ind++) {
        var xProp=xProps[ind];
        var prop=objToTest[xProp.key];
        var baseMsg='property('+xProp.key+') with value('+prop+')';
        //Does the key exist in the object 
        assert.notEqual(prop, null, baseMsg+' is null.');
        assert.notEqual(prop, undefined, baseMsg+' is undefined.');  //redundant?, assert seems to think null=undefined
        //Checks Type 
        assert.equal(typeof prop, xProp.type, baseMsg+' is of type('+typeof prop+') and not type('+xProp.type+').');
        //Check type object function
        if(typeof prop==='object' && xProp.objectFunciton!==null && xProp.objectFunciton!==undefined) {
          assert.equal(typeof prop[xProp.objectFunciton], 'function', baseMsg+' does not have function('+xProp.objectFunciton+').');
        }
        //Check Allowed Values 
        if(xProp.allowedValues && xProp.allowedValues.length>0) {
          assert.notEqual(xProp.allowedValues.indexOf(prop), -1, baseMsg+' is not allowed.');
        }
        //Check Limits on Numbers 
        if(typeof prop==='number') {
          //Lower Limit
          if(xProp.lowLim!==null &&  xProp.lowLim!==undefined) {
            assert(prop>xProp.lowLim, baseMsg+' is below lower limit('+xProp.lowLim+').');
          }
          //Upper Limit
          if(xProp.upLim!==null &&  xProp.upLim!==undefined) {
            assert(prop<xProp.upLim, baseMsg+' is above lower limit('+xProp.upLim+').');
          }
        }
      }
    } catch(err) {
      catchErr=err;
    } finally {
      if(catchErr!==null) {
        console.log(catchErr.message); 
        return false; 
      } else {
        return true;
      }
    }
};

var xProps=[
  {key:'name',    type:'string', objectFunciton:null,  allowedValues:[],              lowLim:null,  upLim:null},
  {key:'index',   type:'number', objectFunciton:null,  allowedValues:[],              lowLim:0,     upLim:null},
  {key:'type',    type:'string', objectFunciton:null,  allowedValues:['a', 'b', 'c'], lowLim:null,  upLim:null},
  {key:'value',   type:'number', objectFunciton:null,  allowedValues:[],              lowLim:0,     upLim:100},
  {key:'date',    type:'object', objectFunciton:'getTime',  allowedValues:[],         lowLim:0,     upLim:100},
];

var obj={
  name:'objA', 
  index:1, 
  value:6, 
  type:'c',
  date:new Date(),
  //date:'adadf',
  //date:{getTime:function(){}},
  //date:{getTime:'asdf'},
  //date:{getTime:{}},
};

if(assertMyObject(obj, xProps)) {
  console.log('okay');
} else {
  console.log('skip');
}
