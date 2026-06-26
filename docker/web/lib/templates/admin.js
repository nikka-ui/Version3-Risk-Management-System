const { ROLES } = require('../../config/roles');
const { ADMIN_ASSIGNABLE_ROLES } = require('../../config/admin');
const { TICKET_STATUSES } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { auditActionLabel } = require('../admin');
const { adminAppLayout } = require('./admin-layout');
const { flashMessage } = require('./layout');
const { supPageHead, supQuickActions } = require('./console-ui');

const KPI_ICONS = {
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
  active: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`,
  dept: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/></svg>`,
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>`,
  closed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  audit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>`,
  high: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
  login: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
};

const ACTION_ICONS = {
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/></svg>`,
  deactivate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  activate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  view: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

/** Icon-only action link. variant maps to a color in CSS. */
function iconLink(href, icon, label, variant) {
  return `<a href="${href}" class="admin-icon-btn admin-icon-btn--${variant}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${ACTION_ICONS[icon]}</a>`;
}

function iconButton(icon, label, variant, { type = 'submit', attrs = '' } = {}) {
  return `<button type="${type}" class="admin-icon-btn admin-icon-btn--${variant}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${attrs}>${ACTION_ICONS[icon]}</button>`;
}

function adminPage(title, user, activeNav, body, stats) {
  return adminAppLayout({ title, user, activeNav, body, stats });
}

function kpiCard(href, icon, value, label, variant = '') {
  return `<a href="${href}" class="sup-kpi${variant ? ` ${variant}` : ''}">
    <span class="sup-kpi__icon">${icon}</span>
    <span class="sup-kpi__body">
      <span class="sup-kpi__value">${value}</span>
      <span class="sup-kpi__label">${escapeHtml(label)}</span>
    </span>
  </a>`;
}

function roleOptionsHtml(selectedRole) {
  return ADMIN_ASSIGNABLE_ROLES.map(
    (r) =>
      `<option value="${r}" ${selectedRole === r ? 'selected' : ''}>${escapeHtml(ROLES[r]?.label || r)}</option>`,
  ).join('');
}

function departmentOptionsHtml(departments, selected) {
  return departments
    .map(
      (d) =>
        `<option value="${escapeHtml(d.name)}" ${selected === d.name ? 'selected' : ''}>${escapeHtml(d.name)}</option>`,
    )
    .join('');
}

function positionOptionsHtml(positions, selected) {
  return positions
    .map(
      (p) =>
        `<option value="${escapeHtml(p.name)}" ${selected === p.name ? 'selected' : ''}>${escapeHtml(p.name)}</option>`,
    )
    .join('');
}

function statusBadge(status) {
  const map = {
    active: { cls: 'active', label: 'Active' },
    inactive: { cls: 'inactive', label: 'Inactive' },
    deleted: { cls: 'deleted', label: 'Deleted' },
  };
  const s = map[status] || map.inactive;
  return `<span class="admin-status admin-status--${s.cls}"><span class="admin-status__dot" aria-hidden="true"></span>${s.label}</span>`;
}

function riskLevelBadge(level, label) {
  const id = level || 'low';
  return `<span class="risk-badge risk-badge--${escapeHtml(id)}">${escapeHtml(label || id)}</span>`;
}

