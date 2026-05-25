const { ROLES, ASSIGNABLE_ROLES } = require('../../config/roles');
const { escapeHtml, formatDate } = require('../html');
const { actionLabel } = require('../logger');
const { appLayout, flashMessage } = require('./layout');

function roleOptionsHtml(selectedRole, { includeAdmin = false } = {}) {
  const roles = [...ASSIGNABLE_ROLES];
  if (includeAdmin) roles.push('admin');
  return roles
    .map(
      (r) =>
        `<option value="${r}" ${selectedRole === r ? 'selected' : ''}>${escapeHtml(ROLES[r].label)}</option>`,
    )
    .join('');
}

function adminOverviewPage(user, stats, flash) {
  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Administration</h1>
      <p class="page-desc">Manage users, roles, and system activity.</p>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-value">${stats.accounts}</span>
        <span class="stat-label">Active accounts</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.credentialEvents}</span>
        <span class="stat-label">Credential events</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.reportEvents}</span>
        <span class="stat-label">Report records</span>
      </div>
    </div>
    <div class="card" style="margin-top:1.5rem">
      <h2>Quick actions</h2>
      <div class="action-row">
        <a href="/admin/accounts" class="btn-outline">Create account</a>
        <a href="/admin/logs/credentials" class="btn-outline">View credentials log</a>
        <a href="/admin/logs/reports" class="btn-outline">View report history</a>
      </div>
    </div>`;

  return appLayout({
    title: 'Administration',
    user,
    activeNav: 'overview',
    body,
    wide: true,
  });
}

function accountsPage(user, users, flash, error) {
  const createRoleOptions = roleOptionsHtml(null, { includeAdmin: true });

  const rows = users
    .map((u) => {
      let actionsCell;
      if (u.username === 'admin') {
        actionsCell = '<span class="text-muted">Fixed</span>';
      } else if (u.builtIn) {
        actionsCell = `<form method="post" action="/admin/accounts/${escapeHtml(u.username)}/role" class="inline-form">
            <select name="role" class="role-select" aria-label="Role for ${escapeHtml(u.username)}">
              ${roleOptionsHtml(u.role, { includeAdmin: true })}
            </select>
            <button type="submit" class="btn-sm">Save</button>
          </form>`;
      } else {
        actionsCell = `<div class="action-cell">
            <form method="post" action="/admin/accounts/${escapeHtml(u.username)}/role" class="inline-form">
              <select name="role" class="role-select" aria-label="Role for ${escapeHtml(u.username)}">
                ${roleOptionsHtml(u.role, { includeAdmin: true })}
              </select>
              <button type="submit" class="btn-sm">Save</button>
            </form>
            <form method="post" action="/admin/accounts/${escapeHtml(u.username)}/delete" class="inline-form"
              onsubmit="return confirm('Delete account ${escapeHtml(u.username)}? This cannot be undone.');">
              <button type="submit" class="btn-danger">Delete</button>
            </form>
          </div>`;
      }

      return `<tr>
        <td class="col-user"><strong>${escapeHtml(u.username)}</strong>${u.builtIn ? '<span class="tag">built-in</span>' : ''}</td>
        <td class="col-name">${escapeHtml(u.displayName)}</td>
        <td class="col-role">${escapeHtml(u.roleLabel)}</td>
        <td class="col-actions">${actionsCell}</td>
      </tr>`;
    })
    .join('');

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head">
      <h1>Accounts</h1>
      <p class="page-desc">Create users, assign roles, and remove accounts you added.</p>
    </div>
    <div class="accounts-layout">
      <section class="card card--compact">
        <h2>Create account</h2>
        <form method="post" action="/admin/accounts" class="create-account-form">
          <div class="field">
            <label for="username">Username</label>
            <input id="username" name="username" type="text" required pattern="[a-zA-Z0-9._-]{3,32}"
              autocapitalize="none" placeholder="e.g. jsmith">
          </div>
          <div class="field">
            <label for="displayName">Display name</label>
            <input id="displayName" name="displayName" type="text" required placeholder="Full name">
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required minlength="6" placeholder="Min. 6 characters">
          </div>
          <div class="field">
            <label for="role">Role</label>
            <select id="role" name="role" required>${createRoleOptions}</select>
          </div>
          <button type="submit" class="btn-primary btn-primary--auto">Create account</button>
        </form>
      </section>
      <section class="card card--table accounts-table-card">
        <h2>All accounts</h2>
        <div class="table-wrap">
          <table class="data-table data-table--compact accounts-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" class="empty">No accounts</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </div>`;

  return appLayout({
    title: 'Accounts',
    user,
    activeNav: 'accounts',
    body,
    wide: true,
  });
}

function credentialsLogPage(user, logs, flash) {
  const rows = logs
    .map(
      (log) => `<tr>
        <td class="nowrap">${escapeHtml(formatDate(log.at))}</td>
        <td><span class="pill ${log.success ? 'pill--ok' : 'pill--bad'}">${escapeHtml(actionLabel(log.action))}</span></td>
        <td>${escapeHtml(log.username)}</td>
        <td>${escapeHtml(log.actor)}</td>
        <td>${escapeHtml(log.detail)}</td>
        <td class="mono">${escapeHtml(log.ip || '—')}</td>
      </tr>`,
    )
    .join('');

  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Credentials log</h1>
      <p class="page-desc">Sign-in activity and account changes.</p>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>User</th>
              <th>Actor</th>
              <th>Detail</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No events recorded</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return appLayout({
    title: 'Credentials log',
    user,
    activeNav: 'credentials',
    body,
    wide: true,
  });
}

function reportHistoryPage(user, logs, flash) {
  const rows = logs
    .map(
      (log) => `<tr>
        <td class="nowrap">${escapeHtml(formatDate(log.at))}</td>
        <td class="mono">${escapeHtml(log.ticketRef || '—')}</td>
        <td>${escapeHtml(log.title || '—')}</td>
        <td>${escapeHtml(log.submittedBy || '—')}</td>
        <td>${escapeHtml(log.submitterRole || '—')}</td>
        <td><span class="status">${escapeHtml(log.status || '—')}</span></td>
      </tr>`,
    )
    .join('');

  const emptyNote = logs.length === 0
    ? `<div class="card" style="margin-top:1rem">
        <p class="text-muted">No risk reports have been submitted yet. This log will populate when the Department Supervisor dashboard is available and users submit tickets.</p>
      </div>`
    : '';

  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Report history</h1>
      <p class="page-desc">Risk ticket submissions and status changes.</p>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Title</th>
              <th>Submitted by</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No reports recorded</td></tr>'}</tbody>
        </table>
      </div>
    </section>
    ${emptyNote}`;

  return appLayout({
    title: 'Report history',
    user,
    activeNav: 'reports',
    body,
    wide: true,
  });
}

module.exports = {
  adminOverviewPage,
  accountsPage,
  credentialsLogPage,
  reportHistoryPage,
};
