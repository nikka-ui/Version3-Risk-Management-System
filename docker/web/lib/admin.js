const {
  listUsers,
  listDepartments,
  getAuditLogs,
  getAuditLogsTodayCount,
  getRecentlyCreatedUsers,
  getDeletedTicketLogs,
  getNotifications,
  getCredentialLogs,
  appendAuditLog,
  appendNotification,
} = require('./store');
const { getRoleLabel } = require('../config/roles');
const { clientIp } = require('./logger');

function parseClientInfo(req) {
  const ua = String(req.headers['user-agent'] || '');
  let device = 'Desktop';
  let browser = 'Unknown';
  if (/mobile|android|iphone|ipad/i.test(ua)) device = 'Mobile';
  else if (/tablet/i.test(ua)) device = 'Tablet';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';
  return { device, browser, ua };
}

function logAdminAction(req, { action, module, description, targetUser } = {}) {
  const user = req.session?.user || {};
  const { device, browser } = parseClientInfo(req);
  appendAuditLog({
    username: user.username || '—',
    role: user.role || '—',
    roleLabel: user.roleLabel || getRoleLabel(user.role),
    action,
    module,
    description: description || '',
    targetUser: targetUser || null,
    ip: clientIp(req),
    device,
    browser,
  });
}

function notifyAdmin({ type, title, message }) {
  appendNotification({ type, title, message });
}

function getAdminDashboardStats(ticketStats) {
  const users = listUsers({ includeInactive: true });
  const activeUsers = users.filter((u) => u.active && u.status === 'active');
  const departments = listDepartments();
  return {
    totalUsers: users.length,
    activeUsers: activeUsers.length,
    departments: departments.length,
    openTickets: ticketStats?.open || 0,
    closedTickets: ticketStats?.closed || 0,
    highRiskTickets: ticketStats?.highRisk || 0,
    criticalRiskTickets: ticketStats?.criticalRisk || 0,
    auditLogsToday: getAuditLogsTodayCount(),
    todaysLogins: getCredentialLogs(500).filter((l) => {
      if (l.action !== 'login_success') return false;
      const today = new Date().toISOString().slice(0, 10);
      return String(l.at).slice(0, 10) === today;
    }).length,
  };
}

function getAdminDashboardData(ticketStats) {
  return {
    stats: getAdminDashboardStats(ticketStats),
    recentUsers: getRecentlyCreatedUsers(5),
    deletedTickets: getDeletedTicketLogs(5),
    auditLogs: getAuditLogs({ limit: 8 }),
    notifications: getNotifications(10),
  };
}

const AUDIT_ACTION_LABELS = {
  user_created: 'Created User',
  user_updated: 'Updated User',
  user_deleted: 'Deleted User',
  user_activated: 'Activated User',
  user_deactivated: 'Deactivated User',
  password_reset: 'Reset Password',
  department_created: 'Created Department',
  department_updated: 'Updated Department',
  department_deleted: 'Deleted Department',
  position_created: 'Created Position',
  position_updated: 'Updated Position',
  position_deleted: 'Deleted Position',
  ticket_deleted: 'Deleted Ticket',
  settings_updated: 'Updated Settings',
  system_init: 'System Init',
};

function auditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || action;
}

module.exports = {
  parseClientInfo,
  logAdminAction,
  notifyAdmin,
  getAdminDashboardStats,
  getAdminDashboardData,
  auditActionLabel,
};
