/* global app:true */
(function() {
  'use strict';
  app=app || {};
  app.BpuImageView = Backbone.View.extend({

    el: '#bpuimage',
    template: _.template( $('#tmpl-bpuimage').html() ),

    events: {
      'click .btn-joinLiveBpu': 'btnClick_joinLiveBpu',
      'click .btn-submitTextBpu': 'btnClick_submitTextBpu'
    },
    //Join Button Action
    btnClick_joinLiveBpu:function(evt) {
      var wantsBpuName='eug'+evt.target.value;
      app.mainView.submitExperimentFromViews('live', wantsBpuName, function(err) {
        if(err) {
          console.log('btnClick_joinLiveBpu live submission err:'+err);
        } else {
          console.log('btnClick_joinLiveBpu live submission okay');
        }
      });
    },
    btnClick_submitTextBpu:function(evt) {
      var wantsBpuName='eug'+evt.target.value;
      app.mainView.submitExperimentFromViews('text', wantsBpuName, function(err) {
        if(err) {
          console.log('btnClick_joinLiveBpu text submission err:'+err);
        } else {
          console.log('btnClick_joinLiveBpu text submission okay');
        }
      });
    },
    //Join Button Enable/Disable
    disablePrintOn:false,
    disableAll:function(bVal, caller) {
      var me=this;
      if(me.disablePrintOn) console.log('disableAll', bVal, caller);
      app.mainView.bpus.forEach(function(bpu) {
        me.disableLiveButton(bpu.index, bVal, caller+'+'+'disableAll');
        me.disableTextButton(bpu.index, bVal, caller+'+'+'disableAll');
      });
    },
    disableLiveButton:function(index, bVal, caller) {
      var me=this;
      if(me.disablePrintOn) console.log('disableLiveButton', index,  bVal, caller);
      var btn=me.$el.find('[name="'+ 'bpuJoinLiveButton'+index +'"]')[0];
      if(btn) btn.disabled=bVal;
    },
    disableTextButton:function(index, bVal, caller) {
      var me=this;
      if(me.disablePrintOn) console.log('disableTextButton', index,  bVal, caller);
      var btn=me.$el.find('[name="'+ 'bpuSubmitTextButton'+index +'"]')[0];
      if(btn) btn.disabled=bVal;
    },

    //Labels
    setTitleLabel:function(index, msg) {
      var elem=app.bpuImageView.$el.find('[name="'+ 'BpuTitleLabel'+index +'"]')[0];
      if(elem) elem.innerHTML=msg;
    },
    setUserLabel:function(index, msg) {
      var elem=app.bpuImageView.$el.find('[name="'+ 'BpuUserLabel'+index +'"]')[0];
      if(elem) elem.innerHTML=msg;
    },
    setStatusLabel:function(index, msg) {
      var elem=app.bpuImageView.$el.find('[name="'+ 'BpuStatusLabel'+index +'"]')[0];
      if(elem) elem.innerHTML=msg;
    },


    initialize: function() {
      this.model = new app.Record();
      this.listenTo(this.model, 'change', this.render);
      this.render();
    },
    render: function() {
      var me=this;
      me.$el.html(me.template( me.model.attributes ));
    },
    updateOneBpuUI:function(bpuInfo, expInfo, isJoinLiveDisabled, isTextSubmitDisabled) {
      //Queue Info
      var timeToFinish = app.mainView.roundMsToMins(bpuInfo.timeToFinish);
      var titleLabel = bpuInfo.name;

      if(timeToFinish >= 0){
        titleLabel += ': Wait is '+timeToFinish+' minutes.';
      }
      else{
        titleLabel += 'Processing.. (hang on)';
      }

      app.bpuImageView.setTitleLabel(bpuInfo.index, titleLabel);
      var statusLabel='Status: '+bpuInfo.bpuStatus;
      app.bpuImageView.setStatusLabel(bpuInfo.index, titleLabel);
      //Live Button
      app.bpuImageView.disableLiveButton(bpuInfo.index, isJoinLiveDisabled);
      //On Bpu
      if(expInfo!==null) {
        var timeLeft = app.mainView.roundMsToSeconds(expInfo.timeLeft);
        var userLabel = expInfo.username;
        if(timeLeft >= 0){
            userLabel += ' has '+ timeLeft +' seconds left.';
        }
        else{
            userLabel += ' taking extra seconds.';
        }
        app.bpuImageView.setUserLabel(bpuInfo.index, userLabel);
      } else {
        app.bpuImageView.setUserLabel(bpuInfo.index, 'No User.');
      }
    },
  });
}());
