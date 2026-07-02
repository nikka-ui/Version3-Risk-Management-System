const { escapeHtml } = require('../html');
const { FONT_LINKS, STYLESHEET_LINK } = require('./head');
const { notificationPanelHtml, NOTIFICATION_PANEL_SCRIPT } = require('./notification-ui');

const NAV_ITEMS = [
  { id: 'overview', href: '/supervisor', label: 'Dashboard', icon: 'overview' },
  { id: 'tickets', href: '/supervisor/tickets', label: 'My tickets', icon: 'tickets' },
  { id: 'new', href: '/supervisor/tickets/new', label: 'Create new ticket', icon: 'new' },
  { id: 'drafts', href: '/supervisor/drafts', label: 'Draft reports', icon: 'drafts', statKey: 'drafts' },
  { id: 'submitted', href: '/supervisor/submitted', label: 'Submitted reports', icon: 'submitted', statKey: 'submitted' },
  { id: 'returned', href: '/supervisor/returned', label: 'Returned reports', icon: 'returned', statKey: 'returned' },
  { id: 'accomplishments', href: '/supervisor/accomplishments', label: 'Accomplishment reports', icon: 'accomplishments' },
  { id: 'notifications', href: '/supervisor/notifications', label: 'Notifications', icon: 'notifications', statKey: 'unreadNotifications' },
  { id: 'profile', href: '/supervisor/profile', label: 'Profile', icon: 'profile' },
];

function navIcon(name) {
  const icons = {
    overview: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    tickets: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
    new: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
    drafts: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
    submitted: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`,
    returned: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
    accomplishments: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>`,
    notifications: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    profile: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
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

function supervisorAppLayout({ title, user, activeNav, body, stats = {}, notifications = [] }) {
  const initial = String(user.displayName || user.username || 'U').trim().charAt(0).toUpperCase();
  const roleLabel = user.roleLabel || 'Ticket Reporter';
  const notifHtml = notificationPanelHtml(notifications, { markAllReadAction: '/supervisor/notifications/read-all' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — RMS</title>
  ${FONT_LINKS}
  ${STYLESHEET_LINK}
</head>
<body class="supervisor-shell">
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
        <span class="supervisor-sidebar__role">${escapeHtml(roleLabel)}</span>
      </div>
    </div>
    <p class="supervisor-sidebar__section">Menu</p>
    <nav class="supervisor-sidebar__nav" aria-label="Ticket Reporter navigation">
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
        <span class="console-topbar__role-pill">${escapeHtml(roleLabel)}</span>
      </div>
    </header>
    <main class="supervisor-main">${body}</main>
  </div>
  <div id="appToast" class="upload-toast" role="status" aria-live="polite" aria-atomic="true" hidden></div>
  ${NOTIFICATION_PANEL_SCRIPT}
  <script>
    (function () {
      window.showAppToast = function (msg, type) {
        var el = document.getElementById('appToast');
        if (!el || !msg) return;
        el.textContent = msg;
        el.hidden = false;
        el.className = 'upload-toast upload-toast--' + (type || 'success') + ' upload-toast--visible';
        clearTimeout(window._appToastTimer);
        window._appToastTimer = setTimeout(function () {
          el.classList.remove('upload-toast--visible');
          setTimeout(function () { el.hidden = true; }, 320);
        }, 4500);
      };
    })();
  </script>
</body>
</html>`;
}

module.exports = { supervisorAppLayout };
