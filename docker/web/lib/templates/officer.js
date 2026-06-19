const { getCategoryLabel, getStatusLabel } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { getAccomplishmentForTicket, canOfficerEditMitigation } = require('../tickets');
const { flashMessage } = require('./layout');
const { officerAppLayout } = require('./officer-layout');
const { matrixCellTier } = require('../tickets');
const { evidenceSection } = require('./evidence');

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
  return evidenceSection(ticket, { attachmentBasePath: '/officer/attachments', compact: true });
}

function officerNotesCard(ticket) {
  const version = ticket.mitigationPlanVersion
    ? ` <span class="text-muted">(v${ticket.mitigationPlanVersion})</span>`
    : '';
  const due = ticket.mitigationDueAt
    ? `<p class="text-muted officer-notes-meta">Due: ${escapeHtml(formatDate(ticket.mitigationDueAt))}</p>`
    : '';

  if (!ticket.officerNotes) {
    return `<section class="card card--accent">
      <h2>Solution / mitigation plan</h2>
      <p class="text-muted">No mitigation plan on record.</p>
    </section>`;
  }

  return `<section class="card card--accent">
    <h2>Solution / mitigation plan${version}</h2>
    <div class="officer-notes-scroll">${escapeHtml(ticket.officerNotes)}</div>
    ${due}
  </section>`;
}

