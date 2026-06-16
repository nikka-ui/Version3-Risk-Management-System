const { getCategoryLabel, getStatusLabel } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { appLayout, flashMessage, commentsSection, executiveCommentsSection } = require('./layout');

function statusPill(status, overdue) {
  const cls = overdue ? 'pill pill--bad' : 'pill';
  return `<span class="${cls}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function executiveCommentsBlock(ticket, ref) {
  return executiveCommentsSection(ticket.executiveComments || [], {
    replyAction: `/audit/tickets/${escapeHtml(ref)}/executive-reply`,
    canReply: true,
  });
}

function ticketTableRows(tickets, { linkPrefix = '/audit/tickets/' } = {}) {
  return tickets
    .map(
      (t) => `<tr>
        <td class="mono nowrap"><a href="${linkPrefix}${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${escapeHtml(t.submittedByName || t.submittedBy)}</td>
        <td class="nowrap">${escapeHtml(t.department)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel)}</td>
        <td>${statusPill(t.status, t.isOverdue)}</td>
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
      </tr>`,
    )
    .join('');
}

function fiveW1HReadonly(ticket) {
  const w = ticket?.fiveW1H || {};
  const fields = [
    { key: 'what', label: 'What happened?' },
    { key: 'why', label: 'Why did it happen?' },
    { key: 'where', label: 'Where did it occur?' },
    { key: 'when', label: 'When did it occur?' },
    { key: 'who', label: 'Who was involved?' },
    { key: 'how', label: 'How was it discovered?' },
  ];
  return `<div class="w1h-grid w1h-grid--readonly">
    ${fields
      .map(
        (f) => `<div class="w1h-item">
          <span class="w1h-label">${escapeHtml(f.label)}</span>
          <p>${escapeHtml(w[f.key] || '—')}</p>
        </div>`,
      )
      .join('')}
  </div>`;
}

function ticketReadonlySections(ticket) {
  const t = ticket;
  const aiBlock = t.ai
    ? `<section class="card card--ai">
        <h2>AI classification</h2>
        <p class="text-muted">${escapeHtml(t.ai.summary)}</p>
        <dl class="detail-dl">
          <dt>Likelihood</dt><dd>${t.ai.likelihood || t.likelihood}/5</dd>
          <dt>Impact</dt><dd>${t.ai.impact || t.impact}/5</dd>
          <dt>Confidence</dt><dd>${Math.round((t.ai.confidence || 0) * 100)}%</dd>
          <dt>Manual review</dt><dd>${t.ai.manualReviewRequired ? 'Required' : 'No'}</dd>
        </dl>
      </section>`
    : '';

  const evidenceList = (t.evidence || [])
    .map((e) => {
      const label = e.storageKey
        ? `<a href="/audit/attachments/${escapeHtml(e.id)}" target="_blank" rel="noopener">${escapeHtml(e.name || e.originalName)}</a>`
        : escapeHtml(e.name || '—');
      return `<li>${label} <span class="text-muted">(${escapeHtml(formatDate(e.uploadedAt))})</span></li>`;
    })
    .join('');

  const solutionBlock = t.officerNotes
    ? `<section class="card card--accent">
        <h2>RMO mitigation solution${t.mitigationPlanVersion ? ` <span class="text-muted">(v${t.mitigationPlanVersion})</span>` : ''}</h2>
        <p>${escapeHtml(t.officerNotes)}</p>
        ${t.mitigationDueAt ? `<p class="text-muted">Proposed implementation due: ${escapeHtml(formatDate(t.mitigationDueAt))}</p>` : ''}
      </section>`
    : '';

  const auditBlock = t.auditNotes
    ? `<section class="card">
        <h2>Audit notes</h2>
        <p>${escapeHtml(t.auditNotes)}</p>
      </section>`
    : '';

  return `
    <section class="card">
      <h2>Risk details</h2>
      <dl class="detail-dl">
        <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
        <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
        <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
        <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
        <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
      </dl>
      <p style="margin-top:1rem">${escapeHtml(t.description || '—')}</p>
    </section>
    <section class="card">
      <h2>5W1H</h2>
      ${fiveW1HReadonly(t)}
    </section>
    ${evidenceList ? `<section class="card"><h2>Evidence</h2><ul class="evidence-list">${evidenceList}</ul></section>` : ''}
    ${aiBlock}
    ${solutionBlock}
    ${auditBlock}`;
}

function auditOverviewPage(user, stats, flash) {
  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Audit dashboard</h1>
      <p class="page-desc">Independently review mitigation solutions defined by the Risk Management Officer before departments implement them (ISO 31000 workflow step 4).</p>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-value">${stats.awaitingReview}</span>
        <span class="stat-label">Awaiting audit</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.inImplementation}</span>
        <span class="stat-label">Approved / implementing</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.returnedToRmo}</span>
        <span class="stat-label">Returned to RMO</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.closed}</span>
        <span class="stat-label">Closed</span>
      </div>
    </div>
    <div class="card" style="margin-top:1.5rem">
      <h2>Quick actions</h2>
      <div class="action-row">
        <a href="/audit/review" class="btn-outline">Audit queue (${stats.awaitingReview})</a>
        <a href="/audit/tickets" class="btn-outline">All tickets</a>
      </div>
    </div>`;

  return appLayout({
    title: 'Audit dashboard',
    user,
    activeNav: 'overview',
    body,
    wide: true,
    navVariant: 'audit',
  });
}

