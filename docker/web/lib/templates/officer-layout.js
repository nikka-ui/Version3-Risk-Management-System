const { escapeHtml } = require('../html');
const { FONT_LINKS } = require('./head');

const NAV_ITEMS = [
  {
    id: 'dashboard',
    href: '/officer',
    label: 'Dashboard',
    icon: 'dashboard',
    color: '#3b82f6',
  },
  {
    id: 'reports',
    href: '/officer/tickets',
    label: 'Risk Reports',
    icon: 'reports',
    color: '#22c55e',
  },
  {
    id: 'final',
    href: '/officer/final-validation',
    label: 'Final Validation',
    icon: 'final',
    color: '#ec4899',
  },
  {
    id: 'monitoring',
    href: '/officer/monitoring',
    label: 'Monitoring',
    icon: 'monitoring',
    color: '#eab308',
  },
];

function navIcon(name) {
  const icons = {
    dashboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>`,
    reports: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/></svg>`,
    final: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
    monitoring: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
    review: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    tickets: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
  };
  return icons[name] || '';
}

function sidebarNav(activeNav) {
  return NAV_ITEMS.map((item) => {
    const active = activeNav === item.id ? ' officer-sidebar__link--active' : '';
    return `<a href="${item.href}" class="officer-sidebar__link${active}">
      <span class="officer-sidebar__icon">${navIcon(item.icon)}</span>
      <span class="officer-sidebar__label">${escapeHtml(item.label)}</span>
    </a>`;
  }).join('');
}

function officerAppLayout({ title, user, activeNav, body }) {
  const initial = String(user.displayName || user.username || 'U').trim().charAt(0).toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Risk Management System</title>
  ${FONT_LINKS}
  <link rel="stylesheet" href="/css/app.css">
</head>
<body class="officer-shell">
  <aside class="officer-sidebar">
    <div class="officer-sidebar__brand">
      <div class="officer-sidebar__logo" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="8" fill="#B7DBE1"/>
          <path d="M16 6L24 10V16C24 21 20 24.5 16 26C12 24.5 8 21 8 16V10L16 6Z" stroke="#201C21" stroke-width="1.75" stroke-linejoin="round"/>
          <path d="M12 15L15 18L20 13" stroke="#201C21" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="officer-sidebar__titles">
        <span class="officer-sidebar__system">RISK MANAGEMENT SYSTEM</span>
      </div>
    </div>
    <p class="officer-sidebar__greeting">Welcome, Risk Management Officer!</p>
    <nav class="officer-sidebar__nav" aria-label="Main navigation">
      ${sidebarNav(activeNav)}
    </nav>
    <div class="officer-sidebar__user">
      <span class="officer-sidebar__avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <div class="officer-sidebar__user-meta">
        <span class="officer-sidebar__user-name">${escapeHtml(user.displayName || user.username)}</span>
        <form class="inline" method="post" action="/logout">
          <button type="submit" class="officer-sidebar__signout">Sign out</button>
        </form>
      </div>
    </div>
  </aside>
  <main class="officer-main">${body}</main>
</body>
</html>`;
}

module.exports = { officerAppLayout };
