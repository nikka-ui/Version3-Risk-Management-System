const { escapeHtml } = require('../html');
const { FONT_LINKS, STYLESHEET_LINK } = require('./head');

function appLayout({ title, user, activeNav, body, wide = false, navVariant }) {
  const isAdmin = user.role === 'admin' || navVariant === 'admin';
  const isSupervisor = user.role === 'supervisor' || navVariant === 'supervisor';
  const isOfficer = user.role === 'rm_officer' || navVariant === 'officer';
  const isExecutive = user.role === 'executive' || navVariant === 'executive';
  let nav;
  if (isAdmin) {
    nav = adminNav(activeNav);
  } else if (isSupervisor) {
    nav = supervisorNav(activeNav);
  } else if (isOfficer) {
    nav = officerNav(activeNav);
  } else if (isExecutive) {
    nav = executiveNav(activeNav);
  } else {
    nav = `<nav class="app-nav"><a href="/dashboard" class="${activeNav === 'home' ? 'active' : ''}">Overview</a></nav>`;
  }
  const hasSidebar = isAdmin || isSupervisor || isOfficer || isExecutive;
  const shellClass = hasSidebar ? 'app-shell app-shell--admin' : 'app-shell';
  const bodyClass = hasSidebar ? 'app-body app-body--admin' : 'app-body';
  const homeHref = isAdmin
    ? '/admin'
    : isSupervisor
      ? '/supervisor'
      : isOfficer
        ? '/officer'
        : isExecutive
          ? '/executive'
          : '/dashboard';
  const initial = String(user.displayName || user.username || 'U').trim().charAt(0).toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — RMS</title>
  ${FONT_LINKS}
  ${STYLESHEET_LINK}
</head>
<body class="${shellClass}">
  <header class="app-header">
    <a href="${homeHref}" class="app-logo">RMS</a>
    <div class="app-user">
      <button type="button" class="notif-btn" aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 8C18 5.23858 15.7614 3 13 3H11C8.23858 3 6 5.23858 6 8V11.3824C6 12.0366 5.73661 12.6643 5.27114 13.1297L4.58579 13.8149C4.21623 14.1844 4.47577 14.8 5 14.8H19C19.5242 14.8 19.7838 14.1844 19.4142 13.8149L18.7289 13.1297C18.2634 12.6643 18 12.0366 18 11.3824V8Z" stroke="#476C9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 18C10.5 19 11.5 20 12 20C12.5 20 13.5 19 14 18" stroke="#476C9B" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="notif-dot" aria-hidden="true"></span>
      </button>
      <div class="profile">
        <span class="profile-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
        <span class="profile-name">${escapeHtml(user.displayName)}</span>
      </div>
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

function officerNav(active) {
  const items = [
    { id: 'overview', href: '/officer', label: 'Overview' },
    { id: 'register', href: '/officer/tickets', label: 'Risk register' },
    { id: 'overdue', href: '/officer/overdue', label: 'Overdue & SLA' },
    { id: 'action-plans', href: '/officer/action-plans', label: 'Action plans' },
    { id: 'monitoring', href: '/officer/monitoring', label: 'Monitoring' },
  ];
  const links = items
    .map(
      (i) =>
        `<a href="${i.href}" class="${active === i.id ? 'active' : ''}">${escapeHtml(i.label)}</a>`,
    )
    .join('');
  return `<nav class="app-nav app-nav--admin">${links}</nav>`;
}

function executiveNav(active) {
  const items = [
    { id: 'overview', href: '/executive', label: 'Dashboard' },
    { id: 'heatmap', href: '/executive/heatmap', label: 'Heatmap' },
    { id: 'register', href: '/executive/register', label: 'Risk Register' },
    { id: 'reports', href: '/executive/reports', label: 'Reports' },
    { id: 'trends', href: '/executive/trends', label: 'Trends' },
    { id: 'statistics', href: '/executive/statistics', label: 'Statistics' },
    { id: 'departments', href: '/executive/departments', label: 'Department Performance' },
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
  const cls =
    type === 'error'
      ? 'flash flash--error flash--auto-dismiss'
      : 'flash flash--success flash--auto-dismiss';
  return `<div class="${cls}" role="status">${escapeHtml(msg)}</div>`;
}

const FLASH_AUTO_DISMISS_SCRIPT = `<script>
(function () {
  var DISMISS_MS = 5000;
  function dismissFlash(el) {
    if (!el || el.classList.contains('flash--dismissing')) return;
    el.classList.add('flash--dismissing');
    window.setTimeout(function () { el.remove(); }, 400);
  }
  document.querySelectorAll('.flash--auto-dismiss').forEach(function (el) {
    window.setTimeout(function () { dismissFlash(el); }, DISMISS_MS);
  });
})();
</script>`;

const { renderRedditThread, redditPostForm, REDDIT_THREAD_SCRIPT } = require('./thread-discussion');

/**
 * Shared comments / suggestions thread for a ticket (RMS flowchart: Audit
 * Officer and RMO can comment on a risk report). Pass `postAction` to render an
 * "add comment" form; omit it for a read-only thread.
 */
function commentsSection(comments, { postAction, placeholder, compact, wrapClass, enabled = true } = {}) {
  if (!enabled) return '';

  const thread = renderRedditThread(comments, {
    emptyMessage: 'No comments yet.',
    canPost: false,
    canReply: false,
  });

  const form = postAction
    ? redditPostForm('audit-comment', {
        postAction,
        canPost: true,
        label: compact ? 'Add comment' : 'Add comment / suggestion',
        placeholder: placeholder || 'Write a comment or suggestion about this risk report…',
        showAttachments: false,
        submitLabel: compact ? 'Post' : 'Post comment',
        formClass: `reddit-compose${compact ? ' reddit-compose--compact' : ''}`,
      })
    : '';

  const cardClass = ['card', wrapClass, compact ? 'card--compact' : ''].filter(Boolean).join(' ');
  const hint = compact
    ? '<p class="text-muted section-hint">Private — not visible to department.</p>'
    : '<p class="text-muted section-hint">Not visible to the Department Supervisor.</p>';

  return `<section class="${cardClass}">
    <h2>Private comments</h2>
    ${hint}
    <div class="${compact ? 'reddit-thread--scroll' : ''}">${thread}</div>
    ${form}
    ${REDDIT_THREAD_SCRIPT}
  </section>`;
}

/**
 * Executive oversight thread — top-level executive comments with officer replies.
 */
function executiveCommentsSection(comments, { postAction, replyAction, canPost, canReply, compact, enabled = true, hint } = {}) {
  if (!enabled) return '';

  const thread = renderRedditThread(comments, {
    postAction,
    replyAction,
    canPost: !!canReply,
    canReply: !!canReply,
    executive: true,
    replyLabel: 'Reply to executive',
    replyPlaceholder: 'Write your reply to the executive comment…',
    emptyMessage: 'No executive or presidential comments yet.',
  });

  const postForm = canPost && postAction
    ? redditPostForm('executive-comment', {
        postAction,
        canPost: true,
        label: compact ? 'Add comment' : 'Add executive comment',
        placeholder: 'Share oversight guidance on this risk report…',
        showAttachments: false,
        submitLabel: compact ? 'Post' : 'Post comment',
        formClass: `reddit-compose${compact ? ' reddit-compose--compact' : ''}`,
      })
    : '';

  const cardClass = ['card', 'card--executive-comments', compact ? 'card--compact' : ''].filter(Boolean).join(' ');
  const hintHtml = hint !== undefined
    ? hint
    : '<p class="text-muted section-hint">Visible to the Risk Governance Office (RMU) and Department Head. Not visible to the ticket reporter.</p>';

  return `<section class="${cardClass}">
    <h2>Executive &amp; President comments</h2>
    ${hintHtml}
    <div class="${compact ? 'reddit-thread--scroll' : ''}">${thread}</div>
    ${postForm}
    ${REDDIT_THREAD_SCRIPT}
  </section>`;
}

module.exports = { appLayout, flashMessage, FLASH_AUTO_DISMISS_SCRIPT, commentsSection, executiveCommentsSection };
