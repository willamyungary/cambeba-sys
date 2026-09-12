function requireAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/login');
}

function attachAdmin(req, res, next) {
  res.locals.admin = (req.session && req.session.admin) || null;
  next();
}

module.exports = { requireAuth, attachAdmin };
