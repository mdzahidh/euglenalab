/* global app:true */
(function() {
  'use strict';
  app=app || {};
  app.LiveView = Backbone.View.extend({
    socketData:null,
    el: '#live-view',
    template: _.template( $('#tmpl-live-view').html() ),
    events: {
      'click .btn-myFlush10': 'myFlush10',
      'click .btn-myFlush30': 'myFlush30',
      'click .btn-myFlush120': 'myFlush120',
    },
    mySocket:null,
    bpuButtons:['myFlush10', 'myFlush30', 'myFlush120'],
    disableButtons:function(bVal) {
      var me=this;
      var btns=me.$el.find('[type="'+ 'button' +'"]');
      Object.keys(btns).forEach(function(key) {
        me.bpuButtons.forEach(function(btnName) {
          if(btnName===btns[key].name) {
            btns[key].disabled=bVal;
          }
        });
      });
    },
    myFlush10: function() {this.flush(10000);},
    myFlush30: function() {this.flush(30000);},
    myFlush120: function() {this.flush(120000);},
    flush: function(msec) {
      this.disableButtons(true);
      var options={
        id:app.mainView.socketOptions.id,
        bpuName:app.mainView.socketOptions.bpuName,
        index:app.mainView.socketOptions.bpuIndex,
        localAddr:app.mainView.socketOptions.localAddr,
        flushTime:msec,
      };
      app.socketClient.flushBpu(options, function(err, data) {
      });
    },
    initialize: function() {
      this.model = new app.Note();
      this.listenTo(this.model, 'change', this.render);
      this.render();
    },
    render: function() {
      this.$el.html( this.template(this.model.attributes) );
    },
  });
}());
