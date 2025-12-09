const passport = require('passport');

/**
 * Display login page
 */
const showLoginPage = (req, res) => {
  res.render('login', {
    title: 'Login - Super Stream',
    error: req.flash('error'),
  });
};

/**
 * Handle login POST request
 */
const login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      req.flash('error', info.message || 'Invalid username or password');
      return res.redirect('/login');
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }

      // Redirect to original URL or dashboard
      const returnTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      return res.redirect(returnTo);
    });
  })(req, res, next);
};

/**
 * Handle logout
 */
const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
};

module.exports = {
  showLoginPage,
  login,
  logout,
};
