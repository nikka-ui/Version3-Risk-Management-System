const { getCategoryLabel, getStatusLabel } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { getAccomplishmentForTicket, canOfficerEditMitigation } = require('../tickets');
const { appLayout, flashMessage, commentsSection, executiveCommentsSection } = require('./layout');

function statusPill(status, overdue) {
  const cls = overdue ? 'pill pill--bad' : 'pill';
  return `<span class="${cls}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function riskLevelFromSeverityLocal(severity1to5) {
  const sev = Math.max(1, Math.min(5, Number(severity1to5)));
  if (sev <= 2) return { id: 'low', label: 'Low' };
  if (sev === 3) return { id: 'moderate', label: 'Moderate' };
  if (sev === 4) return { id: 'high', label: 'High' };
  return { id: 'critical', label: 'Extreme/Critical' };
}

function riskLevelBadge(riskLevel) {
  const id = riskLevel?.id || 'low';
  const label = riskLevel?.label || 'Low';
  return `<span class="risk-badge risk-badge--${escapeHtml(id)}">${escapeHtml(label)}</span>`;
}

function ticketRiskLevel(ticket) {
  if (ticket?.ai?.riskLevel) return ticket.ai.riskLevel;
  const sev =
    ticket?.ai?.severity
    || (ticket?.likelihood && ticket?.impact
      ? Math.round((ticket.likelihood + ticket.impact) / 2)
      : 2);
  return riskLevelFromSeverityLocal(sev);
}

function riskSummaryFloat(ticket) {
  const riskLevel = ticketRiskLevel(ticket);
  const categoryLabel = ticket.categoryLabel || getCategoryLabel(ticket.category);
  return `<aside class="risk-summary-float" aria-label="Risk summary">
    <div class="risk-summary-float__item">
      <span class="risk-summary-float__label">Risk level</span>
      ${riskLevelBadge(riskLevel)}
    </div>
    <div class="risk-summary-float__item">
      <span class="risk-summary-float__label">Risk category</span>
      <span class="risk-summary-float__value">${escapeHtml(categoryLabel)}</span>
    </div>
  </aside>`;
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

function evidenceCompactSection(ticket) {
  const items = ticket?.evidence || [];
  if (!items.length) return '';

  const rows = items
    .map((e) => {
      const name = escapeHtml(e.name || e.originalName || 'File');
      const sizeMb = e.size ? `${(e.size / 1024 / 1024).toFixed(1)} MB` : '—';
      const viewBtn = e.storageKey
        ? `<a href="/officer/attachments/${escapeHtml(e.id)}" target="_blank" rel="noopener" class="btn-sm btn-outline">View</a>`
        : '<span class="text-muted">—</span>';
      return `<tr>
        <td class="evidence-name" title="${name}">${name}</td>
        <td class="nowrap text-muted">${escapeHtml(formatDate(e.uploadedAt))}</td>
        <td class="nowrap text-muted">${sizeMb}</td>
        <td class="col-actions">${viewBtn}</td>
      </tr>`;
    })
    .join('');

  return `<section class="card card--compact">
    <h2>Evidence <span class="text-muted">(${items.length})</span></h2>
    <div class="table-wrap">
      <table class="data-table data-table--compact evidence-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Uploaded</th>
            <th>Size</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function officerNotesCard(ticket) {
  const version = ticket.mitigationPlanVersion
    ? ` <span class="text-muted">(v${ticket.mitigationPlanVersion})</span>`
    : '';
  const due = ticket.mitigationDueAt
    ? `<p class="text-muted officer-notes-meta">Due: ${escapeHtml(formatDate(ticket.mitigationDueAt))}</p>`
    : '';

  if (!ticket.officerNotes) {
    return `<section class="card card--accent officer-split-col">
      <h2>Solution / mitigation plan</h2>
      <p class="text-muted">No mitigation plan on record.</p>
    </section>`;
  }

  return `<section class="card card--accent officer-split-col">
    <h2>Solution / mitigation plan${version}</h2>
    <div class="officer-notes-scroll">${escapeHtml(ticket.officerNotes)}</div>
    ${due}
  </section>`;
}

function officerPlanCommentsRow(ticket, ref, { editable = false } = {}) {
  const left = editable
    ? editMitigationPlanSection(ticket, { inSplitRow: true })
    : officerNotesCard(ticket);
  const right = commentsSection(ticket.comments || [], {
    postAction: `/officer/tickets/${escapeHtml(ref)}/comment`,
    placeholder: 'Private comment for the Audit Officer…',
    compact: true,
    wrapClass: 'officer-split-col',
  });

  return `<div class="officer-split-row">${left}${right}</div>`;
}

function executiveCommentsBlock(ticket, ref) {
  return executiveCommentsSection(ticket.executiveComments || [], {
    replyAction: `/officer/tickets/${escapeHtml(ref)}/executive-reply`,
    canReply: true,
  });
}

function ticketReadonlySections(ticket, { monitoring = false } = {}) {
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
    ? `<section class="card card--accent">
        <h2>Solution / mitigation plan${t.mitigationPlanVersion ? ` <span class="text-muted">(v${t.mitigationPlanVersion})</span>` : ''}</h2>
        <p>${escapeHtml(t.officerNotes)}</p>
        ${t.mitigationDueAt ? `<p class="text-muted">Proposed implementation due: ${escapeHtml(formatDate(t.mitigationDueAt))}</p>` : ''}
      </section>`
    : '';

  const auditFeedbackBlock =
    t.auditNotes && t.status === 'audit_returned'
      ? `<section class="card">
          <h2>Audit Officer feedback</h2>
          <p>${escapeHtml(t.auditNotes)}</p>
        </section>`
      : '';

  if (monitoring) {
    return `
    <section class="card">
      <div class="card-head-split">
        <h2>Risk details</h2>
        ${riskSummaryFloat(t)}
      </div>
      <dl class="detail-dl detail-dl--compact">
        <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
        <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
        <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
        <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
      </dl>
      <p class="risk-desc-snippet">${escapeHtml(t.description || '—')}</p>
    </section>
    <section class="card card--compact">
      <h2>5W1H</h2>
      ${fiveW1HReadonly(t)}
    </section>
    ${evidenceCompactSection(t)}
    ${auditFeedbackBlock}`;
  }

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
    ${officerBlock}
    ${auditFeedbackBlock}`;
}

function mitigationPlanHistorySection(history) {
  const items = (history || []).length
    ? [...history]
        .reverse()
        .map((h) => {
          const actionLabel =
            h.action === 'created'
              ? 'Plan created'
              : h.action === 'updated_and_resubmitted'
                ? 'Plan updated & resubmitted for audit'
                : 'Plan updated';
          return `<li class="audit-trail-item">
            <div class="audit-trail-meta">
              <span class="audit-trail-action">${escapeHtml(actionLabel)}</span>
              <span class="audit-trail-user">${escapeHtml(h.actorName || h.actorUsername)}</span>
              <span class="audit-trail-time">${escapeHtml(formatDate(h.at))}</span>
            </div>
            ${
              h.previous?.plan
                ? `<details class="audit-trail-diff">
                    <summary>Previous version</summary>
                    <p>${escapeHtml(h.previous.plan)}</p>
                    ${h.previous.dueAt ? `<p class="text-muted">Due: ${escapeHtml(formatDate(h.previous.dueAt))}</p>` : ''}
                  </details>`
                : ''
            }
            <div class="audit-trail-current">
              <span class="text-muted">Updated plan:</span>
              <p>${escapeHtml(h.updated?.plan || '—')}</p>
              ${h.updated?.dueAt ? `<p class="text-muted">Due: ${escapeHtml(formatDate(h.updated.dueAt))}</p>` : ''}
            </div>
          </li>`;
        })
        .join('')
    : '<li class="text-muted">No plan revisions recorded yet.</li>';

  return `<section class="card">
    <h2>Mitigation plan history</h2>
    <p class="text-muted section-hint">Audit trail of solution changes (previous and updated values).</p>
    <ul class="audit-trail-list">${items}</ul>
  </section>`;
}

function editMitigationPlanSection(ticket, { inSplitRow = false } = {}) {
  if (!canOfficerEditMitigation(ticket)) return '';

  const ref = ticket.reference;
  const dueValue = ticket.mitigationDueAt
    ? new Date(ticket.mitigationDueAt).toISOString().slice(0, 10)
    : '';
  const cardClass = inSplitRow
    ? 'card card--accent officer-split-col'
    : 'card card--accent';
  const resubmitHint = inSplitRow
    ? ''
    : ticket.status === 'audit_returned'
      ? '<p class="text-muted">Saving will update the plan and resubmit it to the Audit Officer for review.</p>'
      : '<p class="text-muted">Update the proposed solution while it is under audit review.</p>';

  return `<section class="${cardClass}">
    <h2>Edit solution / mitigation plan</h2>
    ${resubmitHint}
    <form method="post" action="/officer/tickets/${escapeHtml(ref)}/update-mitigation" class="stack-form stack-form--compact">
      <div class="field">
        <label for="editMitigationPlan">Solution / mitigation plan *</label>
        <textarea id="editMitigationPlan" name="mitigationPlan" rows="${inSplitRow ? 8 : 6}" required>${escapeHtml(ticket.officerNotes || '')}</textarea>
      </div>
      <div class="field">
        <label for="editMitigationDueAt">Implementation due date</label>
        <input id="editMitigationDueAt" name="mitigationDueAt" type="date" value="${escapeHtml(dueValue)}" required>
      </div>
      <button type="submit" class="btn-primary btn-primary--auto">Save mitigation plan</button>
    </form>
  </section>`;
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

function ticketMitigationPage(user, ticket, { flash, error } = {}) {
  const t = ticket;
  const ref = t.reference;
  const backHref = t.status === 'audit_returned' ? '/officer/review' : '/officer/monitoring';
  const editable = canOfficerEditMitigation(t);

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title)}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}</p>
      </div>
      <a href="${backHref}" class="btn-outline">Back</a>
    </div>
    ${ticketReadonlySections(t, { monitoring: true })}
    ${officerPlanCommentsRow(t, ref, { editable })}
    ${executiveCommentsBlock(t, ref)}
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}`;

  return appLayout({
    title: `Mitigation plan ${ref}`,
    user,
    activeNav: t.status === 'audit_returned' ? 'review' : 'monitoring',
    body,
    wide: true,
    navVariant: 'officer',
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
    ${commentsSection(t.comments, {
      postAction: `/officer/tickets/${escapeHtml(ref)}/comment`,
      placeholder: 'Private comment for the Audit Officer (not visible to the department)…',
    })}
    ${executiveCommentsBlock(t, ref)}
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
        <button type="submit" class="btn-primary btn-primary--auto">Accept &amp; submit for audit</button>
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
    ${mitigationPlanHistorySection(t.mitigationPlanHistory)}
    ${commentsSection(t.comments, {
      postAction: `/officer/tickets/${escapeHtml(ref)}/comment`,
      placeholder: 'Private comment for the Audit Officer…',
    })}
    ${executiveCommentsBlock(t, ref)}
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

function ticketViewPage(user, ticket, { flash, backHref, activeNav, layout } = {}) {
  const t = ticket;
  const ref = t.reference;
  const monitoring = layout === 'monitoring';
  const nav = activeNav || 'tickets';
  const back = backHref || '/officer/tickets';
  const backLabel = monitoring ? 'Back to monitoring' : 'Back to all tickets';

  const body = monitoring
    ? `
    ${flashMessage(flash)}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title)}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}</p>
      </div>
      <a href="${back}" class="btn-outline">${backLabel}</a>
    </div>
    ${ticketReadonlySections(t, { monitoring: true })}
    ${officerPlanCommentsRow(t, ref, { editable: canOfficerEditMitigation(t) })}
    ${executiveCommentsBlock(t, ref)}
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}`
    : `
    ${flashMessage(flash)}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title)}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}</p>
      </div>
      <a href="${back}" class="btn-outline">${backLabel}</a>
    </div>
    ${ticketReadonlySections(t)}
    ${canOfficerEditMitigation(t) ? editMitigationPlanSection(t) : ''}
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}
    ${commentsSection(t.comments, {
      postAction: `/officer/tickets/${escapeHtml(ref)}/comment`,
      placeholder: 'Private comment for the Audit Officer…',
    })}
    ${executiveCommentsBlock(t, ref)}`;

  return appLayout({
    title: t.reference,
    user,
    activeNav: nav,
    body,
    wide: true,
    navVariant: 'officer',
  });
}

const MONITORING_VIEW_STATUSES = ['in_mitigation', 'under_audit', 'returned', 'reopened'];

function renderOfficerTicketPage(user, ticket, opts) {
  if (ticket.status === 'under_review') {
    return ticketReviewPage(user, ticket, opts);
  }
  if (ticket.status === 'under_audit' || ticket.status === 'audit_returned') {
    return ticketMitigationPage(user, ticket, opts);
  }
  if (ticket.status === 'pending_audit') {
    const accomplishment = getAccomplishmentForTicket(ticket);
    return ticketFinalValidationPage(user, ticket, accomplishment, opts);
  }
  if (MONITORING_VIEW_STATUSES.includes(ticket.status)) {
    return ticketViewPage(user, ticket, {
      ...opts,
      layout: 'monitoring',
      backHref: '/officer/monitoring',
      activeNav: 'monitoring',
    });
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
