'use strict';
//Admin and Account Checks
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.set('X-Auth-Required', 'true');
    req.session.returnUrl = req.originalUrl;
    res.redirect('/login/');
  }
}
function ensureAdmin(req, res, next) {
  if (req.user.canPlayRoleOf('admin')) {
    return next();
  } else {
    res.redirect('/');
  }
}
function ensureAccount(req, res, next) {
  if (req.user.canPlayRoleOf('account')) {
    if (req.app.config.requireAccountVerification) {
      if (req.user.roles.account.isVerified !== 'yes' && !/^\/account\/verification\//.test(req.url)) {
        return res.redirect('/account/verification/');
      } else {
        checkGoLabz(req, res, next);
      }
    } else {
      checkGoLabz(req, res, next);
    }
  } else {
    res.redirect('/');
  }
}
//Should remove once done with golabz
function checkGoLabz(req, res, next) {
  var isGoLabz=false;
  var goLabzGroup='golabz';
  for(var ind=0;ind<req.user.groups.length;ind++) {
    if(req.user.groups[ind]===goLabzGroup) isGoLabz=true;
  }
  if(isGoLabz) {
    res.redirect('/basicuser');
  } else {
    return next();
  }
}

function accountOrFront(req,res,next) {
  if( req.isAuthenticated()) {
    res.redirect('/account');
  }
  else{
    require('./views/index').init(req,res,next)
  }
}

