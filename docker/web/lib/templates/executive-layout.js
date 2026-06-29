const { escapeHtml } = require('../html');
const { FONT_LINKS, STYLESHEET_LINK } = require('./head');
const { notificationPanelHtml, NOTIFICATION_PANEL_SCRIPT } = require('./notification-ui');

const NAV_ITEMS = [
  { id: 'overview', href: '/executive', label: 'Dashboard', icon: 'dashboard' },
  { id: 'critical', href: '/executive/critical', label: 'Critical risks', icon: 'critical', statKey: 'criticalCount' },
  { id: 'tickets', href: '/executive/tickets', label: 'All reports', icon: 'reports' },
];

function navIcon(name) {
  const icons = {
    dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    critical: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    reports: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
  };
  return icons[name] || '';
}

function sidebarNav(activeNav, stats = {}) {
  return NAV_ITEMS.map((item) => {
    const active = activeNav === item.id ? ' supervisor-sidebar__link--active' : '';
    const count = item.statKey ? Number(stats[item.statKey] || 0) : 0;
    const badge =
      count > 0
        ? `<span class="supervisor-sidebar__badge supervisor-sidebar__badge--critical" aria-label="${count} critical">${count}</span>`
        : '';
    return `<a href="${item.href}" class="supervisor-sidebar__link${active}">
      <span class="supervisor-sidebar__icon">${navIcon(item.icon)}</span>
      <span class="supervisor-sidebar__label">${escapeHtml(item.label)}</span>
      ${badge}
    </a>`;
  }).join('');
}

function executiveAppLayout({ title, user, activeNav, body, stats = {}, notifications = [] }) {
  const initial = String(user.displayName || user.username || 'U').trim().charAt(0).toUpperCase();
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
        <span class="supervisor-sidebar__role">Executive</span>
      </div>
    </div>
    <p class="supervisor-sidebar__section">Menu</p>
    <nav class="supervisor-sidebar__nav" aria-label="Executive navigation">
      ${sidebarNav(activeNav, stats)}
    </nav>
    <div class="supervisor-sidebar__user">
      <span class="supervisor-sidebar__avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <div class="supervisor-sidebar__user-meta">
        <span class="supervisor-sidebar__user-name">${escapeHtml(user.displayName || user.username)}</span>
        <span class="supervisor-sidebar__user-email">${escapeHtml(user.username)}</span>
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
        <span class="console-topbar__role-pill console-topbar__role-pill--executive">Executive</span>
      </div>
    </header>
    <main class="supervisor-main">${body}</main>
  </div>
  ${NOTIFICATION_PANEL_SCRIPT}
</body>
</html>`;
}

module.exports = { executiveAppLayout };
