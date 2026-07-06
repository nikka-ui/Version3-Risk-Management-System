const { escapeHtml } = require('../html');
const { FONT_LINKS, STYLESHEET_LINK } = require('./head');
const { notificationPanelHtml, NOTIFICATION_PANEL_SCRIPT } = require('./notification-ui');
const { FLASH_AUTO_DISMISS_SCRIPT } = require('./layout');

const NAV_ITEMS = [
  { id: 'dashboard', href: '/dept', label: 'Dashboard', icon: 'dashboard' },
  { id: 'inbox', href: '/dept/inbox', label: 'Ownership inbox', icon: 'inbox', statKey: 'inbox' },
  { id: 'active', href: '/dept/active', label: 'In progress', icon: 'active', statKey: 'active' },
  { id: 'tickets', href: '/dept/tickets', label: 'All department tickets', icon: 'reports' },
];

function navIcon(name) {
  const icons = {
    dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    inbox: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    active: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
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
        ? `<span class="supervisor-sidebar__badge" aria-label="${count} pending">${count}</span>`
        : '';
    return `<a href="${item.href}" class="supervisor-sidebar__link${active}">
      <span class="supervisor-sidebar__icon">${navIcon(item.icon)}</span>
      <span class="supervisor-sidebar__label">${escapeHtml(item.label)}</span>
      ${badge}
    </a>`;
  }).join('');
}

function deptHeadAppLayout({ title, user, activeNav, body, stats = {}, notifications = [] }) {
  const initial = String(user.displayName || user.username || 'U').trim().charAt(0).toUpperCase();
  const notifHtml = notificationPanelHtml(notifications, { markAllReadAction: '/dept/notifications/read-all' });
  const deptLabel = user.department ? escapeHtml(user.department) : 'Department';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — RMS</title>
  ${FONT_LINKS}
  ${STYLESHEET_LINK}
</head>
<body class="supervisor-shell officer-console dept-head-console">
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
        <span class="supervisor-sidebar__role">Department Head · ${deptLabel}</span>
      </div>
    </div>
    <p class="supervisor-sidebar__section">Menu</p>
    <nav class="supervisor-sidebar__nav" aria-label="Department Head navigation">
      ${sidebarNav(activeNav, stats)}
    </nav>
    <div class="supervisor-sidebar__user">
      <span class="supervisor-sidebar__avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <div class="supervisor-sidebar__user-meta">
        <span class="supervisor-sidebar__user-name">${escapeHtml(user.displayName || user.username)}</span>
        <span class="supervisor-sidebar__user-email">${escapeHtml(user.position || user.department || 'Department Head')}</span>
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
        <span class="console-topbar__role-pill">Department Head / VP</span>
      </div>
    </header>
    <main class="supervisor-main">${body}</main>
  </div>
  ${NOTIFICATION_PANEL_SCRIPT}
  ${FLASH_AUTO_DISMISS_SCRIPT}
</body>
</html>`;
}

module.exports = { deptHeadAppLayout };
