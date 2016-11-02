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

exports = module.exports = function (app, passport) {
    app.post('/api/auth/register/', require('./views/api/index').register);
    app.post('/api/auth/login/', require('./views/api/index').login);
    app.get('/api/bio-units/', passport.authenticate('jwt', {session: false}), require('./views/api/index').get_bio_units);
    // app.post('/api/experiment/', passport.authenticate('jwt', {session: false}), require('./views/api/index').create_experiment);
    app.get('/api/experiment/:id/status/', passport.authenticate('jwt', {session: false}), require('./views/api/index').get_experiment_status);
    app.get('/api/experiment/:id/', passport.authenticate('jwt', {session: false}), require('./views/api/index').get_experiment_detail);
};
