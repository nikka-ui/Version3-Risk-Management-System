const { escapeHtml, formatDate } = require('../html');
const { FONT_LINKS } = require('./head');

function appLayout({ title, user, activeNav, body, wide = false, navVariant }) {
  const isAdmin = user.role === 'admin' || navVariant === 'admin';
  const isSupervisor = user.role === 'supervisor' || navVariant === 'supervisor';
  const isOfficer = user.role === 'rm_officer' || navVariant === 'officer';
  const isAudit = user.role === 'audit_officer' || navVariant === 'audit';
  const isExecutive = user.role === 'executive' || navVariant === 'executive';
  let nav;
  if (isAdmin) {
    nav = adminNav(activeNav);
  } else if (isSupervisor) {
    nav = supervisorNav(activeNav);
  } else if (isOfficer) {
    nav = officerNav(activeNav);
  } else if (isAudit) {
    nav = auditNav(activeNav);
  } else if (isExecutive) {
    nav = executiveNav(activeNav);
  } else {
    nav = `<nav class="app-nav"><a href="/dashboard" class="${activeNav === 'home' ? 'active' : ''}">Overview</a></nav>`;
  }
  const hasSidebar = isAdmin || isSupervisor || isOfficer || isAudit || isExecutive;
  const shellClass = hasSidebar ? 'app-shell app-shell--admin' : 'app-shell';
  const bodyClass = hasSidebar ? 'app-body app-body--admin' : 'app-body';
  const homeHref = isAdmin
    ? '/admin'
    : isSupervisor
      ? '/supervisor'
      : isOfficer
        ? '/officer'
        : isAudit
          ? '/audit'
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
  <link rel="stylesheet" href="/css/app.css">
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
    { id: 'review', href: '/officer/review', label: 'Review queue' },
    { id: 'final', href: '/officer/final-validation', label: 'Final validation' },
    { id: 'monitoring', href: '/officer/monitoring', label: 'Monitoring' },
    { id: 'tickets', href: '/officer/tickets', label: 'All tickets' },
  ];
  const links = items
    .map(
      (i) =>
        `<a href="${i.href}" class="${active === i.id ? 'active' : ''}">${escapeHtml(i.label)}</a>`,
    )
    .join('');
  return `<nav class="app-nav app-nav--admin">${links}</nav>`;
}

