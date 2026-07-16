const { findUserRecord, publicUser } = require('./store');
const { roleDashboardPath } = require('../config/roles');

const ROLE_TICKET_PATH = {
  supervisor: '/supervisor/tickets',
  dept_head: '/dept/tickets',
  rm_officer: '/officer/tickets',
  executive: '/executive/tickets',
  president: '/president/tickets',
};

/**
 * If an authenticated user hits another role's ticket detail URL (common with
 * legacy notification links), send them to the same ticket in their own console.
 */
function redirectToOwnTicketConsole(req, res, expectedRole) {
  const user = req.session?.user;
  if (!user || user.role === expectedRole) return false;
  if (req.method !== 'GET') return false;

  const match = String(req.path || '').match(/\/tickets\/([^/]+)\/?$/);
  if (!match) return false;

  const ref = match[1];
  if (!ref || ref === 'new') return false;

  const base = ROLE_TICKET_PATH[user.role];
  if (base) {
    res.redirect(`${base}/${encodeURIComponent(ref)}`);
    return true;
  }

  res.redirect(roleDashboardPath(user.role));
  return true;
}

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
    if (redirectToOwnTicketConsole(req, res, 'supervisor')) return undefined;
    return res.status(403).send('Ticket Reporter access only.');
  }
  return next();
}

function requireDeptHead(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'dept_head') {
    if (redirectToOwnTicketConsole(req, res, 'dept_head')) return undefined;
    return res.status(403).send('Department Head / Vice President access only.');
  }
  return next();
}

function requireRmOfficer(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'rm_officer') {
    if (redirectToOwnTicketConsole(req, res, 'rm_officer')) return undefined;
    return res.status(403).send('Risk Governance Office (RMU) access only.');
  }
  return next();
}

function requireExecutive(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'executive') {
    if (redirectToOwnTicketConsole(req, res, 'executive')) return undefined;
    return res.status(403).send('Executive Committee access only.');
  }
  return next();
}

function requirePresident(req, res, next) {
  if (!req.session?.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'president') {
    if (redirectToOwnTicketConsole(req, res, 'president')) return undefined;
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
