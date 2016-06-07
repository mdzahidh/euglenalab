/* global app:true */

(function() {
  'use strict';

  app = app || {};

  app.Login = Backbone.Model.extend({
    url: '/login/',
    defaults: {
      errors: [],
      errfor: {},
      username: '',
      password: '',
      autologin: ''
    }
  });

  app.LoginView = Backbone.View.extend({
    el: '#login',
    template: _.template( $('#tmpl-login').html() ),
    events: {
      'submit form': 'preventSubmit',
      'keypress [name="password"]': 'loginOnEnter',
      'click .btn-login': 'login'
    },
    isAttemptingAutoLogin:false,
    initialize: function() {
      var autologin=unescape($('#data-autologin').html());
      this.model = new app.Login();
      this.model.attributes.autologin=autologin;
      this.listenTo(this.model, 'sync', this.render);
      this.render();
    },
    render: function() {
      this.$el.html(this.template( this.model.attributes ));
      this.$el.find('[name="username"]').focus();
      if(this.model.attributes.autologin.length>0) {
        if(!this.isAttemptingAutoLogin) {
          this.isAttemptingAutoLogin=true;
          this.login();
        }
      }
    },
    preventSubmit: function(event) {
      event.preventDefault();
    },
    loginOnEnter: function(event) {
      if (event.keyCode !== 13) { return; }
      if ($(event.target).attr('name') !== 'password') { return; }
      event.preventDefault();
      this.login();
    },
    login: function() {
      this.$el.find('.btn-login').attr('disabled', true);

      if(this.model.attributes.autologin.length>0) {
        var autologin=this.model.attributes.autologin;
        var username=autologin.substr(0, 12);
        var password=autologin.substr(12, 23);
        this.model.save({
          username: username,
          password: password,
        },{
          success: function(model, response) {
            console.log('res sucess', response.success);
            if (response.success) {
              location.href = '/login/';
            }
            else {
              model.set(response);
            }
          }
        });
      } else {
        this.model.save({
          username: this.$el.find('[name="username"]').val(),
          password: this.$el.find('[name="password"]').val()
        },{
          success: function(model, response) {
            if (response.success) {
              location.href = '/login/';
            }
            else {
              model.set(response);
            }
          }
        });
      }
    }
  });

  $(document).ready(function() {
    app.loginView = new app.LoginView();
  });
}());
