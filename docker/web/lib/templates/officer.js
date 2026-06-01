const { getCategoryLabel, getStatusLabel } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { getAccomplishmentForTicket } = require('../tickets');
const { appLayout, flashMessage, commentsSection } = require('./layout');

function statusPill(status, overdue) {
  const cls = overdue ? 'pill pill--bad' : 'pill';
  return `<span class="${cls}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function ticketTableRows(tickets, { linkPrefix = '/officer/tickets/' } = {}) {
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
        ? `<a href="/officer/attachments/${escapeHtml(e.id)}" target="_blank" rel="noopener">${escapeHtml(e.name || e.originalName)}</a>`
        : escapeHtml(e.name || '—');
      return `<li>${label} <span class="text-muted">(${escapeHtml(formatDate(e.uploadedAt))})</span></li>`;
    })
    .join('');

  const officerBlock = t.officerNotes
    ? `<section class="card">
        <h2>Officer notes</h2>
        <p>${escapeHtml(t.officerNotes)}</p>
        ${t.mitigationDueAt ? `<p class="text-muted">Mitigation due: ${escapeHtml(formatDate(t.mitigationDueAt))}</p>` : ''}
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
    ${officerBlock}`;
}

function officerOverviewPage(user, stats, flash) {
  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>RMO dashboard</h1>
      <p class="page-desc">Validate risk reports, define mitigation plans, and perform final validation before closing tickets.</p>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-value">${stats.awaitingReview}</span>
        <span class="stat-label">Awaiting review</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.awaitingFinalValidation}</span>
        <span class="stat-label">Final validation</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.inMitigation}</span>
        <span class="stat-label">In mitigation</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.overdueMitigation}</span>
        <span class="stat-label">Overdue mitigation</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.closed}</span>
        <span class="stat-label">Closed</span>
      </div>
    </div>
    <div class="card" style="margin-top:1.5rem">
      <h2>Quick actions</h2>
      <div class="action-row">
        <a href="/officer/review" class="btn-outline">Review queue (${stats.awaitingReview})</a>
        <a href="/officer/final-validation" class="btn-outline">Final validation (${stats.awaitingFinalValidation})</a>
        <a href="/officer/monitoring" class="btn-outline">Implementation monitoring</a>
        <a href="/officer/tickets" class="btn-outline">All tickets</a>
      </div>
    </div>`;

  return appLayout({
    title: 'RMO dashboard',
    user,
    activeNav: 'overview',
    body,
    wide: true,
    navVariant: 'officer',
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
    navVariant: 'officer',
  });
}

function reviewQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Review queue',
    desc: 'Risk reports submitted by department supervisors awaiting your validation (accept and assign mitigation, or return for revision).',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'review',
    emptyMessage: 'No tickets awaiting RMO review.',
  });
}

function finalValidationQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Final validation',
    desc: 'Accomplishment reports awaiting effectiveness validation — close the ticket or return for further implementation.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'final',
    emptyMessage: 'No tickets awaiting final validation.',
  });
}

