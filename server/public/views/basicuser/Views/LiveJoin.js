/* global app:true */
(function() {
  'use strict';
  app=app || {};
  app.LiveJoinView = Backbone.View.extend({
    isWaitingToConfirmJoin:false,
    
    el: '#joinlive',
    template: _.template( $('#tmpl-joinlive').html() ),
    
    events: {
      'click .btn-joinLiveNext': 'btnClick_joinLiveNext',
    },
    //Join Button Action
    btnClick_joinLiveNext:function() {
      var wantsBpuName=null;
      app.mainView.submitExperimentFromViews('live', wantsBpuName);
    },
    //Join Button Enable/Disable 
    disablePrintOn:false, 
    disableJoinLiveNextButton:function(bVal, caller) {
      var me=this;
      if(me.disablePrintOn) console.log('disableJoinLiveNextButton', bVal, caller);
      var btn=me.$el.find('[name="'+ 'joinLiveNext' +'"]')[0];
      if(btn) btn.disabled=bVal;
    },
    //Join Button Label Update
    setJoinLiveNextButtonLabel:function(msg) {
      var elem=app.liveJoinView.$el.find('[name="'+ 'joinLiveNext' +'"]')[0];
      if(elem) elem.innerHTML=msg;
    },
    //Join Label Update
    setJoinLiveNextLabel:function(msg) {
      var elem=app.liveJoinView.$el.find('[name="'+ 'joinLiveNextLabel' +'"]')[0];
      if(elem) elem.innerHTML=msg;
    },

    //Default
    initialize: function() {
      this.model = new app.Record();
      this.listenTo(this.model, 'change', this.render);
      this.render();
    },
    render: function() {
      var me=this;
      me.$el.html(me.template( me.model.attributes ));
    },
  });
}());
