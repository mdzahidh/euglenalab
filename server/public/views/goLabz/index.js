/* global app:true */
(function() {
  'use strict';
  app = app || {};
  app.Session = Backbone.Model.extend({
    idAttribute: '_id',
    url: '/goLabz/'
  });
  app.User = Backbone.Model.extend({
    idAttribute: '_id',
    url: '/goLabz/'
  });
  app.LiveJoin = Backbone.Model.extend({
    idAttribute: '_id',
    url: '/goLabz/'
  });
  app.MainView = Backbone.View.extend({
    el: '.page .container',
    
    didPassCanceling:false,
    isSocketInitialized:false,
    hasAcceptedLiveExp:false,
    lastBpuUpdateObj:null,
    wasUpdateUIsCalled:false,
    bpuIndicies:[],
    
    //General Functions
    roundMsToMins:function(ms) {
      return Math.floor(ms/60000);
    },
    roundMsToSeconds:function(ms) {
      return Math.round(ms/1000);
    },
    
    //Text and Live Experiment Object
    userExpInfo:{
      isSubmitting:false,
      liveExp:{
        maxActive:1,
        activeExps:null,
        maxTime:5*60*1000,
        timeToFinish:null,
        canSubmit:function(doPrint, tag) {
          if(doPrint) {
            console.log(tag+' liveExp.activeExps'+'='+app.mainView.userExpInfo.liveExp.activeExps, app.mainView.userExpInfo.liveExp.activeExps!==null);
            console.log(tag+' liveExp.timeToFinish'+'='+app.mainView.userExpInfo.liveExp.timeToFinish, app.mainView.userExpInfo.liveExp.timeToFinish!==null);
            console.log(tag+' isSubmitting'+'='+app.mainView.userExpInfo.isSubmitting, !app.mainView.userExpInfo.isSubmitting);
            console.log(tag+' isSubmitting'+'='+app.mainView.userExpInfo.isSubmitting, !app.mainView.userExpInfo.isSubmitting);
            console.log(tag+' liveExp.activeExps<liveExp.maxActive'+'='+
                app.mainView.userExpInfo.liveExp.activeExps+'<'+app.mainView.userExpInfo.liveExp.maxActive, 
                app.mainView.userExpInfo.liveExp.activeExps<app.mainView.userExpInfo.liveExp.maxActive);
            console.log(tag+' liveExp.timeToFinish<liveExp.maxTime'+'='+
                app.mainView.userExpInfo.liveExp.timeToFinish+'<'+app.mainView.userExpInfo.liveExp.maxTime, 
                app.mainView.userExpInfo.liveExp.timeToFinish<app.mainView.userExpInfo.liveExp.maxTime);
          }
          if(app.mainView.userExpInfo.liveExp.activeExps!==null && app.mainView.userExpInfo.liveExp.timeToFinish!==null) {
            if(!app.mainView.userExpInfo.isSubmitting &&
              app.mainView.userExpInfo.liveExp.activeExps<app.mainView.userExpInfo.liveExp.maxActive &&
              app.mainView.userExpInfo.liveExp.timeToFinish<app.mainView.userExpInfo.liveExp.maxTime) {
                return true;
            } else {
              return false;
            }
          } else {
            return false;
          }
        },
      },
    },
    //Only Path to start join Queue Seq, called from one location in each, BpuImage, LiveJoin, TextSubmit
    submitExperimentFromViews:function(type, bpuIndex, cb_fn) {
      //Disable UI
      app.mainView.disableUI('app.mainView.submitExperimentFromViews');
      if(app.mainView.isSocketInitialized) {
        if(!app.mainView.userExpInfo.isSubmitting) {
          app.mainView.userExpInfo.isSubmitting=true;
          var joinQueueDataObjects=[];
          var isLive=false; 
          var doSend=false;
          if(type==='live') {
            isLive=true;
            var joinQueueData=JSON.parse(JSON.stringify(app.mainView.joinQueueDataObj));
            joinQueueData.group_experimentType='live';
            //joinQueueData.exp_eventsToRun=fileObj.eventsToRun; fixed on server
            joinQueueDataObjects.push(joinQueueData);
            doSend=true;
          } else {
            cb_fn('not recognized experimentType:'+type);
          }
          if(doSend) {
            //Client wants certain bpu 
            var wantsBpuName=null; 
            if(!isNaN(Number(bpuIndex))) wantsBpuName='eug'+bpuIndex;
            //Add common data to all
            joinQueueDataObjects.forEach(function(obj) {
              obj.user.id=app.mainView.user.get('_id');
              obj.user.username=app.mainView.user.get('username');
              obj.user.sessionID=app.mainView.user.get('sessionID');
              
              obj.exp_metaData.group_experimentType=obj.group_experimentType;
              obj.exp_metaData.clientCreationDate=new Date();
              obj.exp_metaData.userUrl=app.mainView.user.url;
              obj.exp_metaData.tag='no tag set';
              obj.exp_metaData.description='no description set';

              obj.exp_wantsBpuName=wantsBpuName;
            });
            //Start Sequence 
            app.userSocketClient.startJoinQueueSequence(joinQueueDataObjects, isLive, function(err) {
              console.log(type+' startJoinQueueSequence err:'+err);
              setTimeout(function() {
                app.mainView.userExpInfo.isSubmitting=false;
              }, 2500);
            });
          }
        } else {
          cb_fn('app.mainView.userExpInfo.isSubmitting');
        }
      } else {
        cb_fn('!app.mainView.isSocketInitialized');
      }
    },
    
    //Disable UI 
    disableUI:function(caller) {
      app.liveJoinView.disableJoinLiveNextButton(true, caller+'+'+'app.mainView.disableUI');
    },
    //Enable UI
    enableUI:function(caller) {
      if(app.mainView.exps.length===0 && app.mainView.bpus.length>0 && app.mainView.isSocketInitialized && !app.mainView.userExpInfo.isSubmitting) {
        app.liveJoinView.disableJoinLiveNextButton(false, caller+'+'+'app.mainView.enableUI');
      } else {
        app.liveJoinView.disableJoinLiveNextButton(true, caller+'+'+'app.mainView.disableUI');
      }
    },
    //Update UI from Join Queue Sequence - should over ride bpu update
    updateJoinQueueSequence:function(msg) {
      //Live 
      app.liveJoinView.setJoinLiveNextButtonLabel('Live Join: '+'Submitting Exp(s) status: '+msg);
      app.liveJoinView.setJoinLiveNextLabel(new Date().toLocaleString()+': '+'Submitting Exp(s) status: '+msg);
    },
    //Update UI from bpu socket updates 
    updateBpuUpdate:function() {
      //Set live join button 
      app.liveJoinView.disableJoinLiveNextButton(false, 'app.mainView.server update');
    }, //end of update ui function

    //Init Displays and Socket
    initialize: function() {
      app.mainView=this;
      //Data
      app.mainView.session=new app.Session(JSON.parse(unescape($('#data-session').html())));
      app.mainView.user=new app.User(JSON.parse(unescape($('#data-user').html())));
      app.mainView.exps=JSON.parse(unescape($('#data-exps').html()));
      app.mainView.bpus=JSON.parse(unescape($('#data-bpus').html()));
      app.mainView.joinQueueDataObj=JSON.parse( unescape($('#data-joinQueueDataObj').html()));
      //Views 
      app.liveJoinView=new app.LiveJoinView();
      
      //Socket 
      var socketOptions={
        timeoutInterval:5000,
        connectionInfo:{
          username:app.mainView.user.get('username'), 
          userID:app.mainView.user.id, 
          sessionID:app.mainView.session.attributes.sessionID,
          socketID:null, socketHandle:null,
        },
      };
      app.userSocketClient.setConnection(socketOptions, function(err, joinQueueDataObj) {
        if(err) {
          app.mainView.isSocketInitialized=false;
          app.liveJoinView.setJoinLiveNextLabel(new Date().toLocaleString()+':Connection Error:'+err+'.  Refresh Browser.');
        } else {
          app.mainView.isSocketInitialized=true;
          
          if(joinQueueDataObj!==null && joinQueueDataObj!==undefined) app.mainView.joinQueueDataObj=joinQueueDataObj;
          //Initial Set Live Label
          app.liveJoinView.setJoinLiveNextLabel(new Date().toLocaleString()+': Connected.  '+app.mainView.bpus.length+' bpus available.  '+app.mainView.exps.length+' experiments.');
          app.mainView.enableUI('app.mainView.initialize');
          //Start Bpus Update Socket 
          //app.userSocketClient.startUpdateBpus();

        }
      });
    },
  });

  //Start
  $(document).ready(function() {
    app.mainView = new app.MainView();
  });
}());
