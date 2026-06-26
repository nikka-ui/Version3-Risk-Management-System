const { escapeHtml } = require('../html');
const { FONT_LINKS, STYLESHEET_LINK } = require('./head');

const NAV_ITEMS = [
  { id: 'dashboard', href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { id: 'users', href: '/admin/users', label: 'User Management', icon: 'users' },
  { id: 'departments', href: '/admin/departments', label: 'Department Management', icon: 'departments' },
  { id: 'positions', href: '/admin/positions', label: 'Position Management', icon: 'positions' },
  { id: 'tickets', href: '/admin/tickets', label: 'Ticket Management', icon: 'tickets' },
  { id: 'audit', href: '/admin/audit-logs', label: 'Audit Logs', icon: 'audit' },
  { id: 'settings', href: '/admin/settings', label: 'System Settings', icon: 'settings' },
  { id: 'profile', href: '/admin/profile', label: 'Profile', icon: 'profile' },
];

function navIcon(name) {
  const icons = {
    dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    departments: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>`,
    positions: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
    tickets: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
    audit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`,
    settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
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

function adminAppLayout({ title, user, activeNav, body, stats = {} }) {
  const initial = String(user.displayName || user.username || 'A').trim().charAt(0).toUpperCase();
  const roleLabel = user.roleLabel || 'System Administrator';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — RMS</title>
  ${FONT_LINKS}
  ${STYLESHEET_LINK}
</head>
<body class="supervisor-shell admin-console">
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
    <nav class="supervisor-sidebar__nav" aria-label="Administrator navigation">
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
      <button type="submit" class="supervisor-sidebar__signout">Logout</button>
    </form>
  </aside>
  <div class="supervisor-content">
    <header class="console-topbar" aria-label="Page toolbar">
      <div class="console-topbar__title">${escapeHtml(title)}</div>
      <div class="console-topbar__actions">
        <span class="console-topbar__role-pill console-topbar__role-pill--admin">Administrator</span>
      </div>
    </header>
    <main class="supervisor-main">${body}</main>
  </div>
  <div id="appToast" class="upload-toast" role="status" aria-live="polite" aria-atomic="true" hidden></div>
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

module.exports = { adminAppLayout };