function adminOverviewPage(user, data, flash) {
  const { stats, recentUsers, deletedTickets, auditLogs } = data;
  const userRows = recentUsers
    .map(
      (u) => `<tr>
        <td class="mono">${escapeHtml(u.employeeId || '—')}</td>
        <td>${escapeHtml(u.displayName)}</td>
        <td>${escapeHtml(u.roleLabel)}</td>
        <td class="nowrap">${escapeHtml(formatDate(u.createdAt))}</td>
      </tr>`,
    )
    .join('');
  const deletedRows = deletedTickets
    .map(
      (d) => `<tr>
        <td class="mono">${escapeHtml(d.ticketRef)}</td>
        <td>${escapeHtml(d.title)}</td>
        <td>${escapeHtml(d.deletedBy)}</td>
        <td class="nowrap">${escapeHtml(formatDate(d.at))}</td>
      </tr>`,
    )
    .join('');
  const auditRows = auditLogs
    .map(
      (l) => `<tr>
        <td class="nowrap">${escapeHtml(formatDate(l.at))}</td>
        <td>${escapeHtml(l.username)}</td>
        <td>${escapeHtml(auditActionLabel(l.action))}</td>
        <td>${escapeHtml(l.module)}</td>
        <td class="sup-truncate">${escapeHtml(l.description)}</td>
      </tr>`,
    )
    .join('');

  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Dashboard',
      desc: 'System administration overview for the AI-Assisted ISO 31000 Risk Management platform.',
    })}
    <div class="sup-kpi-grid sup-kpi-grid--stats">
      ${kpiCard('/admin/users', KPI_ICONS.users, stats.totalUsers, 'Total Users')}
      ${kpiCard('/admin/users?filter=active', KPI_ICONS.active, stats.activeUsers, 'Active Users')}
      ${kpiCard('/admin/departments', KPI_ICONS.dept, stats.departments, 'Departments')}
      ${kpiCard('/admin/tickets?status=open', KPI_ICONS.open, stats.openTickets, 'Open Tickets')}
      ${kpiCard('/admin/tickets?status=closed', KPI_ICONS.closed, stats.closedTickets, 'Closed Tickets')}
      ${kpiCard('/admin/audit-logs', KPI_ICONS.audit, stats.auditLogsToday, 'Audit Logs Today')}
      ${kpiCard('/admin/tickets?level=high', KPI_ICONS.high, stats.highRiskTickets, 'High Risk', 'sup-kpi--warn')}
      ${kpiCard('/admin/tickets?level=critical', KPI_ICONS.high, stats.criticalRiskTickets, 'Critical Risk', 'sup-kpi--warn')}
      ${kpiCard('/admin/audit-logs?action=login', KPI_ICONS.login, stats.todaysLogins, "Today's Logins")}
    </div>
    ${supQuickActions([
      { href: '/admin/users?action=add', label: 'Add User' },
      { href: '/admin/departments?action=add', label: 'Add Department' },
      { href: '/admin/audit-logs', label: 'View Audit Logs' },
      { href: '/admin/tickets', label: 'Manage Tickets' },
    ])}
    <div class="admin-dash-grid">
      <section class="sup-card sup-card--table">
        <div class="sup-card__head"><h2>Newly created users</h2><a href="/admin/users" class="sup-link">View all</a></div>
        <div class="table-wrap">
          <table class="data-table data-table--compact sup-table">
            <thead><tr><th>Employee ID</th><th>Name</th><th>Role</th><th>Created</th></tr></thead>
            <tbody>${userRows || '<tr><td colspan="4" class="empty">No recent users</td></tr>'}</tbody>
          </table>
        </div>
      </section>
      <section class="sup-card sup-card--table">
        <div class="sup-card__head"><h2>Recently deleted tickets</h2><a href="/admin/tickets?deleted=1" class="sup-link">View all</a></div>
        <div class="table-wrap">
          <table class="data-table data-table--compact sup-table">
            <thead><tr><th>Reference</th><th>Title</th><th>Deleted by</th><th>Date</th></tr></thead>
            <tbody>${deletedRows || '<tr><td colspan="4" class="empty">No deleted tickets</td></tr>'}</tbody>
          </table>
        </div>
      </section>
      <section class="sup-card sup-card--table admin-dash-grid__full">
        <div class="sup-card__head"><h2>Latest audit log entries</h2><a href="/admin/audit-logs" class="sup-link">View all</a></div>
        <div class="table-wrap">
          <table class="data-table data-table--compact sup-table">
            <thead><tr><th>Date & Time</th><th>User</th><th>Action</th><th>Module</th><th>Description</th></tr></thead>
            <tbody>${auditRows || '<tr><td colspan="5" class="empty">No audit entries</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </div>
    <section class="sup-card sup-card--compact admin-permissions-note">
      <h2>Administrator permissions</h2>
      <p class="sup-muted-block">System administrators manage users, departments, tickets (view/delete only), audit logs, and settings. Administrators cannot approve risk reports, validate mitigation plans, or override RMO or Audit decisions.</p>
    </section>`;

  return adminPage('Dashboard', user, 'dashboard', body);
}

function usersPage(user, users, departments, positions, flash, error, { editUser, filters } = {}) {
  const showForm = filters?.action === 'add' || editUser;
  const filterQ = escapeHtml(filters?.q || '');
  const filterRole = filters?.role || '';
  const filterStatus = filters?.status || '';

  const rows = users
    .map((u) => {
      const isPrimaryAdmin = u.username === 'admin';
      let actions = '';
      if (!isPrimaryAdmin) {
        actions = `<div class="admin-action-cell">
          ${iconLink(`/admin/users/${escapeHtml(u.username)}/edit`, 'edit', 'Edit', 'edit')}
          <form method="post" action="/admin/users/${escapeHtml(u.username)}/reset-password" class="inline-form">
            <input type="hidden" name="mode" value="prompt">
            ${iconButton('key', 'Reset Password', 'reset')}
          </form>
          ${
            u.active
              ? `<form method="post" action="/admin/users/${escapeHtml(u.username)}/deactivate" class="inline-form">
                  ${iconButton('deactivate', 'Deactivate', 'deactivate')}
                </form>`
              : `<form method="post" action="/admin/users/${escapeHtml(u.username)}/activate" class="inline-form">
                  ${iconButton('activate', 'Activate', 'activate')}
                </form>`
          }
          ${
            !u.builtIn
              ? `<form method="post" action="/admin/users/${escapeHtml(u.username)}/delete" class="inline-form"
                  onsubmit="return confirm('Delete user ${escapeHtml(u.displayName)}? This requires confirmation.');">
                  ${iconButton('delete', 'Delete', 'delete')}
                </form>`
              : ''
          }
        </div>`;
      } else {
        actions = '<span class="text-muted">Protected</span>';
      }
      return `<tr>
        <td class="mono">${escapeHtml(u.employeeId || '—')}</td>
        <td><strong>${escapeHtml(u.displayName)}</strong>${u.builtIn ? ' <span class="tag">built-in</span>' : ''}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td class="mono">${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.department || '—')}</td>
        <td>${escapeHtml(u.position || '—')}</td>
        <td>${escapeHtml(u.roleLabel)}</td>
        <td>${statusBadge(u.status)}</td>
        <td class="col-actions">${actions}</td>
      </tr>`;
    })
    .join('');

  const formSection = showForm
    ? `<section class="sup-card sup-card--compact admin-form-card">
        <h2>${editUser ? `Edit user: ${escapeHtml(editUser.displayName)}` : 'Create user'}</h2>
        <form method="post" action="${editUser ? `/admin/users/${escapeHtml(editUser.username)}/edit` : '/admin/users'}" class="admin-user-form">
          <div class="admin-form-grid">
            <div class="field"><label for="employeeId">Employee ID</label>
              <input id="employeeId" name="employeeId" type="text" value="${escapeHtml(editUser?.employeeId || '')}" ${editUser ? '' : 'required'}></div>
            <div class="field"><label for="displayName">Full Name</label>
              <input id="displayName" name="displayName" type="text" value="${escapeHtml(editUser?.displayName || '')}" required></div>
            <div class="field"><label for="email">Email Address</label>
              <input id="email" name="email" type="email" value="${escapeHtml(editUser?.email || '')}" required></div>
            ${
              editUser
                ? ''
                : `<div class="field"><label for="username">Username</label>
              <input id="username" name="username" type="text" required pattern="[a-zA-Z0-9._-]{3,32}" autocapitalize="none"></div>`
            }
            <div class="field"><label for="department">Department</label>
              <select id="department" name="department" required>
                <option value="">Select department</option>
                ${departmentOptionsHtml(departments, editUser?.department)}
              </select></div>
            <div class="field"><label for="position">Position</label>
              <select id="position" name="position" required>
                <option value="">Select position</option>
                ${positionOptionsHtml(positions, editUser?.position)}
              </select></div>
            <div class="field"><label for="role">User Role</label>
              <select id="role" name="role" required ${editUser?.username === 'admin' ? 'disabled' : ''}>
                ${roleOptionsHtml(editUser?.role)}
              </select>
              ${editUser?.username === 'admin' ? '<input type="hidden" name="role" value="admin">' : ''}</div>
            <div class="field"><label for="status">Status</label>
              <select id="status" name="status" ${editUser?.username === 'admin' ? 'disabled' : ''}>
                <option value="active" ${editUser?.status !== 'inactive' ? 'selected' : ''}>Active</option>
                <option value="inactive" ${editUser?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              </select></div>
            ${
              editUser
                ? ''
                : `<div class="field"><label for="password">Password</label>
              <input id="password" name="password" type="password" required minlength="6"></div>
            <div class="field"><label for="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required minlength="6"></div>`
            }
          </div>
          <div class="action-row">
            <button type="submit" class="sup-btn-primary">${editUser ? 'Save changes' : 'Add User'}</button>
            <a href="/admin/users" class="sup-btn-outline">Cancel</a>
          </div>
        </form>
      </section>`
    : '';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supPageHead({
      title: 'User Management',
      desc: 'Create, edit, activate, deactivate, and reset passwords for system users.',
      actionHtml: '<a href="/admin/users?action=add" class="sup-btn-primary">+ Add User</a>',
    })}
    <form method="get" action="/admin/users" class="admin-filter-bar">
      <input type="search" name="q" placeholder="Search users…" value="${filterQ}" aria-label="Search users">
      <select name="role" aria-label="Filter by role">
        <option value="">All roles</option>
        ${roleOptionsHtml(filterRole)}
      </select>
      <select name="status" aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>Active</option>
        <option value="inactive" ${filterStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
      </select>
      <button type="submit" class="btn-outline">Filter</button>
    </form>
    ${formSection}
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table admin-users-table">
          <thead>
            <tr>
              <th>Employee ID</th><th>Full Name</th><th>Email</th><th>Username</th>
              <th>Department</th><th>Position</th><th>Role</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="9" class="empty">No users found</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return adminPage('User Management', user, 'users', body);
}

function resetPasswordPage(user, targetUser, flash, error) {
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supPageHead({
      title: 'Reset Password',
      desc: `Set a new password for ${targetUser.displayName} (${targetUser.username}).`,
      actionHtml: `<a href="/admin/users" class="sup-btn-outline">Back to users</a>`,
    })}
    <section class="sup-card sup-card--compact">
      <form method="post" action="/admin/users/${escapeHtml(targetUser.username)}/reset-password">
        <div class="admin-form-grid">
          <div class="field"><label for="password">New Password</label>
            <input id="password" name="password" type="password" required minlength="6"></div>
          <div class="field"><label for="confirmPassword">Confirm Password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required minlength="6"></div>
        </div>
        <button type="submit" class="sup-btn-primary">Reset Password</button>
      </form>
    </section>`;
  return adminPage('Reset Password', user, 'users', body);
}

