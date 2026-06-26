const { findUserWithPassword, publicUser } = require('./store');

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

function requireRmOfficer(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'rm_officer') {
    return res.status(403).send('Risk Management Officer access only.');
  }
  return next();
}

function requireAuditOfficer(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'audit_officer') {
    return res.status(403).send('Audit Officer access only.');
  }
  return next();
}

function requireExecutive(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'executive') {
    return res.status(403).send('Executive access only.');
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
  const pub = publicUser(record);
  return {
    username: pub.username,
    role: pub.role,
    roleLabel: pub.roleLabel,
    displayName: pub.displayName,
    email: pub.email,
    department: pub.department,
    position: pub.position,
    employeeId: pub.employeeId,
    canManageUsers: pub.canManageUsers,
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
  requireRmOfficer,
  requireAuditOfficer,
  requireExecutive,
  requireRole,
  authenticate,
  sessionUser,
  refreshSessionUser,
};
