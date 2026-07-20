const { escapeHtml, formatDate, formatRelativeTime } = require('../html');

const REACTION_OPTIONS = ['👍', '❤️', '🎉', '👀'];

const AVATAR_COLORS = [
  '#ff4500', '#7193ff', '#46d160', '#ffb000', '#ff66ac', '#7c53c3', '#24a0ed', '#898989',
];

function avatarInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] || '?').slice(0, 2).toUpperCase();
}

function avatarColor(seed) {
  let hash = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function highlightMentions(text) {
  return escapeHtml(text);
}

function renderReactions(comment, { reactAction } = {}) {
  const reactions = comment.reactions || {};
  const entries = Object.entries(reactions).filter(([, users]) => users?.length);
  const buttons = reactAction
    ? REACTION_OPTIONS.map((emoji) => {
        const active = (reactions[emoji] || []).includes('self');
        return `<form method="post" action="${escapeHtml(reactAction)}" class="inline-form reaction-form">
          <input type="hidden" name="commentId" value="${escapeHtml(comment.id)}">
          <input type="hidden" name="reaction" value="${escapeHtml(emoji)}">
          <button type="submit" class="reddit-action-btn reddit-action-btn--react${active ? ' is-active' : ''}" title="React with ${emoji}">${emoji}</button>
        </form>`;
      }).join('')
    : '';

  const summary = entries.length
    ? entries
        .map(([emoji, users]) => `<span class="reaction-pill" title="${users.length} reaction(s)">${emoji} ${users.length}</span>`)
        .join('')
    : '';

  return summary || buttons
    ? `<div class="reddit-reactions">${summary}${buttons}</div>`
    : '';
}

function renderAttachments(attachments = []) {
  if (!attachments.length) return '';
  const items = attachments
    .map((a) => `<li><a href="${escapeHtml(a.href || '#')}" target="_blank" rel="noopener">${escapeHtml(a.name || 'Attachment')}</a></li>`)
    .join('');
  return `<ul class="reddit-attachments">${items}</ul>`;
}

function kindTag(c) {
  if (c.kind === 'reassignment') return '<span class="reddit-tag reddit-tag--reassign">Reassignment</span>';
  if (c.kind === 'system') return '<span class="reddit-tag reddit-tag--system">System</span>';
  return '';
}

function renderRedditComment(c, comments, opts, { isReply, depth = 0 } = {}) {
  const {
    postAction,
    replyAction,
    editAction,
    reactAction,
    canPost = true,
    canReply = true,
    canReact = true,
    canEditOwn = false,
    currentUsername,
    replyLabel = 'Reply',
    replyPlaceholder = 'Write a reply…',
    executive = false,
  } = opts;

  const effectivePostAction = replyAction || postAction;
  const authorName = c.authorName || c.authorUsername || 'Unknown';
  const initials = avatarInitials(authorName);
  const color = avatarColor(c.authorUsername || authorName);
  const fullTime = formatDate(c.at);
  const relTime = formatRelativeTime(c.at);

  const childReplies = comments.filter((r) => r.parentId === c.id);
  const children = childReplies
    .map((r) => renderRedditComment(r, comments, opts, { isReply: true, depth: depth + 1 }))
    .join('');

  const edited = c.editedAt
    ? `<span class="reddit-edited" title="Edited ${escapeHtml(formatDate(c.editedAt))}">(edited)</span>`
    : '';

  const roleBadge = c.authorPosition || c.roleLabel || c.authorRole
    ? `<span class="reddit-role">${escapeHtml(c.authorPosition || c.roleLabel || c.authorRole)}</span>`
    : '';

  const replyForm = !isReply && canReply && canPost && effectivePostAction
    ? `<details class="reddit-reply-box">
        <summary class="reddit-action-btn">${escapeHtml(replyLabel)}</summary>
        <form method="post" action="${escapeHtml(effectivePostAction)}" class="stack-form reddit-reply-form">
          <input type="hidden" name="parentId" value="${escapeHtml(c.id)}">
          <div class="field">
            <label class="visually-hidden" for="reply-${escapeHtml(c.id)}">${escapeHtml(replyLabel)}</label>
            <textarea id="reply-${escapeHtml(c.id)}" name="comment" rows="3" required placeholder="${escapeHtml(replyPlaceholder)}"></textarea>
          </div>
          <button type="submit" class="btn-outline btn-primary--auto">${escapeHtml(replyLabel)}</button>
        </form>
      </details>`
    : '';

  const editForm = canEditOwn && editAction && currentUsername && c.authorUsername === currentUsername && c.kind === 'comment'
    ? `<details class="reddit-edit-box">
        <summary class="reddit-action-btn">Edit</summary>
        <form method="post" action="${escapeHtml(editAction)}" class="stack-form reddit-reply-form">
          <input type="hidden" name="commentId" value="${escapeHtml(c.id)}">
          <div class="field">
            <textarea name="comment" rows="3" required>${escapeHtml(c.body)}</textarea>
          </div>
          <button type="submit" class="btn-outline btn-primary--auto">Save edit</button>
        </form>
      </details>`
    : '';

  const eventCls = c.kind && c.kind !== 'comment' ? ' reddit-comment--event' : '';
  const executiveCls = (executive || ['executive', 'president'].includes(c.authorRole))
    ? ' reddit-comment--executive'
    : '';

  const reactionBar = canReact ? renderReactions(c, { reactAction }) : '';
  const reactions = reactionBar
    ? `<details class="reddit-react-box">
        <summary class="reddit-action-btn">React</summary>
        ${reactionBar}
      </details>`
    : '';

  return `<div class="reddit-comment${eventCls}${executiveCls}" id="comment-${escapeHtml(c.id)}" data-depth="${depth}">
    <div class="reddit-comment__rail">
      <button type="button" class="reddit-collapse-btn" data-reddit-collapse aria-label="Collapse thread" title="Collapse">−</button>
    </div>
    <div class="reddit-comment__main">
      <header class="reddit-comment__header">
        <span class="reddit-avatar" style="background:${color}" aria-hidden="true">${escapeHtml(initials)}</span>
        <span class="reddit-author">${escapeHtml(authorName)}</span>
        ${roleBadge}
        ${kindTag(c)}
        <span class="reddit-sep" aria-hidden="true">·</span>
        <time class="reddit-time" datetime="${escapeHtml(c.at || '')}" title="${escapeHtml(fullTime)}">${escapeHtml(relTime)}</time>
        ${edited}
      </header>
      <div class="reddit-body">${highlightMentions(c.body)}</div>
      ${renderAttachments(c.attachments)}
      <div class="reddit-actions">
        ${reactions}
        ${replyForm}
        ${editForm}
      </div>
      ${children ? `<div class="reddit-comment__children">${children}</div>` : ''}
    </div>
  </div>`;
}

function renderRedditThread(comments, opts = {}) {
  const tops = (comments || []).filter((c) => !c.parentId);
  if (!tops.length) {
    const emptyMsg = opts.emptyMessage || 'No comments yet. Start the discussion below.';
    return `<div class="reddit-thread reddit-thread--empty"><p class="reddit-empty">${escapeHtml(emptyMsg)}</p></div>`;
  }
  const items = tops.map((c) => renderRedditComment(c, comments, opts)).join('');
  return `<div class="reddit-thread">${items}</div>`;
}

const REDDIT_THREAD_SCRIPT = `<script>
(function () {
  document.querySelectorAll('[data-reddit-collapse]').forEach(function (btn) {
    if (btn.dataset.redditBound) return;
    btn.dataset.redditBound = '1';
    btn.addEventListener('click', function () {
      var comment = btn.closest('.reddit-comment');
      if (!comment) return;
      var collapsed = comment.classList.toggle('is-collapsed');
      btn.textContent = collapsed ? '+' : '−';
      btn.setAttribute('aria-label', collapsed ? 'Expand thread' : 'Collapse thread');
      btn.setAttribute('title', collapsed ? 'Expand' : 'Collapse');
    });
  });
})();
</script>`;

function redditPostForm(ref, opts = {}) {
  const {
    postAction,
    canPost = true,
    label = 'Add comment',
    placeholder = 'Write a comment…',
    showAttachments = false,
    submitLabel = 'Post comment',
    formClass = 'reddit-compose',
  } = opts;

  if (!canPost || !postAction) return '';

  const attachField = showAttachments
    ? `<div class="field">
        <label for="thread-attach-${escapeHtml(ref)}">Attachments <span class="text-muted">(optional)</span></label>
        <input id="thread-attach-${escapeHtml(ref)}" name="attachments" type="file" multiple>
      </div>`
    : '';

  const enctype = showAttachments ? ' enctype="multipart/form-data"' : '';
  return `<form method="post" action="${escapeHtml(postAction)}" class="stack-form ${formClass}"${enctype}>
    <div class="field">
      <label for="thread-comment-${escapeHtml(ref)}">${escapeHtml(label)}</label>
      <textarea id="thread-comment-${escapeHtml(ref)}" name="comment" rows="3" required placeholder="${escapeHtml(placeholder)}"></textarea>
    </div>
    ${attachField}
    <button type="submit" class="btn-primary btn-primary--auto">${escapeHtml(submitLabel)}</button>
  </form>`;
}

/**
 * Reddit-style threaded discussion: comments, replies, attachments, reactions.
 */
function threadDiscussionSection(ticket, ref, opts = {}) {
  const {
    title = 'Discussion thread',
    hint = '',
    postAction,
    editAction,
    reactAction,
    canPost = true,
    canReact = true,
    canEditOwn = false,
    currentUsername,
    showWhenDraft = false,
    emptyMessage,
    showAttachments = false,
    composeLabel,
    composePlaceholder,
    submitLabel,
  } = opts;

  if (ticket.status === 'draft' && !showWhenDraft) {
    return `<section class="sup-card sup-card--thread">
      <div class="sup-card__head"><h2>${escapeHtml(title)}</h2></div>
      <div class="sup-card__body">
        <p class="text-muted">Discussion is available after the ticket is submitted.</p>
      </div>
    </section>`;
  }

  const comments = ticket.threadComments || [];
  const thread = renderRedditThread(comments, {
    postAction,
    editAction,
    reactAction,
    canPost,
    canReact,
    canEditOwn,
    currentUsername,
    emptyMessage,
  });

  const postForm = redditPostForm(ref, {
    postAction,
    canPost,
    label: composeLabel,
    placeholder: composePlaceholder,
    showAttachments,
    submitLabel,
  });

  return `<section class="sup-card sup-card--thread">
    ${title ? `<div class="sup-card__head"><h2>${escapeHtml(title)}</h2></div>` : ''}
    <div class="sup-card__body">
      ${hint ? `<p class="section-hint">${escapeHtml(hint)}</p>` : ''}
      ${thread}
      ${postForm}
      ${REDDIT_THREAD_SCRIPT}
    </div>
  </section>`;
}

function threadDiscussionPanel(ticket, ref, opts = {}) {
  const body = threadDiscussionSection(ticket, ref, { ...opts, title: '', hint: '' });
  return body.replace('<section class="sup-card sup-card--thread">', '<div class="dept-activity__panel dept-activity__panel--thread" data-activity-panel="comments">')
    .replace('</section>', '</div>');
}

module.exports = {
  threadDiscussionSection,
  threadDiscussionPanel,
  renderRedditThread,
  renderRedditComment,
  redditPostForm,
  highlightMentions,
  REDDIT_THREAD_SCRIPT,
  REACTION_OPTIONS,
};
