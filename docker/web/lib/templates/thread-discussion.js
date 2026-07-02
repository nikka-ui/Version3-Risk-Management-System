const { escapeHtml, formatDate } = require('../html');

const REACTION_OPTIONS = ['👍', '❤️', '🎉', '👀'];

function highlightMentions(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /@([a-zA-Z0-9._-]+)/g,
    '<span class="mention">@$1</span>',
  );
}

function renderReactions(comment, ref, { reactAction } = {}) {
  const reactions = comment.reactions || {};
  const entries = Object.entries(reactions).filter(([, users]) => users?.length);
  const buttons = reactAction
    ? REACTION_OPTIONS.map((emoji) => {
        const active = (reactions[emoji] || []).includes('self');
        return `<form method="post" action="${escapeHtml(reactAction)}" class="inline-form reaction-form">
          <input type="hidden" name="commentId" value="${escapeHtml(comment.id)}">
          <input type="hidden" name="reaction" value="${escapeHtml(emoji)}">
          <button type="submit" class="reaction-btn${active ? ' is-active' : ''}" title="React with ${emoji}">${emoji}</button>
        </form>`;
      }).join('')
    : '';

  const summary = entries.length
    ? entries
        .map(([emoji, users]) => `<span class="reaction-pill" title="${users.length} reaction(s)">${emoji} ${users.length}</span>`)
        .join('')
    : '';

  return summary || buttons
    ? `<div class="comment-reactions">${summary}${buttons}</div>`
    : '';
}

function renderAttachments(attachments = []) {
  if (!attachments.length) return '';
  const items = attachments
    .map((a) => `<li><a href="${escapeHtml(a.href || '#')}" target="_blank" rel="noopener">${escapeHtml(a.name || 'Attachment')}</a></li>`)
    .join('');
  return `<ul class="comment-attachments">${items}</ul>`;
}

function renderComment(c, comments, ref, opts, { isReply } = {}) {
  const {
    postAction,
    editAction,
    reactAction,
    canPost = true,
    canReact = true,
    canEditOwn = false,
    currentUsername,
  } = opts;

  const replies = comments
    .filter((r) => r.parentId === c.id)
    .map((r) => renderComment(r, comments, ref, opts, { isReply: true }))
    .join('');

  const kindTag = () => {
    if (c.kind === 'reassignment') return '<span class="comment-tag comment-tag--reassign">Reassignment</span>';
    if (c.kind === 'system') return '<span class="comment-tag comment-tag--system">System</span>';
    return '';
  };

  const edited = c.editedAt
    ? `<span class="comment-edited" title="Edited ${escapeHtml(formatDate(c.editedAt))}">(edited)</span>`
    : '';

  const replyForm = !isReply && canPost && postAction
    ? `<form method="post" action="${escapeHtml(postAction)}" class="stack-form comment-form comment-form--reply">
        <input type="hidden" name="parentId" value="${escapeHtml(c.id)}">
        <div class="field">
          <label class="visually-hidden" for="reply-${escapeHtml(c.id)}">Reply</label>
          <textarea id="reply-${escapeHtml(c.id)}" name="comment" rows="2" required placeholder="Write a reply… Use @username to mention someone."></textarea>
        </div>
        <button type="submit" class="btn-outline btn-primary--auto">Reply</button>
      </form>`
    : '';

  const editForm = canEditOwn && editAction && currentUsername && c.authorUsername === currentUsername && c.kind === 'comment'
    ? `<details class="comment-edit">
        <summary class="comment-edit__toggle">Edit</summary>
        <form method="post" action="${escapeHtml(editAction)}" class="stack-form comment-form comment-form--edit">
          <input type="hidden" name="commentId" value="${escapeHtml(c.id)}">
          <div class="field">
            <textarea name="comment" rows="3" required>${escapeHtml(c.body)}</textarea>
          </div>
          <button type="submit" class="btn-outline btn-primary--auto">Save edit</button>
        </form>
      </details>`
    : '';

  return `<li class="comment${isReply ? ' comment--reply' : ''}${c.kind && c.kind !== 'comment' ? ' comment--event' : ''}" id="comment-${escapeHtml(c.id)}">
    <div class="comment-meta">
      <span class="comment-author">${escapeHtml(c.authorName || c.authorUsername)}</span>
      <span class="comment-role">${escapeHtml(c.roleLabel || c.authorRole)}</span>
      ${kindTag()}
      <span class="comment-time">${escapeHtml(formatDate(c.at))}</span>
      ${edited}
    </div>
    <div class="comment-body">${highlightMentions(c.body)}</div>
    ${renderAttachments(c.attachments)}
    ${canReact ? renderReactions(c, ref, { reactAction }) : ''}
    ${editForm}
    ${replyForm}
    ${replies ? `<ul class="comment-list comment-list--replies">${replies}</ul>` : ''}
  </li>`;
}

/**
 * Jira-like threaded discussion: comments, replies, mentions, attachments, reactions, timestamps, edited indicator.
 */
function threadDiscussionSection(ticket, ref, opts = {}) {
  const {
    title = 'Threaded discussion',
    hint = 'Comments, replies, mentions (@username), attachments, and reactions — similar to Jira.',
    postAction,
    editAction,
    reactAction,
    canPost = true,
    canReact = true,
    canEditOwn = false,
    currentUsername,
    showWhenDraft = false,
  } = opts;

  if (ticket.status === 'draft' && !showWhenDraft) {
    return `<section class="sup-card">
      <h2>${escapeHtml(title)}</h2>
      <p class="text-muted">Threaded discussion is available after the ticket is submitted.</p>
    </section>`;
  }

  const comments = ticket.threadComments || [];
  const tops = comments.filter((c) => !c.parentId);
  const renderOpts = { postAction, editAction, reactAction, canPost, canReact, canEditOwn, currentUsername };

  const items = tops.length
    ? tops.map((c) => renderComment(c, comments, ref, renderOpts)).join('')
    : '<li class="comment comment--empty text-muted">No comments yet. Start the discussion below.</li>';

  const postForm = canPost && postAction
    ? `<form method="post" action="${escapeHtml(postAction)}" class="stack-form comment-form" enctype="multipart/form-data">
        <div class="field">
          <label for="thread-comment-${escapeHtml(ref)}">Add comment</label>
          <textarea id="thread-comment-${escapeHtml(ref)}" name="comment" rows="3" required placeholder="Write a comment… Use @username to mention someone."></textarea>
        </div>
        <div class="field">
          <label for="thread-attach-${escapeHtml(ref)}">Attachments <span class="text-muted">(optional)</span></label>
          <input id="thread-attach-${escapeHtml(ref)}" name="attachments" type="file" multiple>
        </div>
        <button type="submit" class="btn-primary btn-primary--auto">Post comment</button>
      </form>`
    : '';

  return `<section class="sup-card sup-card--thread">
    <h2>${escapeHtml(title)}</h2>
    ${hint ? `<p class="section-hint">${escapeHtml(hint)}</p>` : ''}
    <ul class="comment-list">${items}</ul>
    ${postForm}
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
  highlightMentions,
  REACTION_OPTIONS,
};