function departmentsPage(user, departments, flash, error, { editDept, showAdd } = {}) {
  const rows = departments
    .map(
      (d) => `<tr>
        <td><strong>${escapeHtml(d.name)}</strong></td>
        <td class="mono">${escapeHtml(d.code)}</td>
        <td class="sup-truncate">${escapeHtml(d.description || '—')}</td>
        <td>${escapeHtml(d.head || '—')}</td>
        <td>${statusBadge(d.status || 'active')}</td>
        <td class="col-actions">
          <div class="admin-action-cell">
            ${iconLink(`/admin/departments/${escapeHtml(d.id)}/edit`, 'edit', 'Edit', 'edit')}
            <form method="post" action="/admin/departments/${escapeHtml(d.id)}/delete" class="inline-form"
              onsubmit="return confirm('Delete department ${escapeHtml(d.name)}?');">
              ${iconButton('delete', 'Delete', 'delete')}
            </form>
          </div>
        </td>
      </tr>`,
    )
    .join('');

  const form = showAdd || editDept
    ? `<section class="sup-card sup-card--compact">
        <h2>${editDept ? 'Edit department' : 'Add department'}</h2>
        <form method="post" action="${editDept ? `/admin/departments/${escapeHtml(editDept.id)}/edit` : '/admin/departments'}">
          <div class="admin-form-grid">
            <div class="field"><label for="name">Department Name</label>
              <input id="name" name="name" type="text" value="${escapeHtml(editDept?.name || '')}" required></div>
            <div class="field"><label for="code">Department Code</label>
              <input id="code" name="code" type="text" value="${escapeHtml(editDept?.code || '')}" required></div>
            <div class="field admin-form-grid__full"><label for="description">Description</label>
              <textarea id="description" name="description" rows="2">${escapeHtml(editDept?.description || '')}</textarea></div>
            <div class="field"><label for="head">Department Head (optional)</label>
              <input id="head" name="head" type="text" value="${escapeHtml(editDept?.head || '')}"></div>
            <div class="field"><label for="status">Status</label>
              <select id="status" name="status">
                <option value="active" ${editDept?.status !== 'inactive' ? 'selected' : ''}>Active</option>
                <option value="inactive" ${editDept?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              </select></div>
          </div>
          <div class="action-row">
            <button type="submit" class="sup-btn-primary">${editDept ? 'Save' : 'Add Department'}</button>
            <a href="/admin/departments" class="sup-btn-outline">Cancel</a>
          </div>
        </form>
      </section>`
    : '';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supPageHead({
      title: 'Department Management',
      desc: 'Manage organizational departments used across the risk management system.',
      actionHtml: '<a href="/admin/departments?action=add" class="sup-btn-primary">+ Add Department</a>',
    })}
    ${form}
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table">
          <thead><tr><th>Name</th><th>Code</th><th>Description</th><th>Head</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No departments</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  return adminPage('Department Management', user, 'departments', body);
}