function monitoringQueuePage(user, tickets, flash) {
  return queueListPage(user, {
    title: 'Implementation monitoring',
    desc: 'Tickets with approved mitigation plans currently with departments for implementation.',
    tickets,
    flash,
    activeNav: 'monitoring',
    emptyMessage: 'No tickets currently in mitigation.',
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

function ticketReviewPage(user, ticket, { flash, error } = {}) {
  const t = ticket;
  const ref = t.reference;
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 14);
  const dueValue = defaultDue.toISOString().slice(0, 10);

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title)}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}</p>
      </div>
      <a href="/officer/review" class="btn-outline">Back to review queue</a>
    </div>
    ${ticketReadonlySections(t)}
    ${commentsSection(t.comments, { postAction: `/officer/tickets/${escapeHtml(ref)}/comment` })}
    <section class="card card--accent">
      <h2>RMO decision</h2>
      <p class="text-muted">Per workflow step 3: accept the report and define a mitigation plan, or return it to the department for revision.</p>
      <form method="post" action="/officer/tickets/${escapeHtml(ref)}/accept" class="stack-form" style="margin-top:1rem">
        <h2 class="section-sub">Accept &amp; assign mitigation</h2>
        <div class="field">
          <label for="mitigationPlan">Mitigation plan / officer notes *</label>
          <textarea id="mitigationPlan" name="mitigationPlan" rows="4" required placeholder="Describe approved actions, owners, and expectations…"></textarea>
        </div>
        <div class="field">
          <label for="mitigationDueAt">Implementation due date</label>
          <input id="mitigationDueAt" name="mitigationDueAt" type="date" value="${dueValue}">
        </div>
        <button type="submit" class="btn-primary btn-primary--auto">Accept &amp; assign mitigation</button>
      </form>
      <form method="post" action="/officer/tickets/${escapeHtml(ref)}/reject" class="stack-form" style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border, #e2e8f0)">
        <h2 class="section-sub">Return for revision</h2>
        <div class="field">
          <label for="rejectionNotes">Rejection notes *</label>
          <textarea id="rejectionNotes" name="rejectionNotes" rows="3" required placeholder="Explain what the department must correct…"></textarea>
        </div>
        <button type="submit" class="btn-danger">Return to department</button>
      </form>
    </section>`;

  return appLayout({
    title: `Review ${ref}`,
    user,
    activeNav: 'review',
    body,
    wide: true,
    navVariant: 'officer',
  });
}

function ticketFinalValidationPage(user, ticket, accomplishment, { flash, error } = {}) {
  const t = ticket;
  const ref = t.reference;
  const acc = accomplishment;

  const accBlock = acc
    ? `<section class="card card--accent">
        <h2>Accomplishment report</h2>
        <p class="text-muted">Submitted by ${escapeHtml(acc.submittedByName || acc.submittedBy)} on ${escapeHtml(formatDate(acc.submittedAt))}</p>
        <h2 class="section-sub">Implementation summary</h2>
        <p>${escapeHtml(acc.summary)}</p>
        <h2 class="section-sub">Outcomes and results</h2>
        <p>${escapeHtml(acc.outcomes)}</p>
        ${
          (acc.evidence || []).length
            ? `<h2 class="section-sub">Evidence references</h2><ul class="evidence-list">${(acc.evidence || [])
                .map((e) => `<li>${escapeHtml(e.name)}</li>`)
                .join('')}</ul>`
            : ''
        }
      </section>`
    : `<section class="card"><p class="text-muted">Accomplishment record not found.</p></section>`;

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title)}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}</p>
      </div>
      <a href="/officer/final-validation" class="btn-outline">Back to final validation</a>
    </div>
    ${ticketReadonlySections(t)}
    ${commentsSection(t.comments, { postAction: `/officer/tickets/${escapeHtml(ref)}/comment` })}
    ${accBlock}
    <section class="card card--accent">
      <h2>Final validation</h2>
      <p class="text-muted">Per workflow step 6: confirm mitigation effectiveness and close the ticket, or return for further implementation.</p>
      <form method="post" action="/officer/tickets/${escapeHtml(ref)}/close" class="stack-form" style="margin-top:1rem">
        <h2 class="section-sub">Close ticket</h2>
        <div class="field">
          <label for="closingNotes">Closing notes (optional)</label>
          <textarea id="closingNotes" name="closingNotes" rows="2" placeholder="Summary of validation outcome…"></textarea>
        </div>
        <button type="submit" class="btn-primary btn-primary--auto">Close ticket</button>
      </form>
      <form method="post" action="/officer/tickets/${escapeHtml(ref)}/return-accomplishment" class="stack-form" style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border, #e2e8f0)">
        <h2 class="section-sub">Return for further implementation</h2>
        <div class="field">
          <label for="returnNotes">Return notes *</label>
          <textarea id="returnNotes" name="returnNotes" rows="3" required placeholder="Describe gaps in the accomplishment report…"></textarea>
        </div>
        <button type="submit" class="btn-danger">Return to department</button>
      </form>
    </section>`;

  return appLayout({
    title: `Final validation ${ref}`,
    user,
    activeNav: 'final',
    body,
    wide: true,
    navVariant: 'officer',
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
      <a href="/officer/tickets" class="btn-outline">Back to all tickets</a>
    </div>
    ${ticketReadonlySections(t)}
    ${commentsSection(t.comments, { postAction: `/officer/tickets/${escapeHtml(t.reference)}/comment` })}`;

  return appLayout({
    title: t.reference,
    user,
    activeNav: 'tickets',
    body,
    wide: true,
    navVariant: 'officer',
  });
}

function renderOfficerTicketPage(user, ticket, opts) {
  if (ticket.status === 'under_review') {
    return ticketReviewPage(user, ticket, opts);
  }
  if (ticket.status === 'pending_audit') {
    const accomplishment = getAccomplishmentForTicket(ticket);
    return ticketFinalValidationPage(user, ticket, accomplishment, opts);
  }
  return ticketViewPage(user, ticket, opts);
}

module.exports = {
  officerOverviewPage,
  reviewQueuePage,
  finalValidationQueuePage,
  monitoringQueuePage,
  allTicketsPage,
  renderOfficerTicketPage,
};