function queueListPage(user, { title, desc, tickets, flash, error, activeNav, emptyMessage }) {
  const rows = ticketTableRows(tickets);
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head">
      <h1>${escapeHtml(title)}</h1>
      <p class="page-desc">${escapeHtml(desc)}</p>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Submitter</th>
              <th>Department</th>
              <th>Category</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="7" class="empty">${emptyMessage}</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

  return appLayout({
    title,
    user,
    activeNav,
    body,
    wide: true,
    navVariant: 'audit',
  });
}

function auditReviewQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Audit queue',
    desc: 'Mitigation solutions submitted by the RMO awaiting your review — approve to release for implementation, or return to the RMO as insufficient.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'review',
    emptyMessage: 'No solutions awaiting audit review.',
  });
}

function allTicketsPage(user, tickets, flash) {
  return queueListPage(user, {
    title: 'All tickets',
    desc: 'Organization-wide risk tickets (excluding drafts).',
    tickets,
    flash,
    activeNav: 'tickets',
    emptyMessage: 'No submitted tickets yet.',
  });
}

function ticketAuditPage(user, ticket, { flash, error } = {}) {
  const t = ticket;
  const ref = t.reference;
  const dueValue = t.mitigationDueAt
    ? new Date(t.mitigationDueAt).toISOString().slice(0, 10)
    : '';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title)}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}</p>
      </div>
      <a href="/audit/review" class="btn-outline">Back to audit queue</a>
    </div>
    ${ticketReadonlySections(t)}
    ${commentsSection(t.comments, {
      postAction: `/audit/tickets/${escapeHtml(ref)}/comment`,
      placeholder: 'Private comment for the RMO (not visible to the department)…',
    })}
    ${executiveCommentsBlock(t, ref)}
    <section class="card card--accent">
      <h2>Audit decision</h2>
      <p class="text-muted">Per workflow step 4: approve the mitigation solution so the department can begin implementation, or return it to the RMO if it is insufficient.</p>
      <form method="post" action="/audit/tickets/${escapeHtml(ref)}/approve" class="stack-form" style="margin-top:1rem">
        <h2 class="section-sub">Approve solution</h2>
        <div class="field">
          <label for="approveNotes">Audit remarks (optional)</label>
          <textarea id="approveNotes" name="auditNotes" rows="3" placeholder="Record your assessment of the mitigation solution…"></textarea>
        </div>
        <div class="field">
          <label for="mitigationDueAt">Confirm implementation due date</label>
          <input id="mitigationDueAt" name="mitigationDueAt" type="date" value="${escapeHtml(dueValue)}">
        </div>
        <button type="submit" class="btn-primary btn-primary--auto">Approve &amp; release for implementation</button>
      </form>
      <form method="post" action="/audit/tickets/${escapeHtml(ref)}/return" class="stack-form" style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border, #e2e8f0)">
        <h2 class="section-sub">Return to RMO</h2>
        <div class="field">
          <label for="returnNotes">Comments / suggestions *</label>
          <textarea id="returnNotes" name="auditNotes" rows="3" required placeholder="Explain why the solution is insufficient and what the RMO should revise…"></textarea>
        </div>
        <button type="submit" class="btn-danger">Return to RMO</button>
      </form>
    </section>`;

  return appLayout({
    title: `Audit ${ref}`,
    user,
    activeNav: 'review',
    body,
    wide: true,
    navVariant: 'audit',
  });
}

function ticketViewPage(user, ticket, { flash } = {}) {
  const t = ticket;
  const body = `
    ${flashMessage(flash)}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title)}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(t.reference)}</span> · ${statusPill(t.status, t.isOverdue)}</p>
      </div>
      <a href="/audit/tickets" class="btn-outline">Back to all tickets</a>
    </div>
    ${ticketReadonlySections(t)}
    ${commentsSection(t.comments, {
      postAction: `/audit/tickets/${escapeHtml(t.reference)}/comment`,
      placeholder: 'Private comment for the RMO (not visible to the department)…',
    })}
    ${executiveCommentsBlock(t, t.reference)}`;

  return appLayout({
    title: t.reference,
    user,
    activeNav: 'tickets',
    body,
    wide: true,
    navVariant: 'audit',
  });
}

function renderAuditTicketPage(user, ticket, opts) {
  if (ticket.status === 'under_audit') {
    return ticketAuditPage(user, ticket, opts);
  }
  return ticketViewPage(user, ticket, opts);
}

module.exports = {
  auditOverviewPage,
  auditReviewQueuePage,
  allTicketsPage,
  renderAuditTicketPage,
};