function positionsPage(user, positions, flash, error, { editPos, showAdd } = {}) {
  const rows = positions
    .map(
      (p) => `<tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td class="col-actions">
          <div class="admin-action-cell">
            ${iconLink(`/admin/positions/${escapeHtml(p.id)}/edit`, 'edit', 'Edit', 'edit')}
            <form method="post" action="/admin/positions/${escapeHtml(p.id)}/delete" class="inline-form"
              onsubmit="return confirm('Delete position ${escapeHtml(p.name)}?');">
              ${iconButton('delete', 'Delete', 'delete')}
            </form>
          </div>
        </td>
      </tr>`,
    )
    .join('');

  const form = showAdd || editPos
    ? `<section class="sup-card sup-card--compact">
        <h2>${editPos ? 'Edit position' : 'Add position'}</h2>
        <form method="post" action="${editPos ? `/admin/positions/${escapeHtml(editPos.id)}/edit` : '/admin/positions'}">
          <div class="field"><label for="name">Position Name</label>
            <input id="name" name="name" type="text" value="${escapeHtml(editPos?.name || '')}" required></div>
          <div class="action-row">
            <button type="submit" class="sup-btn-primary">${editPos ? 'Save' : 'Add Position'}</button>
            <a href="/admin/positions" class="sup-btn-outline">Cancel</a>
          </div>
        </form>
      </section>`
    : '';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supPageHead({
      title: 'Position Management',
      desc: 'Manage job positions available when creating or editing users.',
      actionHtml: '<a href="/admin/positions?action=add" class="sup-btn-primary">+ Add Position</a>',
    })}
    ${form}
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table">
          <thead><tr><th>Position</th><th>Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2" class="empty">No positions</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  return adminPage('Position Management', user, 'positions', body);
}

