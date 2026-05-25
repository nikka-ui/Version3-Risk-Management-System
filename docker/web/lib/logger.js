const { appendCredentialLog, appendReportLog } = require('./store');

function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '—'
  );
}

function logCredential(req, { action, username, actor, detail, success = true }) {
  appendCredentialLog({
    action,
    username: username || '—',
    actor: actor || '—',
    detail: detail || '',
    success,
    ip: clientIp(req),
  });
}

function logReportActivity(entry) {
  appendReportLog(entry);
}

const ACTION_LABELS = {
  login_success: 'Sign in',
  login_failed: 'Failed sign in',
  logout: 'Sign out',
  account_created: 'Account created',
  role_changed: 'Role updated',
  account_deleted: 'Account deleted',
  system_init: 'System',
};

function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

module.exports = { logCredential, logReportActivity, actionLabel, clientIp };