exports = module.exports = function(app, passport) {
  //front end
  //app.get('/', require('./views/index').init);
  app.get('/', accountOrFront);
  app.get('/about/', require('./views/about/index').init);
  app.get('/contact/', require('./views/contact/index').init);
  app.post('/contact/', require('./views/contact/index').sendMessage);

  //sign up
  app.get('/signup/', require('./views/signup/index').init);
  app.post('/signup/', require('./views/signup/index').signup);

  //social sign up
  app.post('/signup/social/', require('./views/signup/index').signupSocial);
  app.get('/signup/twitter/', passport.authenticate('twitter', { callbackURL: '/signup/twitter/callback/' }));
  app.get('/signup/twitter/callback/', require('./views/signup/index').signupTwitter);
  app.get('/signup/github/', passport.authenticate('github', { callbackURL: '/signup/github/callback/', scope: ['user:email'] }));
  app.get('/signup/github/callback/', require('./views/signup/index').signupGitHub);
  app.get('/signup/facebook/', passport.authenticate('facebook', { callbackURL: '/signup/facebook/callback/', scope: ['email'] }));
  app.get('/signup/facebook/callback/', require('./views/signup/index').signupFacebook);
  app.get('/signup/google/', passport.authenticate('google', { callbackURL: '/signup/google/callback/', scope: ['profile email'] }));
  app.get('/signup/google/callback/', require('./views/signup/index').signupGoogle);
  app.get('/signup/tumblr/', passport.authenticate('tumblr', { callbackURL: '/signup/tumblr/callback/' }));
  app.get('/signup/tumblr/callback/', require('./views/signup/index').signupTumblr);

  //login/out
  app.get('/login/', require('./views/login/index').init);
  app.post('/login/', require('./views/login/index').login);
  app.get('/login/forgot/', require('./views/login/forgot/index').init);
  app.post('/login/forgot/', require('./views/login/forgot/index').send);
  app.get('/login/reset/', require('./views/login/reset/index').init);
  app.get('/login/reset/:email/:token/', require('./views/login/reset/index').init);
  app.put('/login/reset/:email/:token/', require('./views/login/reset/index').set);
  app.get('/logout/', require('./views/logout/index').init);

  //social login
  app.get('/login/twitter/', passport.authenticate('twitter', { callbackURL: '/login/twitter/callback/' }));
  app.get('/login/twitter/callback/', require('./views/login/index').loginTwitter);
  app.get('/login/github/', passport.authenticate('github', { callbackURL: '/login/github/callback/' }));
  app.get('/login/github/callback/', require('./views/login/index').loginGitHub);
  app.get('/login/facebook/', passport.authenticate('facebook', { callbackURL: '/login/facebook/callback/' }));
  app.get('/login/facebook/callback/', require('./views/login/index').loginFacebook);
  app.get('/login/google/', passport.authenticate('google', { callbackURL: '/login/google/callback/', scope: ['profile email'] }));
  app.get('/login/google/callback/', require('./views/login/index').loginGoogle);
  app.get('/login/tumblr/', passport.authenticate('tumblr', { callbackURL: '/login/tumblr/callback/', scope: ['profile email'] }));
  app.get('/login/tumblr/callback/', require('./views/login/index').loginTumblr);


  //goLabz - join page
  app.get('/basicuser/', require('./views/basicuser/index').find);

  //goLabz - join page
  app.get('/basicuserlivelab/', require('./views/basicuserlivelab/index').init);

  //goLabz - join page
  //app.get('/goLabz/', require('./views/goLabz/index').init);

  //goLabz - join page
  //app.get('/golabzjoylab/', require('./views/golabzjoylab/index').init);


  //admin
  app.all('/admin*', ensureAuthenticated);
  app.all('/admin*', ensureAdmin);
  app.get('/admin/', require('./views/admin/index').init);

  //admin > users
  app.get('/admin/users/', require('./views/admin/users/index').find);
  app.post('/admin/users/', require('./views/admin/users/index').create);
  app.get('/admin/users/:id/', require('./views/admin/users/index').read);
  app.put('/admin/users/:id/', require('./views/admin/users/index').update);
  app.put('/admin/users/:id/password/', require('./views/admin/users/index').password);
  app.put('/admin/users/:id/role-admin/', require('./views/admin/users/index').linkAdmin);
  app.delete('/admin/users/:id/role-admin/', require('./views/admin/users/index').unlinkAdmin);
  app.put('/admin/users/:id/role-account/', require('./views/admin/users/index').linkAccount);
  app.delete('/admin/users/:id/role-account/', require('./views/admin/users/index').unlinkAccount);
  app.delete('/admin/users/:id/', require('./views/admin/users/index').delete);

  /*
  //admin > userdata
  app.get('/admin/userdata/', require('./views/admin/userdata/index').find);
  app.post('/admin/userdata/', require('./views/admin/userdata/index').create);
  app.get('/admin/userdata/:id/', require('./views/admin/userdata/index').read);
  app.put('/admin/userdata/:id/', require('./views/admin/userdata/index').update);
  app.put('/admin/userdata/:id/password/', require('./views/admin/userdata/index').password);
  app.put('/admin/userdata/:id/role-admin/', require('./views/admin/userdata/index').linkAdmin);
  app.delete('/admin/userdata/:id/role-admin/', require('./views/admin/userdata/index').unlinkAdmin);
  app.put('/admin/userdata/:id/role-account/', require('./views/admin/userdata/index').linkAccount);
  app.delete('/admin/userdata/:id/role-account/', require('./views/admin/userdata/index').unlinkAccount);
  app.delete('/admin/userdata/:id/', require('./views/admin/userdata/index').delete);
*/

  //admin > administrators
  app.get('/admin/administrators/', require('./views/admin/administrators/index').find);
  app.post('/admin/administrators/', require('./views/admin/administrators/index').create);
  app.get('/admin/administrators/:id/', require('./views/admin/administrators/index').read);
  app.put('/admin/administrators/:id/', require('./views/admin/administrators/index').update);
  app.put('/admin/administrators/:id/permissions/', require('./views/admin/administrators/index').permissions);
  app.put('/admin/administrators/:id/groups/', require('./views/admin/administrators/index').groups);
  app.put('/admin/administrators/:id/user/', require('./views/admin/administrators/index').linkUser);
  app.delete('/admin/administrators/:id/user/', require('./views/admin/administrators/index').unlinkUser);
  app.delete('/admin/administrators/:id/', require('./views/admin/administrators/index').delete);

  //admin > admin groups
  app.get('/admin/admin-groups/', require('./views/admin/admin-groups/index').find);
  app.post('/admin/admin-groups/', require('./views/admin/admin-groups/index').create);
  app.get('/admin/admin-groups/:id/', require('./views/admin/admin-groups/index').read);
  app.put('/admin/admin-groups/:id/', require('./views/admin/admin-groups/index').update);
  app.put('/admin/admin-groups/:id/permissions/', require('./views/admin/admin-groups/index').permissions);
  app.delete('/admin/admin-groups/:id/', require('./views/admin/admin-groups/index').delete);

  //admin > accounts
  app.get('/admin/accounts/', require('./views/admin/accounts/index').find);
  app.post('/admin/accounts/', require('./views/admin/accounts/index').create);
  app.get('/admin/accounts/:id/', require('./views/admin/accounts/index').read);
  app.put('/admin/accounts/:id/', require('./views/admin/accounts/index').update);
  app.put('/admin/accounts/:id/user/', require('./views/admin/accounts/index').linkUser);
  app.delete('/admin/accounts/:id/user/', require('./views/admin/accounts/index').unlinkUser);
  app.post('/admin/accounts/:id/notes/', require('./views/admin/accounts/index').newNote);
  app.post('/admin/accounts/:id/status/', require('./views/admin/accounts/index').newStatus);
  app.delete('/admin/accounts/:id/', require('./views/admin/accounts/index').delete);


  app.get('/admin/bpus/', require('./views/admin/bpus/index').find);
  app.post('/admin/bpus/', require('./views/admin/bpus/index').create);
  app.get('/admin/bpus/:id/', require('./views/admin/bpus/index').read);
  app.put('/admin/bpus/:id/', require('./views/admin/bpus/index').update);
  app.post('/admin/bpus/:id/notes/', require('./views/admin/bpus/index').newNote);
  app.post('/admin/bpus/:id/status/', require('./views/admin/bpus/index').newStatus);

  //admin > statuses
  app.get('/admin/statuses/', require('./views/admin/statuses/index').find);
  app.post('/admin/statuses/', require('./views/admin/statuses/index').create);
  app.get('/admin/statuses/:id/', require('./views/admin/statuses/index').read);
  app.put('/admin/statuses/:id/', require('./views/admin/statuses/index').update);
  app.delete('/admin/statuses/:id/', require('./views/admin/statuses/index').delete);

  //admin > categories
  app.get('/admin/categories/', require('./views/admin/categories/index').find);
  app.post('/admin/categories/', require('./views/admin/categories/index').create);
  app.get('/admin/categories/:id/', require('./views/admin/categories/index').read);
  app.put('/admin/categories/:id/', require('./views/admin/categories/index').update);
  app.delete('/admin/categories/:id/', require('./views/admin/categories/index').delete);

  //admin > search
  app.get('/admin/search/', require('./views/admin/search/index').find);

  //account
  app.all('/account*', ensureAuthenticated);
  app.all('/account*', ensureAccount);

  //reroute home page after sign in to joinlabwithdata
  app.get('/account/', require('./views/account/joinlabwithdata/index').find);

  //account > verification
  app.get('/account/verification/', require('./views/account/verification/index').init);
  app.post('/account/verification/', require('./views/account/verification/index').resendVerification);
  app.get('/account/verification/:token/', require('./views/account/verification/index').verify);

  //account > joinlabwithdata
  app.get('/account/joinlabwithdata/', require('./views/account/joinlabwithdata/index').find);
  app.post('/account/joinlabwithdata/', require('./views/account/joinlabwithdata/index').create);
  app.get('/account/joinlabwithdata/:id/', require('./views/account/joinlabwithdata/index').read);
  app.get('/account/joinlabwithdata/download/:id/', require('./views/account/joinlabwithdata/index').download);
  app.put('/account/joinlabwithdata/:id/', require('./views/account/joinlabwithdata/index').update);
  app.delete('/account/joinlabwithdata/:id/', require('./views/account/joinlabwithdata/index').delete);
  app.get('/account/joinlabwithdata/details/downloadtrack/:id/:trackId', require('./views/account/joinlabwithdata/index').downloadTrack);

  //livejoylab
  app.get('/account/livelab/', require('./views/account/livelab/index').init);

  //route not found
  app.all('*', require('./views/http/index').http404);
};
