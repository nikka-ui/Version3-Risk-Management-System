const { escapeHtml } = require('../html');
const { appLayout } = require('./layout');
const { FONT_LINKS } = require('./head');

function loginPage({ error, next }) {
  const errorBlock = error
    ? `<div class="alert" role="alert">${escapeHtml(error)}</div>`
    : '';
  const nextField = next
    ? `<input type="hidden" name="next" value="${escapeHtml(next)}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in — RMS</title>
  ${FONT_LINKS}
  <link rel="stylesheet" href="/css/app.css">
</head>
<body>
  <div class="layout">
    <aside class="panel-brand">
      <div>
        <div class="brand-logo">RMS</div>
        <p class="brand-tagline">AI-Assisted Risk Management</p>
        <p class="brand-desc">ISO 31000-aligned workflow for identifying, assessing, and mitigating organizational risk.</p>
      </div>
    </aside>
    <main class="panel-form">
      <div class="form-wrap">
        <h1>Sign in</h1>
        <p class="form-sub">Use your assigned credentials to continue.</p>
        ${errorBlock}
        <form method="post" action="/login" autocomplete="on">
          ${nextField}
          <div class="field">
            <label for="username">Username</label>
            <input id="username" name="username" type="text" required autofocus
              autocapitalize="none" autocomplete="username" placeholder="e.g. personnel">
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required
              autocomplete="current-password" placeholder="Enter password">
          </div>
          <button type="submit" class="btn-primary">Sign in</button>
        </form>
        <p class="form-foot">Authorized personnel only. Activity is logged.</p>
      </div>
    </main>
  </div>
</body>
</html>`;
}

function dashboardPage(user) {
  const roleHints = {
    supervisor: 'Submit and track risk reports, upload evidence, and record accomplishments.',
    rm_officer: 'Review and validate risk reports, define mitigation plans, and close tickets.',
    audit_officer: 'Review solutions and action plans before implementation proceeds.',
    executive: 'Monitor risk levels and categories; comment on critical and high risks.',
    admin: 'Manage accounts, roles, and system logs.',
    employee: 'Access assigned risk workflows and departmental tasks.',
  };

  const hint = roleHints[user.role] || 'Welcome to the risk management system.';
  const adminLink =
    user.role === 'admin'
      ? `<p style="margin-top:1rem"><a href="/admin" class="btn-outline">Open administration</a></p>`
      : '';

  const body = `
    <div class="page-head">
      <h1>Welcome, ${escapeHtml(user.displayName)}</h1>
      <p class="page-desc">${escapeHtml(hint)}</p>
      <span class="role-badge">${escapeHtml(user.roleLabel)}</span>
      ${adminLink}
      <p class="text-muted" style="margin-top:1.5rem;font-size:0.8125rem">
        Risk ticket modules will appear here for your role in upcoming releases.
      </p>
    </div>`;

  return appLayout({
    title: 'Dashboard',
    user,
    activeNav: 'home',
    body,
  });
}

module.exports = { loginPage, dashboardPage };