function officerPlanSection(ticket, ref, { editable = false } = {}) {
  if (editable) {
    return editMitigationPlanSection(ticket);
  }
  return officerNotesCard(ticket);
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

  const evidenceBlock = monitoring
    ? evidenceCompactSection(t)
    : evidenceSection(t, { attachmentBasePath: '/officer/attachments' });

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
    ${evidenceBlock}
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

function officerPageLayout(opts) {
  const { stats: _stats, ...rest } = opts;
  return officerAppLayout(rest);
}

function quickActionIcon(name) {
  const icons = {
    review: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    final: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
    monitoring: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
    tickets: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  };
  return icons[name] || '';
}

function quickActionsBar(stats) {
  const actions = [
    { href: '/officer/review', label: 'Review queue', count: stats.awaitingReview, icon: 'review' },
    { href: '/officer/final-validation', label: 'Final validation', count: stats.awaitingFinalValidation, icon: 'final' },
    { href: '/officer/monitoring', label: 'Monitoring', count: stats.inMitigation, icon: 'monitoring' },
    { href: '/officer/tickets', label: 'All reports', count: stats.total, icon: 'tickets' },
  ];

  return `<section class="officer-quick-bar">
    <span class="officer-quick-bar__title">Quick actions</span>
    <div class="officer-quick-bar__items">
      ${actions
        .map(
          (a) => `<a href="${a.href}" class="officer-quick-bar__item">
            <span class="officer-quick-bar__icon">${quickActionIcon(a.icon)}</span>
            <span class="officer-quick-bar__label">${escapeHtml(a.label)}</span>
            <span class="officer-quick-bar__count">${a.count}</span>
          </a>`,
        )
        .join('')}
    </div>
  </section>`;
}

function kpiIcon(name) {
  const icons = {
    total: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
    pending: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    final: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
    mitigation: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
    overdue: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>`,
    closed: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`,
  };
  return icons[name] || '';
}

function kpiCard({ value, label, icon, variant = 'default', href }) {
  const inner = `<div class="officer-kpi__icon">${kpiIcon(icon)}</div>
    <div class="officer-kpi__body">
      <span class="officer-kpi__value">${value}</span>
      <span class="officer-kpi__label">${escapeHtml(label)}</span>
    </div>`;
  const cls = `officer-kpi officer-kpi--${variant}`;
  if (href) {
    return `<a href="${href}" class="${cls}">${inner}</a>`;
  }
  return `<div class="${cls}">${inner}</div>`;
}

function departmentTiles(departments) {
  if (!departments.length) {
    return `<p class="officer-empty">No risk reports submitted yet.</p>`;
  }
  const palette = ['#B7DBE1', '#FFEFAD', '#FFADC0', '#69B5A6'];
  return `<div class="officer-dept-grid">
    ${departments
      .map((d, i) => {
        const color = palette[i % palette.length];
        const initial = d.name.trim().charAt(0).toUpperCase();
        return `<div class="officer-dept-tile">
          <span class="officer-dept-tile__icon" style="--dept-color:${color}">${escapeHtml(initial)}</span>
          <div class="officer-dept-tile__meta">
            <span class="officer-dept-tile__name">${escapeHtml(d.name)}</span>
            <span class="officer-dept-tile__count">${d.count} report${d.count === 1 ? '' : 's'}</span>
          </div>
        </div>`;
      })
      .join('')}
  </div>`;
}

const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];
const LIKELIHOOD_LABELS = ['Almost certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];

function riskMatrixGrid(matrix) {
  const header = `<div class="rm-matrix__corner"></div>
    ${IMPACT_LABELS.map((l) => `<div class="rm-matrix__col-head">${escapeHtml(l)}</div>`).join('')}`;

  const rows = matrix
    .map((row, rowIdx) => {
      const likelihood = 5 - rowIdx;
      const rowHead = `<div class="rm-matrix__row-head">${escapeHtml(LIKELIHOOD_LABELS[rowIdx])}</div>`;
      const cells = row
        .map((count, colIdx) => {
          const impact = colIdx + 1;
          const tier = matrixCellTier(likelihood, impact);
          return `<div class="rm-matrix__cell rm-matrix__cell--${tier}" title="Likelihood ${likelihood} × Impact ${impact}">
            <span class="rm-matrix__count">${count || ''}</span>
          </div>`;
        })
        .join('');
      return rowHead + cells;
    })
    .join('');

  return `<div class="rm-matrix" role="img" aria-label="Risk incident matrix by likelihood and impact">
    <div class="rm-matrix__axis rm-matrix__axis--x">Impact →</div>
    <div class="rm-matrix__axis rm-matrix__axis--y">Likelihood →</div>
    <div class="rm-matrix__grid">${header}${rows}</div>
    <div class="rm-matrix__legend">
      <span class="rm-matrix__legend-item rm-matrix__legend-item--low">Low</span>
      <span class="rm-matrix__legend-item rm-matrix__legend-item--moderate">Moderate</span>
      <span class="rm-matrix__legend-item rm-matrix__legend-item--high">High</span>
      <span class="rm-matrix__legend-item rm-matrix__legend-item--critical">Critical</span>
    </div>
  </div>`;
}

function officerOverviewPage(user, dashboard, flash) {
  const { stats, departments, matrix } = dashboard;
  const body = `
    ${flashMessage(flash)}
    <div class="officer-dashboard">
      <header class="officer-dashboard__head">
        <h1 class="officer-dashboard__title">Dashboard</h1>
        <p class="officer-dashboard__greeting">Welcome, Risk Management Officer!</p>
      </header>

      <div class="officer-kpi-grid">
        ${kpiCard({ value: stats.total, label: 'Total risk reports', icon: 'total', variant: 'highlight', href: '/officer/tickets' })}
        ${kpiCard({ value: stats.awaitingReview, label: 'Pending reports', icon: 'pending', href: '/officer/review' })}
        ${kpiCard({ value: stats.awaitingFinalValidation, label: 'Final validation', icon: 'final', href: '/officer/final-validation' })}
        ${kpiCard({ value: stats.inMitigation, label: 'Mitigation', icon: 'mitigation', href: '/officer/monitoring' })}
        ${kpiCard({ value: stats.overdueMitigation, label: 'Overdue mitigation', icon: 'overdue', variant: stats.overdueMitigation ? 'warn' : 'default', href: '/officer/monitoring' })}
        ${kpiCard({ value: stats.closed, label: 'Closed', icon: 'closed' })}
      </div>

      ${quickActionsBar(stats)}

      <div class="officer-dashboard-grid">
        <section class="officer-panel">
          <div class="officer-panel__head">
            <h2>Risk reports per department</h2>
            <a href="/officer/tickets" class="officer-panel__link">View all</a>
          </div>
          ${departmentTiles(departments)}
        </section>

        <section class="officer-panel">
          <div class="officer-panel__head">
            <h2>Risk incident matrix</h2>
          </div>
          ${riskMatrixGrid(matrix)}
        </section>
      </div>
    </div>`;

  return officerPageLayout({
    title: 'Dashboard',
    user,
    activeNav: 'dashboard',
    body,
    stats,
  });
}

function queueListPage(user, { title, desc, tickets, flash, error, activeNav, emptyMessage, stats }) {
  const rows = ticketTableRows(tickets);
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="officer-page">
      <header class="officer-page__head">
        <h1 class="officer-page__title">${escapeHtml(title)}</h1>
        <p class="officer-page__desc">${escapeHtml(desc)}</p>
      </header>
      <section class="officer-panel officer-panel--table">
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
      </section>
    </div>`;

  return officerPageLayout({
    title,
    user,
    activeNav,
    body,
    stats,
  });
}

function reviewQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Review queue',
    desc: 'Risk reports submitted by department supervisors awaiting your validation (accept and assign mitigation, or return for revision).',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'reports',
    emptyMessage: 'No tickets awaiting RMO review.',
    stats: opts.stats,
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
    stats: opts.stats,
  });
}

function monitoringQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Implementation monitoring',
    desc: 'Tickets with approved mitigation plans currently with departments for implementation.',
    tickets,
    flash,
    activeNav: 'monitoring',
    emptyMessage: 'No tickets currently in mitigation.',
    stats: opts.stats,
  });
}

function allTicketsPage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Risk Reports',
    desc: 'Organization-wide risk tickets (excluding drafts).',
    tickets,
    flash,
    activeNav: 'reports',
    emptyMessage: 'No submitted tickets yet.',
    stats: opts.stats,
  });
}

function ticketMitigationPage(user, ticket, { flash, error, stats } = {}) {
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
    ${officerPlanSection(t, ref, { editable })}
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}`;

  return officerPageLayout({
    title: `Mitigation plan ${ref}`,
    user,
    activeNav: t.status === 'audit_returned' ? 'reports' : 'monitoring',
    body,
    stats,
  });
}

function ticketReviewPage(user, ticket, { flash, error, stats } = {}) {
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

  return officerPageLayout({
    title: `Review ${ref}`,
    user,
    activeNav: 'reports',
    body,
    stats,
  });
}

function ticketFinalValidationPage(user, ticket, accomplishment, { flash, error, stats } = {}) {
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
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}
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

  return officerPageLayout({
    title: `Final validation ${ref}`,
    user,
    activeNav: 'final',
    body,
    stats,
  });
}

function ticketViewPage(user, ticket, { flash, backHref, activeNav, layout, stats } = {}) {
  const t = ticket;
  const ref = t.reference;
  const monitoring = layout === 'monitoring';
  const nav = activeNav || 'reports';
  const back = backHref || '/officer/tickets';
  const backLabel = monitoring ? 'Back to monitoring' : 'Back to risk reports';

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
    ${officerPlanSection(t, ref, { editable: canOfficerEditMitigation(t) })}
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
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}`;

  return officerPageLayout({
    title: t.reference,
    user,
    activeNav: nav,
    body,
    stats,
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
