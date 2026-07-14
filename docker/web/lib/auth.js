const { findUserRecord, publicUser } = require('./store');

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
    return res.status(403).send('Ticket Reporter access only.');
  }
  return next();
}

function requireDeptHead(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'dept_head') {
    return res.status(403).send('Department Head / Vice President access only.');
  }
  return next();
}

function requireRmOfficer(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'rm_officer') {
    return res.status(403).send('Risk Governance Office (RMU) access only.');
  }
  return next();
}

function requireExecutive(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'executive') {
    return res.status(403).send('Executive Committee access only.');
  }
  return next();
}

function requirePresident(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'president') {
    return res.status(403).send('President access only.');
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
  const record = findUserRecord(username);
  if (!record) {
    return { error: 'invalid_username' };
  }
  if (record.password !== password) {
    return { error: 'invalid_password' };
  }
  return { user: sessionUser(record) };
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
  requireDeptHead,
  requireRmOfficer,
  requireExecutive,
  requirePresident,
  requireRole,
  authenticate,
  sessionUser,
  refreshSessionUser,
};