function ticketsPage(user, tickets, departments, flash, error, filters = {}) {
  const deptOpts = departments
    .map(
      (d) =>
        `<option value="${escapeHtml(d.name)}" ${filters.department === d.name ? 'selected' : ''}>${escapeHtml(d.name)}</option>`,
    )
    .join('');
  const statusOpts = Object.entries(TICKET_STATUSES)
    .map(
      ([id, s]) =>
        `<option value="${id}" ${filters.status === id ? 'selected' : ''}>${escapeHtml(s.label)}</option>`,
    )
    .join('');
  const levelOpts = ['low', 'moderate', 'high', 'critical']
    .map(
      (l) =>
        `<option value="${l}" ${filters.level === l ? 'selected' : ''}>${escapeHtml(l.charAt(0).toUpperCase() + l.slice(1))}</option>`,
    )
    .join('');

  const rows = tickets
    .map((t) => {
      const action = t.deleted
        ? '<span class="text-muted">Deleted</span>'
        : `${iconLink(`/admin/tickets/${escapeHtml(t.reference)}`, 'view', 'View', 'view')}
           <button type="button" class="admin-icon-btn admin-icon-btn--delete admin-ticket-delete-btn"
             title="Delete" aria-label="Delete"
             data-ref="${escapeHtml(t.reference)}" data-title="${escapeHtml(t.title)}">${ACTION_ICONS.delete}</button>`;
      return `<tr${t.deleted ? ' class="row--muted"' : ''}>
        <td class="mono nowrap"><a href="/admin/tickets/${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td class="sup-truncate">${escapeHtml(t.title)}</td>
        <td>${escapeHtml(t.department)}</td>
        <td>${riskLevelBadge(t.riskLevel, t.riskLevelLabel)}</td>
        <td><span class="status">${escapeHtml(t.statusLabel)}</span></td>
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
        <td class="col-actions"><div class="admin-action-cell">${action}</div></td>
      </tr>`;
    })
    .join('');

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supPageHead({
      title: 'Ticket Management',
      desc: 'View and search all risk tickets. Administrators may delete tickets (soft delete) but cannot approve or modify the risk workflow.',
    })}
    <form method="get" action="/admin/tickets" class="admin-filter-bar">
      <input type="search" name="q" placeholder="Search tickets…" value="${escapeHtml(filters.q || '')}">
      <select name="department"><option value="">All departments</option>${deptOpts}</select>
      <select name="level"><option value="">All risk levels</option>${levelOpts}</select>
      <select name="status"><option value="">All statuses</option>${statusOpts}</select>
      <label class="admin-check-label"><input type="checkbox" name="deleted" value="1" ${filters.deleted ? 'checked' : ''}> Show deleted</label>
      <button type="submit" class="btn-outline">Filter</button>
    </form>
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table">
          <thead><tr><th>Reference</th><th>Title</th><th>Department</th><th>Risk Level</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="empty">No tickets found</td></tr>'}</tbody>
        </table>
      </div>
    </section>
    <dialog id="ticketDeleteDialog" class="admin-dialog">
      <form method="post" id="ticketDeleteForm" class="admin-dialog__form">
        <h3>Delete ticket</h3>
        <p class="sup-muted-block">You are about to soft-delete <strong id="ticketDeleteRef"></strong>. This is recorded in the audit log. Provide a reason for deletion.</p>
        <div class="field">
          <label for="ticketDeleteReason">Reason for deletion</label>
          <textarea id="ticketDeleteReason" name="reason" rows="3" required></textarea>
        </div>
        <div class="action-row">
          <button type="submit" class="btn-danger">Delete ticket</button>
          <button type="button" class="sup-btn-outline" id="ticketDeleteCancel">Cancel</button>
        </div>
      </form>
    </dialog>
    <script>
      (function () {
        var dlg = document.getElementById('ticketDeleteDialog');
        var form = document.getElementById('ticketDeleteForm');
        var refEl = document.getElementById('ticketDeleteRef');
        var reason = document.getElementById('ticketDeleteReason');
        document.querySelectorAll('.admin-ticket-delete-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var ref = btn.getAttribute('data-ref');
            form.action = '/admin/tickets/' + encodeURIComponent(ref) + '/delete';
            refEl.textContent = ref + ' — ' + btn.getAttribute('data-title');
            reason.value = '';
            if (typeof dlg.showModal === 'function') { dlg.showModal(); } else { form.submit(); }
          });
        });
        var cancel = document.getElementById('ticketDeleteCancel');
        if (cancel) cancel.addEventListener('click', function () { dlg.close(); });
      })();
    </script>`;
  return adminPage('Ticket Management', user, 'tickets', body);
}

function ticketDetailPage(user, ticket, flash) {
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: ticket.title,
      desc: `${ticket.reference} · ${ticket.statusLabel} · Read-only view`,
      actionHtml: '<a href="/admin/tickets" class="sup-btn-outline">Back to tickets</a>',
    })}
    <section class="sup-card">
      <dl class="detail-dl detail-dl--console">
        <dt>Reference</dt><dd class="mono">${escapeHtml(ticket.reference)}</dd>
        <dt>Department</dt><dd>${escapeHtml(ticket.department)}</dd>
        <dt>Submitted by</dt><dd>${escapeHtml(ticket.submittedByName || ticket.submittedBy)}</dd>
        <dt>Risk level</dt><dd>${riskLevelBadge(ticket.riskLevel, ticket.riskLevelLabel)}</dd>
        <dt>Status</dt><dd>${escapeHtml(ticket.statusLabel)}</dd>
        <dt>Updated</dt><dd>${escapeHtml(formatDate(ticket.updatedAt))}</dd>
        ${ticket.deleted ? `<dt>Deletion reason</dt><dd>${escapeHtml(ticket.deletionReason || '—')}</dd>` : ''}
      </dl>
      <p class="sup-muted-block admin-readonly-note">This is a read-only view. Administrators cannot approve, reject, or modify the risk workflow.</p>
    </section>`;
  return adminPage('Ticket Details', user, 'tickets', body);
}

