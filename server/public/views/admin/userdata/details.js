/* global app:true */

(function() {
  'use strict';

  app = app || {};

  app.User = Backbone.Model.extend({
    idAttribute: '_id',
    url: function() {
      return '/admin/userdata/'+ this.id +'/';
    }
  });

  app.ActiveExperiment= Backbone.Model.extend({
    idAttribute: '_id',
    url: function() {
      return '/admin/userdata/'+ this.id +'/';
    }
  });

  app.UserInfo = Backbone.Model.extend({
    idAttribute: '_id',
    defaults: {
      success: false,
      errors: [],
      errfor: {},
      isActive: '',
      username: '',
      email: ''
    },
    url: function() {
      return '/admin/userdata/'+ app.mainView.model.id +'/';
    },
    parse: function(response) {
      if (response.user) {
        app.mainView.model.set(response.user);
        delete response.user;
      }
      return response;
    }
  }); 
  
  app.Experiment = Backbone.Model.extend({
    idAttribute: '_id',
    defaults: {
      success: false,
      errors: [],
      errfor: {},
      isActive: '',
      username: '',
      email: ''
    },
    url: function() {
      return '/admin/userdata/'+ app.mainView.model.id +'/';
    },
    parse: function(response) {
      if (response.user) {
        app.mainView.model.set(response.user);
        delete response.user;
      }
      return response;
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
    }
  });
  
  app.UserInfoView = Backbone.View.extend({
    el: '#userinfo',
    template: _.template( $('#tmpl-userinfo').html() ),
    events: {
    },
    initialize: function() {
      console.log('UserInfoView initialize');
      this.model = new app.UserInfo();
      this.syncUp();
      this.listenTo(app.mainView.model, 'change', this.syncUp);
      this.listenTo(this.model, 'sync', this.render);
      this.render();
    },
    syncUp: function() {
      console.log('UserInfoView syncUp');
      this.model.set({
        _id: app.mainView.model.id,
        username: app.mainView.model.get('username'),
        groupId: app.mainView.model.get('group').id,
        groupName: app.mainView.model.get('group').name,
        experiments: app.mainView.model.get('experiments'),
      });
    },
    render: function() {
      console.log('UserInfoView render');
      this.$el.html(this.template( this.model.attributes ));

      for (var key in this.model.attributes) {
        if (this.model.attributes.hasOwnProperty(key)) {
          if(key==='experiments') {
            var dropdown=this.$el.find('[name="'+ key +'"]')[0];
            var data=this.model.attributes[key];
            this.refreshDropdown(dropdown, data);
            dropdown.value=data[0];
            dropdown.onchange=function(e) {
              var newExpId=e.target.value+'';
              var newExp=null;
              app.mainView.experiments.forEach(function(item) {
                if(item._id===newExpId) {newExp=item}
              });
              if(newExp!==null) {
                app.experimentView.model.set(newExp);
                app.experimentView.render();
              }
            }
          } else {
            this.$el.find('[name="'+ key +'"]').val(this.model.attributes[key]);
          }
        }
      }
    },
    //Mine
    refreshDropdown:function(dropdown, data) {
      //Remove previous options
      var optionsCount=dropdown.options.length;
      for(var i=0;i<optionsCount;i++) {dropdown.remove(dropdown.options[0]);}
      //Add options 
      for(var i=0;i<data.length;i++) {
        var opt=document.createElement('OPTION');
        dropdown.options.add(opt);
        opt.name=data[i];
        opt.innerHTML=opt.name;
        opt.value=opt.name;
      }

    },
  });
  
  app.ExperimentView = Backbone.View.extend({
    el: '#experiment',
    template: _.template( $('#tmpl-experiment').html() ),
    events: {
    },
    initialize: function() {
      console.log('ExperimentView initialize');
      this.model = app.mainView.activeExperiment;
      this.syncUp();
      this.listenTo(app.mainView.activeExperiment, 'change', this.syncUp);
      this.listenTo(this.model, 'sync', this.render);
      this.render();
    },
    syncUp: function() {
      console.log('ExperimentView syncUp');
      var activeExp=app.mainView.activeExperiment;
      this.model.set({
        _id: activeExp.attributes._id,
        endRunDate:activeExp.attributes.endRunDate,
        bpuName:activeExp.attributes.bpuName,
        pop1:activeExp.attributes.pop1,
        dataFileName:activeExp.attributes.dataFileName,
        dataPath:activeExp.attributes.dataPath,
        msg:activeExp.attributes.msg,
        
        id_bp: activeExp.attributes.bpuData.id,
        username_bp: activeExp.attributes.bpuData.username,
        isLive_bp: activeExp.attributes.bpuData.isLive,
        isAuto_bp: activeExp.attributes.bpuData.isAuto,
        autoType_bp: activeExp.attributes.bpuData.autoType,
        useBpu_bp: activeExp.attributes.bpuData.useBpu,
        runTime_bp: activeExp.attributes.bpuData.runTime,
        data_bp: activeExp.attributes.bpuData.data,
        runTime_bp: activeExp.attributes.bpuData.runTime,
        startTime_bp: activeExp.attributes.bpuData.startTime,
        eventsToRun_bp: activeExp.attributes.bpuData.eventsToRun,
        eventsRan_bp: activeExp.attributes.bpuData.eventsRan,
      });
    },
    render: function() {
      console.log('ExperimentView render');
      this.$el.html(this.template( this.model.attributes ));

      for (var key in this.model.attributes) {
        if (this.model.attributes.hasOwnProperty(key)) {
          if(key==='eventsToRun_bp' || key==='eventsRan_bp') {
            var dropdown=this.$el.find('[name="'+ key +'"]')[0];
            var data=this.model.attributes[key];
            if(data===undefined || data.length===0) {data=['no data'];}
            this.refreshDropdown(dropdown, data);
            dropdown.value=data[0];
            dropdown.onchange=function(e) {}
          } else {
            var data=this.model.attributes[key];
            if(data===undefined || data===null) {data='no data';}
            this.$el.find('[name="'+ key +'"]').val(data);
          }
        }
      }
    },
    //Mine
    refreshDropdown:function(dropdown, data) {
      //Remove previous options
      var optionsCount=dropdown.options.length;
      for(var i=0;i<optionsCount;i++) {dropdown.remove(dropdown.options[0]);}
      //Add options 
      for(var i=0;i<data.length;i++) {
        var opt=document.createElement('OPTION');
        dropdown.options.add(opt);
        opt.name=data[i];
        opt.innerHTML=opt.name;
        opt.value=opt.name;
      }
    },
  });
  
  app.MainView = Backbone.View.extend({
    el: '.page .container',
    initialize: function() {
      app.mainView = this;
      this.model = new app.User( JSON.parse( unescape($('#data-record').html())) );
      
      this.experiments = JSON.parse( unescape($('#data-experiments').html()));
      this.activeExperiment= new app.Experiment(this.experiments[0]);

      app.headerView = new app.HeaderView();
      app.userInfoView = new app.UserInfoView();
      app.experimentView = new app.ExperimentView();
    }
  });

  $(document).ready(function() {
    app.mainView = new app.MainView();
  });
}());
