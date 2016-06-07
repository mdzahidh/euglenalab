/* global app:true */
(function() {
  'use strict';

  app = app || {};
  app.User = Backbone.Model.extend({
    idAttribute: '_id',
    url: '/account/joinlabwithdata/'
  });
  app.Session = Backbone.Model.extend({
    idAttribute: '_id',
    url: '/account/joinlabwithdata/'
  });
//user bpu experimentType tarFilename tarFileLocation startRunTime textExpFilename
  app.Record = Backbone.Model.extend({
    idAttribute: '_id',
    defaults: {
      _id: undefined,
      username: '',
      email: '',
      isActive: '',
      textExpFilename: '',
      mServerFileLocations: {
        myServerMediaLocation:'',
      },
    },
    urlDownload: function() {
      return '/account/joinlabwithdata/download/'+ (this.isNew() ? '' : this.id +'/');
    },
    url: function() {
      return '/account/joinlabwithdata/'+ (this.isNew() ? '' : this.id +'/');
    }
  });
  app.RecordCollection = Backbone.Collection.extend({
    model: app.Record,
    url: '/account/joinlabwithdata/',
    parse: function(results) {
      app.pagingView.model.set({
        pages: results.pages,
        items: results.items
      });
      app.filterView.model.set(results.filters);
      return results.data;
    }
  });

  app.Filter = Backbone.Model.extend({
    defaults: {
      username: '',
      roles: '',
      isActive: '',
      sort: '',
      limit: ''
    }
  });

  app.Paging = Backbone.Model.extend({
    defaults: {
      pages: {},
      items: {}
    }
  });
  app.ResultsView = Backbone.View.extend({
    el: '#results-table',
    template: _.template( $('#tmpl-results-table').html() ),
    initialize: function() {

      this.collection = new app.RecordCollection( app.mainView.results.data );
      this.listenTo(this.collection, 'reset', this.render);
      this.render();
    },
    render: function() {
      this.$el.html( this.template() );
      var frag = document.createDocumentFragment();
      this.collection.each(function(record) {
        var view = new app.ResultsRowView({ model: record });
        frag.appendChild(view.render().el);
      }, this);
      $('#results-rows').append(frag);

      if (this.collection.length === 0) {
        $('#results-rows').append( $('#tmpl-results-empty-row').html() );
      }
    }
  });

  app.ResultsRowView = Backbone.View.extend({
    tagName: 'tr',
    template: _.template( $('#tmpl-results-row').html() ),
    events: {
      'click .btn-details': 'viewDetails',
      'click .btn-download-tar': 'downloadTar',
    },
    downloadTar: function() {
      location.href = this.model.urlDownload();
    },
    viewDetails: function() {
      location.href = this.model.url();
    },
    render: function() {
      if(this.model.attributes.exp_submissionTime!==null) {
        var date=new Date(this.model.attributes.exp_submissionTime);
        this.model.attributes.exp_submissionTime=date.toString();
      }
      this.$el.html(this.template( this.model.attributes ));
      return this;
    }
  });

  app.FilterView = Backbone.View.extend({
    el: '#filters',
    template: _.template( $('#tmpl-filters').html() ),
    events: {
      'submit form': 'preventSubmit',
      'keypress input[type="text"]': 'filterOnEnter',
      'change select': 'filter'
    },
    initialize: function() {
      this.model = new app.Filter( app.mainView.results.filters );
      this.listenTo(this.model, 'change', this.render);
      this.render();
    },
    render: function() {
      this.$el.html(this.template( this.model.attributes ));
      for (var key in this.model.attributes) {
        if (this.model.attributes.hasOwnProperty(key)) {
          this.$el.find('[name="'+ key +'"]').val(this.model.attributes[key]);
        }
      }
    },
    preventSubmit: function(event) {
      event.preventDefault();
    },
    filterOnEnter: function(event) {
      if (event.keyCode !== 13) { return; }
      this.filter();
    },
    filter: function() {
      var query = $('#filters form').serialize();
      Backbone.history.navigate('q/'+ query, { trigger: true });
    }
  });

  app.PagingView = Backbone.View.extend({
    el: '#results-paging',
    template: _.template( $('#tmpl-results-paging').html() ),
    events: {
      'click .btn-page': 'goToPage'
    },
    initialize: function() {
      this.model = new app.Paging({ pages: app.mainView.results.pages, items: app.mainView.results.items });
      this.listenTo(this.model, 'change', this.render);
      this.render();
    },
    render: function() {
      if (this.model.get('pages').total > 1) {
        this.$el.html(this.template( this.model.attributes ));

        if (!this.model.get('pages').hasPrev) {
          this.$el.find('.btn-prev').attr('disabled', 'disabled');
        }

        if (!this.model.get('pages').hasNext) {
          this.$el.find('.btn-next').attr('disabled', 'disabled');
        }
      }
      else {
        this.$el.empty();
      }
    },
    goToPage: function(event) {
      var query = $('#filters form').serialize() +'&page='+ $(event.target).data('page');
      Backbone.history.navigate('q/'+ query, { trigger: true });
      $('body').scrollTop(0);
    }
  });

  app.Router = Backbone.Router.extend({
    routes: {
      '': 'default',
      'q/:params': 'query'
    },
    initialize: function() {
      app.mainView = new app.MainView();
    },
    default: function() {
      if (!app.firstLoad) {
        app.resultsView.collection.fetch({ reset: true });
      }

      app.firstLoad = false;
    },
    query: function(params) {
      app.resultsView.collection.fetch({ data: params, reset: true });
      app.firstLoad = false;
    }
  });

  app.MainView = Backbone.View.extend({
    el: '.page .container',

    didPassCanceling:false,
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
    //Experiment Info Object/hold loaded text files
    userExpInfo:{
      isSubmitting:false,
      MaxTextFileLoad:10,
      MaxTextTime:10*60*1000,
      loadedTextRunTime:0,
      loadedTextFiles:[],
      queueTextRunTime:0,
      queueTextFiles:0,
    },
    //Only Path to start join Queue Seq, called from one location in each, BpuImage, LiveJoin, TextSubmit
    submitExperimentFromViews:function(type, wantsBpuName) {
      //Disable UI
      app.mainView.disableUI('app.mainView.submitExperimentFromViews');
      console.log('1. submitExperimentFromViews', 'true?:'+app.userSocketClient.isInitialized, 'false?:'+app.mainView.userExpInfo.isSubmitting);
      if(app.userSocketClient.isInitialized && !app.mainView.userExpInfo.isSubmitting) {
        app.mainView.userExpInfo.isSubmitting=true;
        var joinQueueDataObjects=[];
        var isLive=false;
        var doSend=false;
        if(type==='live') {
          isLive=true;
          var joinQueueData=JSON.parse(JSON.stringify(app.mainView.joinQueueDataObj));
          joinQueueData.group_experimentType='live';
          joinQueueData.exp_metaData={};
          joinQueueData.exp_metaData.tag='live';
          joinQueueData.exp_metaData.description='no description set';
          joinQueueData.exp_metaData.expTypeString='isLive';
          //joinQueueData.exp_eventsToRun=fileObj.eventsToRun; fixed on server
          joinQueueDataObjects.push(joinQueueData);
          doSend=true;
        } else if(type==='text') {
          app.mainView.userExpInfo.loadedTextFiles.forEach(function(fileObj) {
            var joinQueueData=JSON.parse(JSON.stringify(app.mainView.joinQueueDataObj));
            joinQueueData.group_experimentType='text';
            joinQueueData.exp_eventsToRun=fileObj.eventsToRun;
            joinQueueData.exp_metaData=fileObj.metaData;
            joinQueueDataObjects.push(joinQueueData);
          });
          if(joinQueueDataObjects.length>0) doSend=true;
        }
        if(doSend) {
          //Add common data to all
          joinQueueDataObjects.forEach(function(obj) {
            obj.user.id=app.mainView.user.get('_id');
            obj.user.name=app.mainView.user.get('username');
            obj.user.groups=app.mainView.user.get('groups');

            obj.session.id=app.mainView.session.get('id');
            obj.session.sessionID=app.mainView.session.get('sessionID');
            obj.session.socketID=app.mainView.session.get('socketID');

            obj.exp_metaData.group_experimentType=obj.group_experimentType;
            obj.exp_wantsBpuName=wantsBpuName;

            obj.exp_metaData.clientCreationDate=new Date();
            obj.exp_metaData.userUrl=app.mainView.user.url;
          });
          //Start Sequence
          console.log('2. submitExperimentFromViews', 'submittingToSocketClient');
          app.userSocketClient.submitExperimentArray(joinQueueDataObjects, function(err, validationObjs) {
            console.log('3. submitExperimentFromViews', 'submittingToSocketClient replied');
            if(err) {
              console.log('4e1. submitExperimentFromViews', 'submittingToSocketClient replied with err:'+err);
              if(validationObjs && validationObjs.forEach) {
                var cnt=0;
                validationObjs.forEach(function(validationObj) {
                  cnt++;
                  var dCnt=0;
                  validationObj.errs.forEach(function(err) {
                    console.log('4e1a-'+cnt+', '+dCnt+'. submitExperimentFromViews err:', err);
                  });
                });
              }
              setTimeout(function() {
                console.log('5. reset. submitExperimentFromViews', 'app.mainView.userExpInfo.isSubmitting is now false again');
                app.mainView.userExpInfo.isSubmitting=false;
              }, 2500);
            } else {
              if(validationObjs && validationObjs.forEach) {
                console.log('4. submitExperimentFromViews', 'submittingToSocketClient replied with validationObjs:'+validationObjs.length);
                var cnt=0;
                validationObjs.forEach(function(validationObj) {
                  console.log(validationObj);
                  cnt++;
                  console.log('4-'+cnt+'. submitExperimentFromViews', validationObj.expInfo.exp_eventsRunTime, validationObj.expInfo.isValid);
                });
                setTimeout(function() {
                  console.log('5. reset. submitExperimentFromViews', 'app.mainView.userExpInfo.isSubmitting is now false again');
                  app.mainView.userExpInfo.isSubmitting=false;
                }, 2500);
              } else {
                console.log('4e2. submitExperimentFromViews', 'submittingToSocketClient replied with validationObjs:'+'dne');
                setTimeout(function() {
                  console.log('5. reset. submitExperimentFromViews', 'app.mainView.userExpInfo.isSubmitting is now false again');
                  app.mainView.userExpInfo.isSubmitting=false;
                }, 2500);
              }
            }
          });
        }
      }
    },

    //Disable All Buttons
    disableUI:function(caller) {
      app.liveJoinView.disableJoinLiveNextButton(true, caller+'+'+'app.mainView.disableUI');
      app.textSubmitView.disableSubmitTextNextButton(true, caller+'+'+'app.mainView.disableUI');
      app.bpuImageView.disableAll(true, caller+'+'+'app.mainView.disableUI');
    },

    //Update UI from Join Queue Sequence - should over ride bpu update
    updateJoinQueueSequence:function(msg) {
      //Live
      app.liveJoinView.setJoinLiveNextLabel(new Date().toLocaleString()+': '+'Submitting Exp(s) status: '+msg);
      //Text
      app.textSubmitView.setSubmitTextNextLabel('Text Submit: '+'Submitting Exp(s) status: '+msg);
    },
    //Update UI from bpu socket updates
    updateFromServer:function(updateObj) {
      app.mainView.setHeaderLabel('Updated:'+new Date());

      var queueTextRunTime=0;
      var queueTextFiles=0;
      //Update BpuView with updateObj.bpuPackage
      //Update BpuView with updateObj.bpuPackage
      //Update BpuView with updateObj.bpuPackage
      if(updateObj.bpusPackage && updateObj.bpusPackage.forEach && updateObj.bpusPackage.length>0) {
        updateObj.bpusPackage.forEach(function(bpuPack) {
          if(bpuPack.liveBpuExperiment) {
            //Title
            app.bpuImageView.setTitleLabel(bpuPack.index, bpuPack.name+', User:'+bpuPack.liveBpuExperiment.username);
            //User
            var secondsLeft=Math.round(bpuPack.liveBpuExperiment.bc_timeLeft/1000);
            app.bpuImageView.setUserLabel(bpuPack.index, 'Time Left:'+secondsLeft+' seconds');
            //Status
            app.bpuImageView.setStatusLabel(bpuPack.index, 'Status:'+bpuPack.bpuStatus);
          } else {
            //Title
            app.bpuImageView.setTitleLabel(bpuPack.index, bpuPack.name+', User:'+'None');
            //User
            app.bpuImageView.setUserLabel(bpuPack.index, 'Time Left:'+0+' seconds');
            //Status
            app.bpuImageView.setStatusLabel(bpuPack.index, 'Status:'+bpuPack.bpuStatus);
          }
        });
      } else {
        app.mainView.bpus.forEach(function(bpu) {
          //Title
          app.bpuImageView.setTitleLabel(bpu.index, 'eug'+bpu.index+', User:'+'None');
          //User
          app.bpuImageView.setUserLabel(bpu.index, 'Time Left:'+'0'+' seconds');
          //Status
          app.bpuImageView.setStatusLabel(bpu.index, 'Status:'+'Unknown');
        });
      }

      //Update Labels
      if(!app.mainView.userExpInfo.isSubmitting) {

        //Live Label
        var isLiveDisabled=false;
        var liveMsg='No live experiments in queue or any BPU.  Click To Join.';
        //Bpu Live
        if(updateObj.bpuLiveExp!==null && updateObj.bpuLiveExp!==undefined) {
          var bpuLiveSecondsWaitTime=Math.round(updateObj.bpuLiveFinishTime/1000);
          liveMsg='On BPU '+updateObj.bpuLiveExp.name+'.  ';
          if(bpuLiveSecondsWaitTime<0) {
            bpuLiveSecondsWaitTime=-1*bpuLiveSecondsWaitTime;
            liveMsg+='Processing for '+bpuLiveSecondsWaitTime+' seconds.';
          } else {
            liveMsg+='Wait time is '+bpuLiveSecondsWaitTime+' seconds.';
          }
          isLiveDisabled=true;

        //Queue Live
        } else if(updateObj.liveQueueExp!==null && updateObj.liveQueueExp!==undefined) {
          var liveSecondsWaitTime=Math.round(updateObj.liveQueueExp.exp_lastResort.totalWaitTime/1000);
          liveMsg='Waiting for bpu '+updateObj.liveQueueExp.exp_lastResort.bpuName+'.  ';
          liveMsg+='Wait time is '+liveSecondsWaitTime+' seconds.';
          isLiveDisabled=true;
        }
        //Set Live Message
        app.liveJoinView.setJoinLiveNextLabel(liveMsg);


        //Text Label
        var isTextDisabled=false;
        var textMsg='';
        var textWaitTime=0;
        //Bpu Text Total
        if(updateObj.bpuTextTotalExps>0) {
          textWaitTime=updateObj.bpuTextTotalRunTime;
          textMsg+=updateObj.bpuTextTotalExps+' exps on BPUs.  ';
        }
        //Queue Text
        if(updateObj.textTotalExps>0) {
          textWaitTime+=updateObj.textTotalRunTime;
          textMsg+=updateObj.textTotalExps+' exps in queue.  ';

        }
        if(textMsg==='') {
          textMsg='No text experiments in queue.  Click To Join.';
        } else {
          var textSecondsWaitTime=Math.round(textWaitTime/1000);
          textMsg+='Wait time is '+textSecondsWaitTime+' seconds.';
        }
        app.textSubmitView.setSubmitTextNextLabel(textMsg);

        //Save Queue Text
        app.mainView.userExpInfo.queueTextFiles=updateObj.bpuTextTotalExps+updateObj.textTotalExps;
        app.mainView.userExpInfo.queueTextRunTime=textWaitTime;
        //Check Text Disabled
        if(app.mainView.userExpInfo.queueTextFiles>=app.mainView.userExpInfo.MaxTextFileLoad)     isTextDisabled=true;
        else if(app.mainView.userExpInfo.queueTextRunTime>=app.mainView.userExpInfo.MaxTextTime) isTextDisabled=true;
        else if(app.mainView.userExpInfo.loadedTextFiles.length===0) isTextDisabled=true;

        //Enable/Disbaled Join
        //Set live join button
        if(app.mainView.bpus.length===0) {
          isLiveDisabled=false;
          isTextDisabled=false;
        }
        app.liveJoinView.disableJoinLiveNextButton(isLiveDisabled, 'app.mainView.server update');

        //Set text join button
        app.textSubmitView.disableSubmitTextNextButton(isTextDisabled, 'app.mainView.server update');

        //Set text/live join button for bpu view
        app.mainView.bpus.forEach(function(bpu) {
          app.bpuImageView.disableLiveButton(bpu.index, isLiveDisabled, 'app.mainView.server update');
          app.bpuImageView.disableTextButton(bpu.index, isTextDisabled, 'app.mainView.server update');
        });
      }
    }, //end of update ui function
    //Join Label Update
    setHeaderLabel:function(msg) {
      var elem=app.mainView.$el.find('[name="'+ 'headerLabel' +'"]')[0];
      if(elem) elem.innerHTML=msg;
    },
    //Init Displays and Socket
    initialize: function() {
      app.mainView = this;
      app.mainView.results = JSON.parse( $('#data-results').html() );
      app.mainView.user = new app.User( JSON.parse( unescape($('#data-user').html()) ) );
      app.mainView.session = new app.Session( JSON.parse( unescape($('#data-session').html()) ) );
      app.mainView.joinQueueDataObj = JSON.parse( unescape($('#data-joinQueueDataObj').html()) );

      app.mainView.bpus=JSON.parse( unescape($('#data-bpus').html()) );

      app.textSubmitView = new app.TextSubmitView();
      app.bpuImageView = new app.BpuImageView();
      app.liveJoinView = new app.LiveJoinView();
      app.resultsView = new app.ResultsView();
      app.filterView = new app.FilterView();
      app.pagingView = new app.PagingView();
      app.userSocketClient.setConnection(function(err) {
        if(err) {
          app.userSocketClient.isInitialized=false;
          app.liveJoinView.setJoinLiveNextLabel('Connection Error:'+err+'.  Refresh Browser.');
        } else {
          app.userSocketClient.isInitialized=true;
          app.mainView.setHeaderLabel('Connected. Wait for BPU Update.');
        }
      });
    },
  });
  //Start
  $(document).ready(function() {
    app.firstLoad = true;
    app.router = new app.Router();
    Backbone.history.start();
  });
}());