function auditLogsPage(user, logs, flash, filters = {}) {
  const rows = logs
    .map(
      (l) => `<tr>
        <td class="nowrap">${escapeHtml(formatDate(l.at))}</td>
        <td>${escapeHtml(l.username)}</td>
        <td>${escapeHtml(l.roleLabel || l.role)}</td>
        <td><span class="pill">${escapeHtml(auditActionLabel(l.action))}</span></td>
        <td>${escapeHtml(l.module)}</td>
        <td class="sup-truncate">${escapeHtml(l.description)}</td>
        <td class="mono">${escapeHtml(l.ip || '—')}</td>
        <td>${escapeHtml(l.device || '—')}</td>
        <td>${escapeHtml(l.browser || '—')}</td>
        <td><button type="button" class="btn-link admin-log-detail-btn" data-detail="${escapeHtml(JSON.stringify(l))}">View Details</button></td>
      </tr>`,
    )
    .join('');

  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Audit Logs',
      desc: 'Complete audit trail of administrator and system actions.',
      actionHtml: `<div class="admin-export-actions">
        <a href="/admin/audit-logs/export?format=csv&${new URLSearchParams(filters).toString()}" class="sup-btn-outline">Export CSV</a>
        <button type="button" class="sup-btn-outline" onclick="window.print()">Print Logs</button>
      </div>`,
    })}
    <form method="get" action="/admin/audit-logs" class="admin-filter-bar">
      <input type="search" name="q" placeholder="Search logs…" value="${escapeHtml(filters.q || '')}">
      <input type="date" name="date" value="${escapeHtml(filters.date || '')}" aria-label="Filter by date">
      <input type="text" name="user" placeholder="User" value="${escapeHtml(filters.user || '')}">
      <input type="text" name="action" placeholder="Action" value="${escapeHtml(filters.action || '')}">
      <input type="text" name="module" placeholder="Module" value="${escapeHtml(filters.module || '')}">
      <button type="submit" class="btn-outline">Filter</button>
    </form>
    <section class="sup-card sup-card--table admin-printable">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table">
          <thead>
            <tr>
              <th>Date & Time</th><th>User</th><th>Role</th><th>Action</th><th>Module</th>
              <th>Description</th><th>IP</th><th>Device</th><th>Browser</th><th></th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10" class="empty">No audit logs</td></tr>'}</tbody>
        </table>
      </div>
    </section>
    <dialog id="auditDetailDialog" class="admin-dialog">
      <div class="admin-dialog__body"></div>
      <form method="dialog"><button class="sup-btn-outline">Close</button></form>
    </dialog>
    <script>
      document.querySelectorAll('.admin-log-detail-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var data = JSON.parse(btn.getAttribute('data-detail'));
          var dlg = document.getElementById('auditDetailDialog');
          dlg.querySelector('.admin-dialog__body').innerHTML =
            '<h3>Audit log details</h3><dl class="detail-dl">' +
            '<dt>ID</dt><dd>' + (data.id || '') + '</dd>' +
            '<dt>Time</dt><dd>' + (data.at || '') + '</dd>' +
            '<dt>User</dt><dd>' + (data.username || '') + '</dd>' +
            '<dt>Action</dt><dd>' + (data.action || '') + '</dd>' +
            '<dt>Description</dt><dd>' + (data.description || '') + '</dd>' +
            '</dl>';
          dlg.showModal();
        });
      });
    </script>`;
  return adminPage('Audit Logs', user, 'audit', body);
}

function settingsPage(user, settings, flash, error) {
  const fileTypes = (settings.allowedFileTypes || []).join(', ');
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supPageHead({
      title: 'System Settings',
      desc: 'Configure general system, AI, security, and backup settings.',
    })}
    <form method="post" action="/admin/settings" class="admin-settings-form">
      <section class="sup-card sup-card--compact">
        <h2>General Settings</h2>
        <div class="admin-form-grid">
          <div class="field"><label for="systemName">System Name</label>
            <input id="systemName" name="systemName" type="text" value="${escapeHtml(settings.systemName || '')}"></div>
          <div class="field"><label for="organizationName">Organization Name</label>
            <input id="organizationName" name="organizationName" type="text" value="${escapeHtml(settings.organizationName || '')}"></div>
          <div class="field"><label for="themeColor">Theme Color</label>
            <input id="themeColor" name="themeColor" type="color" value="${escapeHtml(settings.themeColor || '#2563eb')}"></div>
          <div class="field"><label for="ticketNumberFormat">Ticket Number Format</label>
            <input id="ticketNumberFormat" name="ticketNumberFormat" type="text" value="${escapeHtml(settings.ticketNumberFormat || '')}"></div>
        </div>
      </section>
      <section class="sup-card sup-card--compact">
        <h2>AI Configuration</h2>
        <div class="field"><label for="defaultRiskLevels">Default Risk Levels</label>
          <input id="defaultRiskLevels" name="defaultRiskLevels" type="text" value="${escapeHtml((settings.defaultRiskLevels || []).join(', '))}"></div>
      </section>
      <section class="sup-card sup-card--compact">
        <h2>Email & Security</h2>
        <div class="admin-form-grid">
          <label class="admin-check-label"><input type="checkbox" name="emailNotifications" value="1" ${settings.emailNotifications ? 'checked' : ''}> Email Notifications</label>
          <div class="field"><label for="passwordMinLength">Password Min Length</label>
            <input id="passwordMinLength" name="passwordMinLength" type="number" min="6" value="${settings.passwordMinLength || 8}"></div>
          <div class="field"><label for="sessionTimeoutMinutes">Session Timeout (minutes)</label>
            <input id="sessionTimeoutMinutes" name="sessionTimeoutMinutes" type="number" value="${settings.sessionTimeoutMinutes || 480}"></div>
          <label class="admin-check-label"><input type="checkbox" name="mfaEnabled" value="1" ${settings.mfaEnabled ? 'checked' : ''}> Multi-Factor Authentication (optional)</label>
        </div>
      </section>
      <section class="sup-card sup-card--compact">
        <h2>File Upload & Maintenance</h2>
        <div class="admin-form-grid">
          <div class="field"><label for="maxUploadSizeMb">Max Upload Size (MB)</label>
            <input id="maxUploadSizeMb" name="maxUploadSizeMb" type="number" value="${settings.maxUploadSizeMb || 25}"></div>
          <div class="field admin-form-grid__full"><label for="allowedFileTypes">Allowed File Types</label>
            <input id="allowedFileTypes" name="allowedFileTypes" type="text" value="${escapeHtml(fileTypes)}"></div>
          <label class="admin-check-label"><input type="checkbox" name="maintenanceMode" value="1" ${settings.maintenanceMode ? 'checked' : ''}> Maintenance Mode</label>
          <label class="admin-check-label"><input type="checkbox" name="backupEnabled" value="1" ${settings.backupEnabled ? 'checked' : ''}> Backup Enabled</label>
          <div class="field"><label for="backupFrequency">Backup Frequency</label>
            <select id="backupFrequency" name="backupFrequency">
              <option value="daily" ${settings.backupFrequency === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${settings.backupFrequency === 'weekly' ? 'selected' : ''}>Weekly</option>
            </select></div>
        </div>
      </section>
      <button type="submit" class="sup-btn-primary">Save Settings</button>
    </form>`;
  return adminPage('System Settings', user, 'settings', body);
}

function profilePage(user, flash) {
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({ title: 'Profile', desc: 'Your administrator account details.' })}
    <section class="sup-card">
      <dl class="detail-dl detail-dl--console">
        <dt>Full Name</dt><dd>${escapeHtml(user.displayName)}</dd>
        <dt>Username</dt><dd class="mono">${escapeHtml(user.username)}</dd>
        <dt>Email</dt><dd>${escapeHtml(user.email || `${user.username}@rms.local`)}</dd>
        <dt>Role</dt><dd>${escapeHtml(user.roleLabel)}</dd>
        <dt>Department</dt><dd>${escapeHtml(user.department || 'Administration')}</dd>
        <dt>Position</dt><dd>${escapeHtml(user.position || 'System Administrator')}</dd>
      </dl>
    </section>`;
  return adminPage('Profile', user, 'profile', body);
}

module.exports = {
  adminOverviewPage,
  usersPage,
  resetPasswordPage,
  departmentsPage,
  positionsPage,
  ticketsPage,
  ticketDetailPage,
  auditLogsPage,
  settingsPage,
  profilePage,
};
