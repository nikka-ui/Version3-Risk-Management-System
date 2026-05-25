const { RISK_CATEGORIES, getCategoryLabel, getStatusLabel } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { canSupervisorEdit } = require('../tickets');
const { appLayout, flashMessage } = require('./layout');

function categoryOptions(selected) {
  return RISK_CATEGORIES.map(
    (c) =>
      `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${escapeHtml(c.label)}</option>`,
  ).join('');
}

function likelihoodOptions(selected) {
  return [1, 2, 3, 4, 5]
    .map((n) => `<option value="${n}" ${Number(selected) === n ? 'selected' : ''}>${n}</option>`)
    .join('');
}

function statusPill(status, overdue) {
  const cls = overdue ? 'pill pill--bad' : 'pill';
  return `<span class="${cls}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function ticketTableRows(tickets, { linkPrefix = '/supervisor/tickets/' } = {}) {
  return tickets
    .map(
      (t) => `<tr>
        <td class="mono nowrap"><a href="${linkPrefix}${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel)}</td>
        <td>${statusPill(t.status, t.isOverdue)}</td>
        <td class="nowrap">${t.likelihood}×${t.impact}</td>
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
      </tr>`,
    )
    .join('');
}

function supervisorOverviewPage(user, stats, flash) {
  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Supervisor dashboard</h1>
      <p class="page-desc">Submit risk reports, track tickets, and record accomplishments for your department.</p>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-value">${stats.total}</span>
        <span class="stat-label">My tickets</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.drafts}</span>
        <span class="stat-label">Drafts</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.actionRequired}</span>
        <span class="stat-label">Action required</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.overdue}</span>
        <span class="stat-label">Overdue</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.accomplishments}</span>
        <span class="stat-label">Accomplishments</span>
      </div>
    </div>
    <div class="card" style="margin-top:1.5rem">
      <h2>Quick actions</h2>
      <div class="action-row">
        <a href="/supervisor/tickets/new" class="btn-outline">Submit new risk report</a>
        <a href="/supervisor/tickets" class="btn-outline">View my tickets</a>
        <a href="/supervisor/actions" class="btn-outline">Action required</a>
        <a href="/supervisor/accomplishments" class="btn-outline">Accomplishment history</a>
      </div>
    </div>`;

  return appLayout({
    title: 'Supervisor dashboard',
    user,
    activeNav: 'overview',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

function ticketsListPage(user, tickets, flash) {
  const rows = ticketTableRows(tickets);
  const body = `
    ${flashMessage(flash)}
    <div class="page-head page-head--row">
      <div>
        <h1>My tickets</h1>
        <p class="page-desc">All risk reports submitted by your department.</p>
      </div>
      <a href="/supervisor/tickets/new" class="btn-outline">New report</a>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Score</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No tickets yet. <a href="/supervisor/tickets/new">Submit your first risk report</a>.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return appLayout({
    title: 'My tickets',
    user,
    activeNav: 'tickets',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

function fiveW1HFields(ticket, editable) {
  const w = ticket?.fiveW1H || {};
  const fields = [
    { key: 'what', label: 'What happened?', required: true },
    { key: 'why', label: 'Why did it happen?', required: true },
    { key: 'where', label: 'Where did it occur?', required: false },
    { key: 'when', label: 'When did it occur?', required: false },
    { key: 'who', label: 'Who was involved?', required: false },
    { key: 'how', label: 'How was it discovered?', required: false },
  ];
  if (!editable) {
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
  return `<div class="w1h-grid">
    ${fields
      .map(
        (f) => `<div class="field">
          <label for="${f.key}">${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
          <textarea id="${f.key}" name="${f.key}" rows="2" ${f.required ? 'required' : ''}>${escapeHtml(w[f.key] || '')}</textarea>
        </div>`,
      )
      .join('')}
  </div>`;
}

function ticketFormPage(user, ticket, { mode, flash, error, devMode }) {
  const isNew = mode === 'new';
  const editable = isNew || (ticket && canSupervisorEdit(ticket));
  const t = ticket || {};
  const ref = t.reference || '';

  const aiBlock =
    t.ai && !editable
      ? `<section class="card card--ai">
          <h2>AI classification</h2>
          <p class="text-muted">${escapeHtml(t.ai.summary)}</p>
          <dl class="detail-dl">
            <dt>Severity</dt><dd>${t.ai.severity}/5</dd>
            <dt>Confidence</dt><dd>${Math.round(t.ai.confidence * 100)}%</dd>
            <dt>Manual review</dt><dd>${t.ai.manualReviewRequired ? 'Required' : 'No'}</dd>
          </dl>
        </section>`
      : '';

  const officerBlock = t.officerNotes
    ? `<section class="card">
        <h2>Officer notes</h2>
        <p>${escapeHtml(t.officerNotes)}</p>
        ${t.mitigationDueAt ? `<p class="text-muted">Due: ${escapeHtml(formatDate(t.mitigationDueAt))}</p>` : ''}
      </section>`
    : '';

  const evidenceList = (t.evidence || [])
    .map((e) => `<li>${escapeHtml(e.name)} <span class="text-muted">(${escapeHtml(formatDate(e.uploadedAt))})</span></li>`)
    .join('');

  const formSection = editable
    ? `<form method="post" action="${isNew ? '/supervisor/tickets' : `/supervisor/tickets/${escapeHtml(ref)}`}" class="stack-form ticket-form">
        <section class="card">
          <h2>Risk details</h2>
          <div class="form-grid">
            <div class="field">
              <label for="title">Risk title *</label>
              <input id="title" name="title" type="text" required value="${escapeHtml(t.title || '')}">
            </div>
            <div class="field">
              <label for="department">Department</label>
              <input id="department" name="department" type="text" value="${escapeHtml(t.department || 'Operations')}">
            </div>
            <div class="field">
              <label for="location">Location</label>
              <input id="location" name="location" type="text" value="${escapeHtml(t.location || '')}" placeholder="Building, floor, area">
            </div>
            <div class="field">
              <label for="category">Category</label>
              <select id="category" name="category">${categoryOptions(t.category || 'operational')}</select>
            </div>
            <div class="field">
              <label for="likelihood">Likelihood (1–5)</label>
              <select id="likelihood" name="likelihood">${likelihoodOptions(t.likelihood || 3)}</select>
            </div>
            <div class="field">
              <label for="impact">Impact (1–5)</label>
              <select id="impact" name="impact">${likelihoodOptions(t.impact || 3)}</select>
            </div>
          </div>
          <div class="field">
            <label for="description">Detailed description</label>
            <textarea id="description" name="description" rows="4">${escapeHtml(t.description || '')}</textarea>
          </div>
          <div class="field">
            <label for="mitigationApproach">Preferred mitigation (optional)</label>
            <input id="mitigationApproach" name="mitigationApproach" type="text" value="${escapeHtml(t.mitigationApproach || '')}">
          </div>
        </section>
        <section class="card">
          <h2>5W1H</h2>
          ${fiveW1HFields(t, true)}
        </section>
        <section class="card">
          <h2>Evidence references</h2>
          <p class="text-muted">Enter one file name or reference per line (full upload via API in production).</p>
          <div class="field">
            <label for="evidenceFiles">Attachments</label>
            <textarea id="evidenceFiles" name="evidenceFiles" rows="3" placeholder="e.g. incident-photo.jpg"></textarea>
          </div>
        </section>
        <div class="form-actions">
          ${isNew ? '' : `<button type="submit" name="intent" value="save" class="btn-outline">Save draft</button>`}
          <button type="submit" name="intent" value="submit" class="btn-primary btn-primary--auto">${isNew ? 'Save &amp; submit' : 'Save &amp; resubmit'}</button>
        </div>
      </form>`
    : `<section class="card">
        <h2>Risk details</h2>
        <dl class="detail-dl">
          <dt>Title</dt><dd>${escapeHtml(t.title)}</dd>
          <dt>Department</dt><dd>${escapeHtml(t.department)}</dd>
          <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
          <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
          <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
        </dl>
        <p style="margin-top:1rem">${escapeHtml(t.description || '—')}</p>
      </section>
      <section class="card">
        <h2>5W1H</h2>
        ${fiveW1HFields(t, false)}
      </section>`;

  const evidenceSection =
    !editable && evidenceList
      ? `<section class="card"><h2>Evidence</h2><ul class="evidence-list">${evidenceList}</ul></section>`
      : '';

  const addEvidenceForm =
    !editable && ['under_review', 'in_mitigation', 'returned', 'pending_audit', 'reopened'].includes(t.status)
      ? `<section class="card">
          <h2>Add evidence</h2>
          <form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/evidence" class="stack-form">
            <div class="field">
              <label for="evidenceFiles">New references (one per line)</label>
              <textarea id="evidenceFiles" name="evidenceFiles" rows="2" required></textarea>
            </div>
            <button type="submit" class="btn-sm">Upload reference</button>
          </form>
        </section>`
      : '';

  const accomplishmentForm =
    ['in_mitigation', 'returned', 'reopened'].includes(t.status)
      ? `<section class="card card--accent">
          <h2>Submit accomplishment report</h2>
          <p class="text-muted">Document mitigation implementation and outcomes.</p>
          <form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/accomplishment" class="stack-form">
            <div class="field">
              <label for="summary">Implementation summary *</label>
              <textarea id="summary" name="summary" rows="3" required></textarea>
            </div>
            <div class="field">
              <label for="outcomes">Outcomes and results *</label>
              <textarea id="outcomes" name="outcomes" rows="3" required></textarea>
            </div>
            <div class="field">
              <label for="acc_evidence">Resolution evidence (one per line)</label>
              <textarea id="acc_evidence" name="evidenceFiles" rows="2"></textarea>
            </div>
            <button type="submit" class="btn-primary btn-primary--auto">Submit accomplishment</button>
          </form>
        </section>`
      : '';

  const devMitigation =
    devMode && t.status === 'under_review'
      ? `<form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/simulate-mitigation" class="dev-banner">
          <p class="text-muted">Development: simulate RMO approval to test implementation workflow.</p>
          <button type="submit" class="btn-outline">Assign mitigation (demo)</button>
        </form>`
      : '';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head page-head--row">
      <div>
        <h1>${isNew ? 'New risk report' : escapeHtml(t.title || 'Ticket')}</h1>
        <p class="page-desc">${isNew ? 'Structured 5W1H report with evidence references.' : `<span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}`}</p>
      </div>
      ${isNew ? '<a href="/supervisor/tickets" class="btn-outline">Back to tickets</a>' : ''}
    </div>
    ${formSection}
    ${aiBlock}
    ${officerBlock}
    ${evidenceSection}
    ${addEvidenceForm}
    ${accomplishmentForm}
    ${devMitigation}`;

  return appLayout({
    title: isNew ? 'New risk report' : ref,
    user,
    activeNav: isNew ? 'new' : 'tickets',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

function actionsPage(user, tickets, flash) {
  const rows = ticketTableRows(tickets);
  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Action required</h1>
      <p class="page-desc">Tickets awaiting implementation, revision, or accomplishment submission.</p>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Score</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No tickets require action right now.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return appLayout({
    title: 'Action required',
    user,
    activeNav: 'actions',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

function accomplishmentsPage(user, accomplishments, flash) {
  const rows = accomplishments
    .map(
      (a) => `<tr>
        <td class="mono nowrap">${escapeHtml(a.ticketRef)}</td>
        <td>${escapeHtml(a.ticketTitle)}</td>
        <td>${escapeHtml(a.summary)}</td>
        <td class="nowrap">${escapeHtml(formatDate(a.submittedAt))}</td>
      </tr>`,
    )
    .join('');

  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Accomplishment history</h1>
      <p class="page-desc">Reports submitted after implementing approved mitigations.</p>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Title</th>
              <th>Summary</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty">No accomplishment reports yet.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return appLayout({
    title: 'Accomplishments',
    user,
    activeNav: 'accomplishments',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

module.exports = {
  supervisorOverviewPage,
  ticketsListPage,
  ticketFormPage,
  actionsPage,
  accomplishmentsPage,
};
