const { escapeHtml } = require('../html');
const { appLayout } = require('./layout');
const { FONT_LINKS, STYLESHEET_LINK } = require('./head');

function loginPage({ error, next }) {
  const errorBlock = error
    ? `<div class="alert" role="alert">${escapeHtml(error)}</div>`
    : '';
  const nextField = next
    ? `<input type="hidden" name="next" value="${escapeHtml(next)}">`
    : '';

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in — ACCC Risk Management System</title>
  ${FONT_LINKS}
  ${STYLESHEET_LINK}
</head>
<body class="login-body">
  <div class="login-shell">
    <div class="login-card">
      <aside class="login-visual">
        <div class="login-visual__intro">
          <p class="login-visual__eyebrow">Identify. Assess. Mitigate.</p>
          <h2 class="login-visual__headline">ACCC Risk<br>Management<br>System</h2>
        </div>
        <div class="login-visual__art">
          <img src="/img/risk-illustration.png" alt="Risk management dashboard illustration" class="login-visual__img">
        </div>
      </aside>
      <main class="login-panel">
        <div class="login-form-wrap">
          <h1 class="login-title">Sign In</h1>
          <p class="login-sub">Use your assigned credentials to continue.</p>
          ${errorBlock}
          <form method="post" action="/login" autocomplete="on" class="login-form">
            ${nextField}
            <div class="login-field">
              <label for="username">Username</label>
              <input id="username" name="username" type="text" required autofocus
                autocapitalize="none" autocomplete="username" placeholder="Enter your username">
            </div>
            <div class="login-field">
              <label for="password">Password</label>
              <div class="login-password-wrap">
                <input id="password" name="password" type="password" required
                  autocomplete="current-password" placeholder="Enter your password">
                <button type="button" class="login-password-toggle" id="password-toggle"
                  aria-label="Show password" aria-controls="password" aria-pressed="false">
                  <svg class="login-password-toggle__icon login-password-toggle__icon--show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg class="login-password-toggle__icon login-password-toggle__icon--hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
            </div>
            <button type="submit" class="login-submit">Sign In</button>
          </form>
        </div>
        <footer class="login-foot">
          <span>&copy; ${year} ACCC. Authorized personnel only.</span>
        </footer>
      </main>
    </div>
  </div>
  <script>
    (function () {
      const input = document.getElementById('password');
      const toggle = document.getElementById('password-toggle');
      if (!input || !toggle) return;

      toggle.addEventListener('click', function () {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.classList.toggle('is-visible', show);
        toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        toggle.setAttribute('aria-pressed', String(show));
      });
    })();
  </script>
</body>
</html>`;
}

function dashboardPage(user) {
  const roleHints = {
    supervisor: 'Submit and track risk reports, upload evidence, and record accomplishments.',
    rm_officer: 'View organizational risks, monitor SLA and compliance, and participate in ticket discussion threads — without owning or editing tickets.',
    executive: 'View-only oversight: dashboard, heatmap, risk register, reports, trends, statistics, and department performance. Comment on any submitted ticket.',
    president: 'Final approving authority for High and Critical risks. Review resolutions and RMU recommendations.',
    admin: 'Manage accounts, roles, and system logs.',
    employee: 'Access assigned risk workflows and departmental tasks.',
  };

  const hint = roleHints[user.role] || 'Welcome to the risk management system.';
  const consoleLink =
    user.role === 'admin'
      ? `<p style="margin-top:1rem"><a href="/admin" class="btn-enterprise-primary btn-primary--auto">Open administration</a></p>`
      : user.role === 'rm_officer'
        ? `<p style="margin-top:1rem"><a href="/officer" class="btn-enterprise-primary btn-primary--auto">Open RMU dashboard</a></p>`
        : user.role === 'supervisor'
          ? `<p style="margin-top:1rem"><a href="/supervisor" class="btn-enterprise-primary btn-primary--auto">Open supervisor dashboard</a></p>`
          : user.role === 'executive'
            ? `<p style="margin-top:1rem"><a href="/executive" class="btn-enterprise-primary btn-primary--auto">Open Executive Committee dashboard</a></p>`
            : user.role === 'president'
              ? `<p style="margin-top:1rem"><a href="/president" class="btn-enterprise-primary btn-primary--auto">Open president dashboard</a></p>`
              : user.role === 'dept_head'
                ? `<p style="margin-top:1rem"><a href="/dept" class="btn-enterprise-primary btn-primary--auto">Open department dashboard</a></p>`
                : '';

  const placeholder =
    user.role === 'rm_officer' || user.role === 'supervisor' || user.role === 'admin' || user.role === 'executive' || user.role === 'president' || user.role === 'dept_head'
      ? ''
      : `<p class="text-muted" style="margin-top:1.5rem;font-size:0.8125rem">
        Risk ticket modules will appear here for your role in upcoming releases.
      </p>`;

  const navVariant =
    user.role === 'admin'
      ? 'admin'
      : user.role === 'supervisor'
        ? 'supervisor'
        : user.role === 'rm_officer'
          ? 'officer'
          : user.role === 'executive'
            ? 'executive'
            : user.role === 'president'
              ? 'executive'
              : undefined;

  const body = `
    <div class="page-head">
      <h1>Welcome, ${escapeHtml(user.displayName)}</h1>
      <p class="page-desc">${escapeHtml(hint)}</p>
      <span class="role-badge">${escapeHtml(user.roleLabel)}</span>
      ${consoleLink}
      ${placeholder}
    </div>`;

  return appLayout({
    title: 'Dashboard',
    user,
    activeNav: 'home',
    body,
    wide: Boolean(navVariant),
    navVariant,
  });
}

module.exports = { loginPage, dashboardPage };
