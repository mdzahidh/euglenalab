/* global app:true */
(function() {
  'use strict';
  app=app || {};
  app.GraphView = Backbone.View.extend({
    el: '#graph-view',
    template: _.template( $('#tmpl-graph-view').html() ),
    events: {
      'click .btn-myRefreshData': 'myRefreshDataEvent',
    },
    disableButtons:function(bVal) {
      var btns=this.$el.find('[name="'+ 'myRefreshData' +'"]');
      Object.keys(btns).forEach(function(key) {
        if(btns[key].disabled!==null && btns[key].disabled!==undefined) btns[key].disabled=bVal;
      });
    },
    updateLabelsWithGraphRefresh:function(plotData) {
      var me=this;
      var labels=me.$el.find('[id="'+ 'graphTitle' +'"]');
      var cnt=-1;
      Object.keys(labels).forEach(function(key) {
        cnt++;
        if(labels[cnt] && labels[cnt].id) {
          var label=labels[cnt];
          var scriptType=null;
          var labelIndex=null;
          Object.keys(label.attributes).forEach(function(att) {
            if(label.attributes[att].name==='name') scriptType=label.attributes[att].value;
            else if(label.attributes[att].name==='value') labelIndex=label.attributes[att].value;
          });
          if(labelIndex!==null && scriptType!==null && scriptType===plotData.name) {
            if(labelIndex==='0') label.innerHTML=plotData.labels[0].str;
            else if(labelIndex==='1') label.innerHTML=plotData.labels[1].str;
            else if(labelIndex==='2') label.innerHTML=plotData.labels[2].str;
            else if(labelIndex==='3') label.innerHTML=plotData.labels[3].str;
          }
        }
      });
    },
    myRefreshDataEvent: function(evt) {
      var options={
        bpuName:app.mainView.socketOptions.bpuName,
        scriptType:evt.target.value,
        filter:{count:1, type:'all'},
      };
      this.refreshData(options);
    },
    refreshData: function(options, cb_fn) {
      var me=this;
      var radios=this.$el.find('[type="'+ 'radio' +'"]');
      var cnt=-1;
      for(var i=0;i<Object.keys(radios).length;i++) {
        cnt++;
        var btn=radios[cnt];
        if(btn && btn.name===options.scriptType) {
          if(btn.checked) {
            options.filter.type=btn.id.toLowerCase();
            break;
          }
        }
      }
      app.socketClient.refreshGraphData(options, function(err, refreshGraphData) {
        var errStr=null;
        if(err) {
          errStr='admin/bpus/'+app.mainView.socketOptions.bpuName+' app.socketClient.refreshGraph:'+err;
          console.log(errStr);
          if(cb_fn) cb_fn(errStr, null);
        } else if(refreshGraphData.err) {
          errStr='admin/bpus/'+app.mainView.socketOptions.bpuName+' app.socketClient.refreshGraphData.err:'+refreshGraphData.err;
          console.log(errStr);
          if(cb_fn) cb_fn(errStr, null);
        } else {
          //Update Labels
          me.updateLabelsWithGraphRefresh(refreshGraphData.graphUpdate);
          //Get image and refresh source
          var things=app.graphView.$el.find('[name="'+ refreshGraphData.scriptType +'"]');
          Object.keys(things).forEach(function(key) {
            if(things[key].localName==='img') {
              things[key].src=refreshGraphData.graphUpdate.src+'?'+new Date().getTime();
            }
          });
        }
        if(cb_fn) cb_fn(null, null);
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
