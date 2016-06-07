/* global app:true */
var doPrint=true;
var myPrint=function(msg) {if(doPrint) console.log('(public'+'/admin/bpus/details.js)'+'\t'+msg);};
(function() {
  'use strict';
  app = app || {};
  app.Bpu = Backbone.Model.extend({
    idAttribute: '_id',
    url: function() {
      return '/admin/bpus/'+ this.id +'/';
    }
  });
  app.Delete = Backbone.Model.extend({
    idAttribute: '_id',
    defaults: {
      success: false,
      errors: [],
      errfor: {}
    },
    url: function() {
      return '/admin/bpus/'+ app.mainView.model.id +'/';
    }
  });
  app.Details = Backbone.Model.extend({
    idAttribute: '_id',
    defaults: {
      success: false,
      errors: [],
      errfor: {},
      name:'', index:-1, isOn:false, 
      allowedGroups:[],
      localAddr:{
        ip:'', serverPort:'', webcamPort:'',
      },
      publicAddr:{
        ip:'', serverPort:'', webcamPort:'',
      },
      currentStatus:{},
      magnification:'',
      notes:[],
    },
    url: function() {
      return '/admin/bpus/'+ app.mainView.model.id +'/';
    },
    parse: function(response) {
      if (response.account) {
        app.mainView.model.set(response.account);
        delete response.account;
      }

      return response;
    }
  });
  app.Note = Backbone.Model.extend({
    idAttribute: '_id',
    defaults: {
      success: false,
      errors: [],
      data: '',
      userCreated: {}
    },
    url: function() {
      return '/admin/bpus/'+ app.mainView.model.id +'/notes/'+ (this.isNew() ? '' : this.id +'/');
    },
    parse: function(response) {
      if (response.account) {
        app.mainView.model.set(response.account);
        delete response.account;
      }
      return response;
    }
  });
  app.NoteCollection = Backbone.Collection.extend({
    model: app.Note
  });
  app.DetailsView = Backbone.View.extend({
    el: '#details',
    template: _.template( $('#tmpl-details').html() ),
    events: {
    },
    initialize: function() {
      this.model = new app.Details();
      this.syncUp();
      this.listenTo(app.mainView.model, 'change', this.syncUp);
      this.listenTo(this.model, 'sync', this.render);
      this.render();
    },
    syncUp: function() {
      this.model.set({
        _id: app.mainView.model.id,
        name: app.mainView.model.get('name'),
        index: app.mainView.model.get('index'),
        isOn: app.mainView.model.get('isOn'),
        magnification: app.mainView.model.get('magnification'),
        allowedGroups: app.mainView.model.get('allowedGroups'),
        currentStatus: app.mainView.model.get('currentStatus'),
        notes: app.mainView.model.get('notes'),
        localAddr: app.mainView.model.get('localAddr'),
        publicAddr: app.mainView.model.get('publicAddr'),
      });
    },
    render: function() {
      this.$el.html(this.template( this.model.attributes ));
      for (var key in this.model.attributes) {
        if (this.model.attributes.hasOwnProperty(key)) {
          this.$el.find('[name="'+ key +'"]').val(this.model.attributes[key]);
        }
      }
    },
  });
  app.NewNoteView = Backbone.View.extend({
    el: '#notes-new',
    template: _.template( $('#tmpl-notes-new').html() ),
    events: {
      'click .btn-add': 'addNew'
    },
    initialize: function() {
      this.model = new app.Note();
      this.listenTo(this.model, 'change', this.render);
      this.render();
    },
    render: function() {
      this.$el.html( this.template(this.model.attributes) );
    },
    validates: function() {
      var errors = [];
      if (this.$el.find('[name="data"]').val() === '') {
        errors.push('Please enter some notes.');
      }

      if (errors.length > 0) {
        this.model.set({ errors: errors });
        return false;
      }

      return true;
    },
    addNew: function() {
      if (this.validates()) {
        this.model.save({
          data: this.$el.find('[name="data"]').val()
        });
      }
    }
  });
  app.NoteCollectionView = Backbone.View.extend({
    el: '#notes-collection',
    template: _.template( $('#tmpl-notes-collection').html() ),
    initialize: function() {
      this.collection = new app.NoteCollection();
      this.syncUp();
      this.listenTo(app.mainView.model, 'change', this.syncUp);
      this.listenTo(this.collection, 'reset', this.render);
      this.render();
    },
    syncUp: function() {
      this.collection.reset(app.mainView.model.get('notes'));
    },
    render: function() {
      this.$el.html(this.template());
      var frag = document.createDocumentFragment();
      var last = document.createTextNode('');
      frag.appendChild(last);
      this.collection.each(function(model) {
        var noteDate=new Date(model.attributes.userCreated.time);
        model.attributes.userCreated.time=noteDate.toLocaleString();
        var view = new app.NotesItemView({ model: model });
        var newEl = view.render().el;
        frag.insertBefore(newEl, last);
        last = newEl;
      }, this);
      $('#notes-items').append(frag);

      if (this.collection.length === 0) {
        $('#notes-items').append( $('#tmpl-notes-none').html() );
      }
    }
  });
  app.NotesItemView = Backbone.View.extend({
    tagName: 'div',
    className: 'note',
    template: _.template( $('#tmpl-notes-item').html() ),
    render: function() {
      this.$el.html( this.template(this.model.attributes) );

      this.$el.find('.timeago').each(function(index, indexValue) {
        if (indexValue.innerText) {
          var myMoment = moment(indexValue.innerText);
          indexValue.innerText = myMoment.from();
        }
      });
      return this;
    }
  });
  app.HeaderView = Backbone.View.extend({
    el: '#header',
    template: _.template( $('#tmpl-header').html() ),
    initialize: function() {
      this.model = app.mainView.model;
      this.listenTo(this.model, 'change', this.render);
      this.render();
    },
    render: function() {
      this.$el.html(this.template( this.model.attributes ));
    },
    setDateLabel:function() {
      var elem=this.$el.find('[name="'+ 'dateLabel' +'"]')[0];
      if(elem) elem.innerHTML='Last Update: '+new Date().toLocaleString();
    },
    setStatusLabel:function(msg) {
      var elem=this.$el.find('[name="'+ 'statusLabel' +'"]')[0];
      if(elem) elem.innerHTML='Status: '+msg;
    },
    setErrorLabel:function(msg) {
      var elem=this.$el.find('[name="'+ 'errorLabel' +'"]')[0];
      if(elem) elem.innerHTML='Error: '+msg;
    },
  });
  app.MainView = Backbone.View.extend({
    el: '.page .container',
    isSocketConnected:false,
    updateBpusCallback:function(updateObj) {
      //Date
      app.headerView.setDateLabel();
        //Error
      if(updateObj.err!==null && updateObj.err!==undefined) app.headerView.setErrorLabel(updateObj.err);
      else app.headerView.setErrorLabel('None');
        //Header Labels 
      app.headerView.setStatusLabel(''+
          'bpuStatus='+updateObj.bpuStatus+', '+
          'username='+updateObj.username+', '+
          'runTime='+updateObj.timeLeft+', '+
          'timeLeft='+updateObj.timeLeft+', '+
          'processingTime='+updateObj.processingTimePerExperiment+'');
      //Shut Down UI if in use
      if(updateObj.bpuStatus===null || updateObj.bpuStatus===undefined) {
        app.liveView.disableButtons(true);
      } else if(updateObj.bpuStatus==='bpuNull') {
        app.liveView.disableButtons(false);
      } else {
        app.liveView.disableButtons(true);
      }

    },
    initialUpdate:function(updateObj, plotData) {
      app.mainView.isSocketConnected=updateObj.didPass;
      app.headerView.setDateLabel();
      if(updateObj.err!==null) app.headerView.setErrorLabel(updateObj.err);
      if(!updateObj.didPass) {
        //Buttons
        app.liveView.disableButtons(true);
        app.graphView.disableButtons(true);
        //Labels
        app.headerView.setStatusLabel('Did Not Pass('+
            'didFindBpu='+updateObj.didFindBpu+', '+
            'didFindBpuSocket='+updateObj.didFindBpuSocket+', '+
            'didGetBpuStatus='+updateObj.didFindBpuSocket+')');
      } else {
        //Buttons 
        var bpuStatus=updateObj.bpuStatus.bpuStatus;
        if(bpuStatus==='bpuNull') app.liveView.disableButtons(false);
        else app.liveView.disableButtons(true);
        app.graphView.disableButtons(false);
        //Labels 
        app.headerView.setStatusLabel(''+
            'bpuStatus='+bpuStatus+', '+
            'username='+updateObj.bpuStatus.username+', '+
            'runTime='+updateObj.bpuStatus.timeLeft+', '+
            'timeLeft='+updateObj.bpuStatus.timeLeft+', '+
            'processingTime='+updateObj.bpuStatus.processingTimePerExperiment+'');
      }
      //Update Graph Labels
      plotData.forEach(function(graphPlotData) {
        app.graphView.updateLabelsWithGraphRefresh(graphPlotData);
      });
    },
    initialize: function() {
      app.mainView = this;
      app.mainView.model = new app.Bpu( JSON.parse( unescape($('#data-record').html()) ) );
      app.headerView = new app.HeaderView();
      app.detailsView = new app.DetailsView();
      app.newNoteView = new app.NewNoteView();
      app.notesCollectionView = new app.NoteCollectionView();
      app.liveView = new app.LiveView();
      app.graphView = new app.GraphView();
    
      //Socket 
      app.mainView.isSocketConnected=false;
      app.mainView.socketOptions={
          id:app.mainView.model.id,
          bpuName:app.mainView.model.get('name'),
          bpuIndex:app.mainView.model.get('index'),
          localAddr:app.mainView.model.get('localAddr'),
          timeoutInterval:10000,
      };
      app.socketClient.setConnection(app.mainView.socketOptions, function(err, bpuUpdate) {
        //Check if graph data exists and attempt to make it from the hardcoded known scipter array
        var HardCodedKnownScripters=['activity', 'population', 'response'];
        if(app.mainView.model.get('avgStatsData').length<HardCodedKnownScripters.length) {
          var refreshDatas=[];
          var next=function() {
            if(HardCodedKnownScripters.length>0) {
              var type=HardCodedKnownScripters.shift();
              var options={
                bpuName:app.mainView.socketOptions.bpuName,
                scriptType:type,
                filter:{count:1, type:'all'},
              };  
              app.graphView.refreshData(options, function(err, dat) {
                if(err) {
                  myPrint('Init Error app.graphView.refreshData err:'+err);
                }
                next();
              });
            } else {
              app.mainView.initialUpdate(bpuUpdate, app.mainView.model.get('plotData'));
              app.socketClient.startUpdateBpus(app.mainView.updateBpusCallback);
            }
          };
          next();
        } else {
          app.mainView.initialUpdate(bpuUpdate, app.mainView.model.get('plotData'));
          app.socketClient.startUpdateBpus(app.mainView.updateBpusCallback);
        }
      });
    }
  });
  $(document).ready(function() {
    app.mainView = new app.MainView();

  });
}());