function auditNav(active) {
  const items = [
    { id: 'overview', href: '/audit', label: 'Overview' },
    { id: 'review', href: '/audit/review', label: 'Audit queue' },
    { id: 'tickets', href: '/audit/tickets', label: 'All tickets' },
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
    { id: 'overview', href: '/executive', label: 'Overview' },
    { id: 'critical', href: '/executive/critical', label: 'Critical risks' },
    { id: 'tickets', href: '/executive/tickets', label: 'All reports' },
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

/**
 * Shared comments / suggestions thread for a ticket (RMS flowchart: Audit
 * Officer and RMO can comment on a risk report). Pass `postAction` to render an
 * "add comment" form; omit it for a read-only thread.
 */
function commentsSection(comments, { postAction, placeholder, compact, wrapClass } = {}) {
  const items = (comments || []).length
    ? comments
        .map(
          (c) => `<li class="comment">
            <div class="comment-meta">
              <span class="comment-author">${escapeHtml(c.authorName || c.authorUsername)}</span>
              <span class="comment-role">${escapeHtml(c.roleLabel || c.authorRole)}</span>
              <span class="comment-time">${escapeHtml(formatDate(c.at))}</span>
            </div>
            <p class="comment-body">${escapeHtml(c.body)}</p>
          </li>`,
        )
        .join('')
    : '<li class="comment comment--empty text-muted">No comments yet.</li>';

  const form = postAction
    ? `<form method="post" action="${postAction}" class="stack-form comment-form${compact ? ' comment-form--compact' : ''}">
        <div class="field">
          <label for="comment">${compact ? 'Add comment' : 'Add comment / suggestion'}</label>
          <textarea id="comment" name="comment" rows="${compact ? 2 : 3}" required placeholder="${escapeHtml(
            placeholder || 'Write a comment or suggestion about this risk report…',
          )}"></textarea>
        </div>
        <button type="submit" class="btn-primary btn-primary--auto">${compact ? 'Post' : 'Post comment'}</button>
      </form>`
    : '';

  const cardClass = ['card', wrapClass, compact ? 'card--compact' : ''].filter(Boolean).join(' ');
  const hint = compact
    ? '<p class="text-muted section-hint">Private — not visible to department.</p>'
    : '<p class="text-muted section-hint">Not visible to the Department Supervisor.</p>';

  return `<section class="${cardClass}">
    <h2>${postAction ? 'Private comments' : 'Private comments'}</h2>
    ${hint}
    <ul class="comment-list${compact ? ' comment-list--scroll' : ''}">${items}</ul>
    ${form}
  </section>`;
}

/**
 * Executive oversight thread — top-level executive comments with officer replies.
 */
function executiveCommentsSection(comments, { postAction, replyAction, canPost, canReply, compact } = {}) {
  const all = comments || [];
  const tops = all.filter((c) => !c.parentId);

  const renderComment = (c, { isReply } = {}) => {
    const roleCls = c.authorRole === 'executive' ? ' comment--executive' : '';
    const replyForm = canReply && replyAction && !isReply
      ? `<form method="post" action="${replyAction}" class="stack-form comment-form comment-form--reply">
          <input type="hidden" name="parentId" value="${escapeHtml(c.id)}">
          <div class="field">
            <label for="reply-${escapeHtml(c.id)}">Reply to executive</label>
            <textarea id="reply-${escapeHtml(c.id)}" name="comment" rows="2" required placeholder="Write your reply to the executive comment…"></textarea>
          </div>
          <button type="submit" class="btn-primary btn-primary--auto">Post reply</button>
        </form>`
      : '';

    const replies = all
      .filter((r) => r.parentId === c.id)
      .map((r) => renderComment(r, { isReply: true }))
      .join('');

    return `<li class="comment${roleCls}${isReply ? ' comment--reply' : ''}">
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(c.authorName || c.authorUsername)}</span>
        <span class="comment-role">${escapeHtml(c.roleLabel || c.authorRole)}</span>
        <span class="comment-time">${escapeHtml(formatDate(c.at))}</span>
      </div>
      <p class="comment-body">${escapeHtml(c.body)}</p>
      ${replyForm}
      ${replies ? `<ul class="comment-list comment-list--replies">${replies}</ul>` : ''}
    </li>`;
  };

  const items = tops.length
    ? tops.map((c) => renderComment(c)).join('')
    : '<li class="comment comment--empty text-muted">No executive comments yet.</li>';

  const postForm = canPost && postAction
    ? `<form method="post" action="${postAction}" class="stack-form comment-form${compact ? ' comment-form--compact' : ''}">
        <div class="field">
          <label for="executive-comment">${compact ? 'Add comment' : 'Add executive comment'}</label>
          <textarea id="executive-comment" name="comment" rows="${compact ? 2 : 3}" required placeholder="Share oversight guidance on this risk report…"></textarea>
        </div>
        <button type="submit" class="btn-primary btn-primary--auto">${compact ? 'Post' : 'Post comment'}</button>
      </form>`
    : '';

  const cardClass = ['card', 'card--executive-comments', compact ? 'card--compact' : ''].filter(Boolean).join(' ');

  return `<section class="${cardClass}">
    <h2>Executive oversight comments</h2>
    <p class="text-muted section-hint">Visible to the RMO and Audit Officer, who may reply. Not visible to the Department Supervisor.</p>
    <ul class="comment-list${compact ? ' comment-list--scroll' : ''}">${items}</ul>
    ${postForm}
  </section>`;
}

module.exports = { appLayout, flashMessage, commentsSection, executiveCommentsSection };
