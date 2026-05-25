const { escapeHtml } = require('../html');
const { FONT_LINKS } = require('./head');

function appLayout({ title, user, activeNav, body, wide = false, navVariant }) {
  const isAdmin = user.role === 'admin' || navVariant === 'admin';
  const isSupervisor = user.role === 'supervisor' || navVariant === 'supervisor';
  let nav;
  if (isAdmin) {
    nav = adminNav(activeNav);
  } else if (isSupervisor) {
    nav = supervisorNav(activeNav);
  } else {
    nav = `<nav class="app-nav"><a href="/dashboard" class="${activeNav === 'home' ? 'active' : ''}">Overview</a></nav>`;
  }
  const shellClass = isAdmin || isSupervisor ? 'app-shell app-shell--admin' : 'app-shell';
  const bodyClass = isAdmin || isSupervisor ? 'app-body app-body--admin' : 'app-body';
  const homeHref = isAdmin ? '/admin' : isSupervisor ? '/supervisor' : '/dashboard';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — RMS</title>
  ${FONT_LINKS}
  <link rel="stylesheet" href="/css/app.css">
</head>
<body class="${shellClass}">
  <header class="app-header">
    <a href="${homeHref}" class="app-logo">RMS</a>
    <div class="app-user">
      <span>${escapeHtml(user.displayName)}</span>
      <form class="inline" method="post" action="/logout">
        <button type="submit" class="btn-text">Sign out</button>
      </form>
    </div>
  </header>
  <div class="${bodyClass}">
    <aside class="app-sidebar">${nav}</aside>
    <main class="app-main ${wide ? 'app-main--wide' : ''}">${body}</main>
  </div>
</body>
</html>`;
}

function supervisorNav(active) {
  const items = [
    { id: 'overview', href: '/supervisor', label: 'Overview' },
    { id: 'tickets', href: '/supervisor/tickets', label: 'My tickets' },
    { id: 'new', href: '/supervisor/tickets/new', label: 'New report' },
    { id: 'actions', href: '/supervisor/actions', label: 'Action required' },
    { id: 'accomplishments', href: '/supervisor/accomplishments', label: 'Accomplishments' },
  ];
  const links = items
    .map(
      (i) =>
        `<a href="${i.href}" class="${active === i.id ? 'active' : ''}">${escapeHtml(i.label)}</a>`,
    )
    .join('');
  return `<nav class="app-nav app-nav--admin">${links}</nav>`;
}

function adminNav(active) {
  const items = [
    { id: 'overview', href: '/admin', label: 'Overview' },
    { id: 'accounts', href: '/admin/accounts', label: 'Accounts' },
    { id: 'credentials', href: '/admin/logs/credentials', label: 'Credentials log' },
    { id: 'reports', href: '/admin/logs/reports', label: 'Report history' },
  ];
  const links = items
    .map(
      (i) =>
        `<a href="${i.href}" class="${active === i.id ? 'active' : ''}">${escapeHtml(i.label)}</a>`,
    )
    .join('');
  return `<nav class="app-nav app-nav--admin">${links}</nav>`;
}

function flashMessage(msg, type = 'success') {
  if (!msg) return '';
  const cls = type === 'error' ? 'flash flash--error' : 'flash flash--success';
  return `<div class="${cls}" role="status">${escapeHtml(msg)}</div>`;
}

module.exports = { appLayout, flashMessage };
