const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

function enforceSessionTimeout(req, res, next) {
  if (!req.session || !req.session.admin) {
    return next();
  }

  const now = Date.now();
  const lastActivity = req.session.lastActivityAt || now;

  if (now - lastActivity >= SESSION_TIMEOUT_MS) {
    return req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  }

  req.session.lastActivityAt = now;
  return next();
}

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

module.exports = { enforceSessionTimeout, requireAuth, attachAdmin };
