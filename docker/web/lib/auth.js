const { findUserWithPassword, publicUser } = require('./store');
const { getRoleLabel } = require('../config/roles');

function requireAuth(req, res, next) {
  if (req.session?.user) {
    return next();
  }
  const nextUrl = encodeURIComponent(req.originalUrl || '/dashboard');
  return res.redirect(`/login?next=${nextUrl}`);
}

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).send('Administrator access only.');
  }
  return next();
}

function requireSupervisor(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'supervisor') {
    return res.status(403).send('Department Supervisor access only.');
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.redirect('/login');
    }
    if (roles.includes(req.session.user.role)) {
      return next();
    }
    return res.status(403).send('Access denied for your role.');
  };
}

function authenticate(username, password) {
  const record = findUserWithPassword(username, password);
  if (!record) {
    return null;
  }
  return sessionUser(record);
}

function sessionUser(record) {
  return {
    username: record.username,
    role: record.role,
    roleLabel: record.roleLabel || getRoleLabel(record.role),
    displayName: record.displayName,
    canManageUsers: Boolean(record.canManageUsers),
  };
}

function refreshSessionUser(req, username) {
  const { findUserRecord } = require('./store');
  const record = findUserRecord(username);
  if (record && req.session) {
    req.session.user = sessionUser(record);
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireSupervisor,
  requireRole,
  authenticate,
  sessionUser,
  refreshSessionUser,
};
