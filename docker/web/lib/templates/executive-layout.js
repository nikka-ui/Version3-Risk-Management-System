const { escapeHtml } = require('../html');
const { findUserRecord } = require('../store');
const { getRoleLabel } = require('../../config/roles');
const { FONT_LINKS, STYLESHEET_LINK } = require('./head');
const { notificationPanelHtml, NOTIFICATION_PANEL_SCRIPT } = require('./notification-ui');

const NAV_ITEMS = [
  { id: 'overview', href: '/executive', label: 'Dashboard', icon: 'dashboard' },
  { id: 'heatmap', href: '/executive/heatmap', label: 'Heatmap', icon: 'heatmap' },
  { id: 'reports', href: '/executive/reports', label: 'Reports', icon: 'reports' },
  { id: 'trends', href: '/executive/trends', label: 'Trends', icon: 'trends' },
  { id: 'statistics', href: '/executive/statistics', label: 'Statistics', icon: 'statistics' },
  { id: 'departments', href: '/executive/departments', label: 'Department Performance', icon: 'departments' },
];

function navIcon(name) {
  const icons = {
    dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    heatmap: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    register: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
    reports: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
    trends: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    statistics: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    departments: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>`,
  };
  return icons[name] || '';
}

function sidebarNav(activeNav, stats = {}) {
  return NAV_ITEMS.map((item) => {
    const active = activeNav === item.id ? ' supervisor-sidebar__link--active' : '';
    const count = item.statKey ? Number(stats[item.statKey] || 0) : 0;
    const badge =
      count > 0 && item.id === 'register'
        ? `<span class="supervisor-sidebar__badge" aria-label="${count} reports">${count}</span>`
        : '';
    return `<a href="${item.href}" class="supervisor-sidebar__link${active}">
      <span class="supervisor-sidebar__icon">${navIcon(item.icon)}</span>
      <span class="supervisor-sidebar__label">${escapeHtml(item.label)}</span>
      ${badge}
    </a>`;
  }).join('');
}

function executiveAppLayout({ title, user, activeNav, body, stats = {}, notifications = [] }) {
  const profile = findUserRecord(user.username) || user;
  const displayName = profile.displayName || user.displayName || user.username;
  const roleLine = getRoleLabel(user.role || profile.role) || user.roleLabel || 'Executive Committee';
  const initial = String(displayName || 'U').trim().charAt(0).toUpperCase();
  const notifHtml = notificationPanelHtml(notifications, { markAllReadAction: '/executive/notifications/read-all' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — RMS</title>
  ${FONT_LINKS}
  ${STYLESHEET_LINK}
</head>
<body class="supervisor-shell executive-console">
  <aside class="supervisor-sidebar">
    <div class="supervisor-sidebar__brand">
      <div class="supervisor-sidebar__logo" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="8" fill="#2563eb"/>
          <path d="M16 7L23 11V17C23 21.5 19.5 24.5 16 26C12.5 24.5 9 21.5 9 17V11L16 7Z" stroke="#fff" stroke-width="1.75" stroke-linejoin="round"/>
          <path d="M12 16L15 19L20 14" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="supervisor-sidebar__titles">
        <span class="supervisor-sidebar__system">Risk Management</span>
        <span class="supervisor-sidebar__role">Executive Committee</span>
      </div>
    </div>
    <p class="supervisor-sidebar__section">Menu</p>
    <nav class="supervisor-sidebar__nav" aria-label="Executive Committee navigation">
      ${sidebarNav(activeNav, stats)}
    </nav>
    <div class="supervisor-sidebar__user">
      <span class="supervisor-sidebar__avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <div class="supervisor-sidebar__user-meta">
        <span class="supervisor-sidebar__user-name">${escapeHtml(displayName)}</span>
        <span class="supervisor-sidebar__user-title">${escapeHtml(roleLine)}</span>
      </div>
    </div>
    <form class="supervisor-sidebar__logout" method="post" action="/logout">
      <button type="submit" class="supervisor-sidebar__signout">Sign out</button>
    </form>
  </aside>
  <div class="supervisor-content">
    <header class="console-topbar" aria-label="Page toolbar">
      <div class="console-topbar__title">${escapeHtml(title)}</div>
      <div class="console-topbar__actions">
        ${notifHtml}
        <span class="console-topbar__role-pill console-topbar__role-pill--executive">View only</span>
      </div>
    </header>
    <main class="supervisor-main">${body}</main>
  </div>
  ${NOTIFICATION_PANEL_SCRIPT}
</body>
</html>`;
}

module.exports = { executiveAppLayout };
