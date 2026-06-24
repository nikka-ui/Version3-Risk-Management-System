const { getCategoryLabel, getStatusLabel, getStatusTone } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { getAccomplishmentForTicket, canOfficerEditMitigation } = require('../tickets');
const { flashMessage } = require('./layout');
const { officerAppLayout } = require('./officer-layout');
const { matrixCellTier } = require('../tickets');
const { evidenceSection } = require('./evidence');
const {
  supTicketHead,
  supDetailCard,
  supDecisionPanel,
} = require('./console-ui');

function statusPill(status, overdue) {
  const tone = overdue ? 'bad' : getStatusTone(status);
  return `<span class="pill pill--${tone}">${escapeHtml(getStatusLabel(status))}</span>`;
}

const KPI_ICONS = {
  total: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
  review: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  final: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  mitigation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  overdue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  closed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
};

function kpiCard(href, icon, value, label, variant = '') {
  return `<a href="${href}" class="sup-kpi${variant ? ` ${variant}` : ''}">
    <span class="sup-kpi__icon">${icon}</span>
    <span class="sup-kpi__body">
      <span class="sup-kpi__value">${value}</span>
      <span class="sup-kpi__label">${escapeHtml(label)}</span>
    </span>
  </a>`;
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

function officerNotesCard(ticket) {
  const version = ticket.mitigationPlanVersion
    ? ` <span class="text-muted">(v${ticket.mitigationPlanVersion})</span>`
    : '';

  if (!ticket.officerNotes) {
    return supDetailCard('Solution / mitigation plan', '<p class="sup-muted-block">No mitigation plan on record.</p>');
  }

  const inner = `<div class="officer-notes-scroll">${escapeHtml(ticket.officerNotes)}</div>
    ${ticket.mitigationDueAt ? `<p class="sup-muted-block">Due: ${escapeHtml(formatDate(ticket.mitigationDueAt))}</p>` : ''}`;

  return supDetailCard(`Solution / mitigation plan${version}`, inner, { accent: true });
}

function officerPlanSection(ticket, ref, { editable = false } = {}) {
  if (editable) {
    return editMitigationPlanSection(ticket);
  }
  return officerNotesCard(ticket);
}

function ticketReadonlySections(ticket, { monitoring = false } = {}) {
  const t = ticket;
  const riskLevel = ticketRiskLevel(t);
  const categoryLabel = t.categoryLabel || getCategoryLabel(t.category);

  const aiInner = t.ai
    ? `<p class="sup-muted-block">${escapeHtml(t.ai.summary)}</p>
        <dl class="detail-dl detail-dl--console">
          <dt>Likelihood</dt><dd>${t.ai.likelihood || t.likelihood}/5</dd>
          <dt>Impact</dt><dd>${t.ai.impact || t.impact}/5</dd>
          <dt>Confidence</dt><dd>${Math.round((t.ai.confidence || 0) * 100)}%</dd>
          <dt>Manual review</dt><dd>${t.ai.manualReviewRequired ? 'Required' : 'No'}</dd>
        </dl>`
    : '<p class="sup-muted-block">No AI classification available.</p>';

  const solutionInner = t.officerNotes
    ? `<p>${escapeHtml(t.officerNotes)}</p>
        ${t.mitigationDueAt ? `<p class="sup-muted-block">Proposed implementation due: ${escapeHtml(formatDate(t.mitigationDueAt))}</p>` : ''}`
    : '';

  const auditInner = t.auditNotes ? `<p>${escapeHtml(t.auditNotes)}</p>` : '';

  const detailInner = monitoring
    ? `<dl class="detail-dl detail-dl--console">
        <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
        <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
        <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel)}</dd>
        <dt>Category</dt><dd>${escapeHtml(categoryLabel)}</dd>
        <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
        <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
      </dl>
      <p class="sup-detail-desc">${escapeHtml(t.description || '—')}</p>`
    : `<dl class="detail-dl detail-dl--console">
        <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
        <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
        <dt>Category</dt><dd>${escapeHtml(categoryLabel)}</dd>
        <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
        <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
      </dl>
      <p class="sup-detail-desc">${escapeHtml(t.description || '—')}</p>`;

  const evidence = evidenceSection(t, {
    attachmentBasePath: '/officer/attachments',
    compact: monitoring,
    theme: 'console',
  });

  return `<div class="sup-detail-stack">
    ${supDetailCard('Risk details', detailInner)}
    ${supDetailCard('5W1H report', fiveW1HReadonly(t))}
    ${evidence}
    ${!monitoring && t.ai ? supDetailCard('AI classification', aiInner, { compact: true }) : ''}
    ${!monitoring && t.officerNotes ? supDetailCard(`Solution / mitigation plan${t.mitigationPlanVersion ? ` <span class="text-muted">(v${t.mitigationPlanVersion})</span>` : ''}`, solutionInner, { accent: true }) : ''}
    ${t.auditNotes && t.status === 'audit_returned' ? supDetailCard('Audit Officer feedback', auditInner) : ''}
  </div>`;
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
      ? 'Saving will update the plan and resubmit it to the Audit Officer for review.'
      : 'Update the proposed solution while it is under audit review.';

  const formHtml = `<form method="post" action="/officer/tickets/${escapeHtml(ref)}/update-mitigation" class="stack-form stack-form--console">
      <div class="field">
        <label for="editMitigationPlan">Solution / mitigation plan *</label>
        <textarea id="editMitigationPlan" name="mitigationPlan" rows="${inSplitRow ? 8 : 6}" required>${escapeHtml(ticket.officerNotes || '')}</textarea>
      </div>
      <div class="field">
        <label for="editMitigationDueAt">Implementation due date</label>
        <input id="editMitigationDueAt" name="mitigationDueAt" type="date" value="${escapeHtml(dueValue)}" required>
      </div>
      <button type="submit" class="sup-btn-primary">Save mitigation plan</button>
    </form>`;

  if (inSplitRow) {
    return `<section class="${cardClass}">
    <h2>Edit solution / mitigation plan</h2>
    ${formHtml}
  </section>`;
  }

  return supDecisionPanel({
    title: 'Edit solution / mitigation plan',
    desc: resubmitHint,
    bodyHtml: formHtml,
  });
}

function officerPageLayout(opts) {
  const { stats, ...rest } = opts;
  return officerAppLayout({ stats, ...rest });
}

function quickActionsBar(stats) {
  const actions = [
    { href: '/officer/review', label: 'Review queue', count: stats.awaitingReview },
    { href: '/officer/final-validation', label: 'Final validation', count: stats.awaitingFinalValidation },
    { href: '/officer/monitoring', label: 'Monitoring', count: stats.inMitigation },
    { href: '/officer/tickets', label: 'All reports', count: stats.total },
  ];

  return `<div class="ticket-filters officer-quick-actions" aria-label="Quick actions">
    ${actions
      .map(
        (a) => `<a href="${a.href}" class="filter-pill">${escapeHtml(a.label)} <span class="filter-pill__count">${a.count}</span></a>`,
      )
      .join('')}
  </div>`;
}

function departmentTiles(departments) {
  if (!departments.length) {
    return `<p class="sup-empty">No risk reports submitted yet.</p>`;
  }
  const palette = ['#B7DBE1', '#FFEFAD', '#FFADC0', '#EEF6F8'];
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
    <div class="sup-page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="sup-page-desc">Welcome, Risk Management Officer — overview of risk reports, validation queues, and mitigation status.</p>
      </div>
      <a href="/officer/review" class="sup-btn-primary">Review queue (${stats.awaitingReview})</a>
    </div>
    <div class="sup-kpi-grid sup-kpi-grid--officer">
      ${kpiCard('/officer/tickets', KPI_ICONS.total, stats.total, 'Total reports', 'sup-kpi--accent')}
      ${kpiCard('/officer/review', KPI_ICONS.review, stats.awaitingReview, 'Pending review')}
      ${kpiCard('/officer/final-validation', KPI_ICONS.final, stats.awaitingFinalValidation, 'Final validation')}
      ${kpiCard('/officer/monitoring', KPI_ICONS.mitigation, stats.inMitigation, 'In mitigation')}
      ${kpiCard('/officer/monitoring', KPI_ICONS.overdue, stats.overdueMitigation, 'Overdue', stats.overdueMitigation ? 'sup-kpi--warn' : '')}
      <div class="sup-kpi">
        <span class="sup-kpi__icon">${KPI_ICONS.closed}</span>
        <span class="sup-kpi__body">
          <span class="sup-kpi__value">${stats.closed}</span>
          <span class="sup-kpi__label">Closed</span>
        </span>
      </div>
    </div>
    ${quickActionsBar(stats)}
    <div class="officer-dash-grid">
      <section class="sup-card">
        <div class="sup-card__head">
          <h2>Risk reports per department</h2>
          <a href="/officer/tickets" class="sup-link">View all</a>
        </div>
        <div class="sup-card__body">${departmentTiles(departments)}</div>
      </section>
      <section class="sup-card">
        <div class="sup-card__head">
          <h2>Risk incident matrix</h2>
        </div>
        <div class="sup-card__body">${riskMatrixGrid(matrix)}</div>
      </section>
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
    <div class="sup-page-head">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p class="sup-page-desc">${escapeHtml(desc)}</p>
      </div>
    </div>
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table sup-table">
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
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref,
      backLabel: t.status === 'audit_returned' ? 'Back to review queue' : 'Back to monitoring',
    })}
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

  const decisionBody = `
    <form method="post" action="/officer/tickets/${escapeHtml(ref)}/accept" class="stack-form stack-form--console">
      <h3 class="sup-section-sub">Accept &amp; assign mitigation</h3>
      <div class="field">
        <label for="mitigationPlan">Mitigation plan / officer notes *</label>
        <textarea id="mitigationPlan" name="mitigationPlan" rows="4" required placeholder="Describe approved actions, owners, and expectations…"></textarea>
      </div>
      <div class="field">
        <label for="mitigationDueAt">Implementation due date</label>
        <input id="mitigationDueAt" name="mitigationDueAt" type="date" value="${dueValue}">
      </div>
      <button type="submit" class="sup-btn-primary">Accept &amp; submit for audit</button>
    </form>
    <form method="post" action="/officer/tickets/${escapeHtml(ref)}/reject" class="stack-form stack-form--console stack-form--divider">
      <h3 class="sup-section-sub">Return for revision</h3>
      <div class="field">
        <label for="rejectionNotes">Rejection notes *</label>
        <textarea id="rejectionNotes" name="rejectionNotes" rows="3" required placeholder="Explain what the department must correct…"></textarea>
      </div>
      <button type="submit" class="btn-danger">Return to department</button>
    </form>`;

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: '/officer/review',
      backLabel: 'Back to review queue',
    })}
    ${ticketReadonlySections(t)}
    ${supDecisionPanel({
      title: 'RMO decision',
      desc: 'Per workflow step 3: accept the report and define a mitigation plan, or return it to the department for revision.',
      bodyHtml: decisionBody,
    })}`;

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

  const decisionBody = `
    <form method="post" action="/officer/tickets/${escapeHtml(ref)}/close" class="stack-form stack-form--console">
      <h3 class="sup-section-sub">Close ticket</h3>
      <div class="field">
        <label for="closingNotes">Closing notes (optional)</label>
        <textarea id="closingNotes" name="closingNotes" rows="2" placeholder="Summary of validation outcome…"></textarea>
      </div>
      <button type="submit" class="sup-btn-primary">Close ticket</button>
    </form>
    <form method="post" action="/officer/tickets/${escapeHtml(ref)}/return-accomplishment" class="stack-form stack-form--console stack-form--divider">
      <h3 class="sup-section-sub">Return for further implementation</h3>
      <div class="field">
        <label for="returnNotes">Return notes *</label>
        <textarea id="returnNotes" name="returnNotes" rows="3" required placeholder="Describe gaps in the accomplishment report…"></textarea>
      </div>
      <button type="submit" class="btn-danger">Return to department</button>
    </form>`;

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: '/officer/final-validation',
      backLabel: 'Back to final validation',
    })}
    ${ticketReadonlySections(t)}
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}
    ${accBlock}
    ${supDecisionPanel({
      title: 'Final validation',
      desc: 'Per workflow step 6: confirm mitigation effectiveness and close the ticket, or return for further implementation.',
      bodyHtml: decisionBody,
    })}`;

  return officerPageLayout({
    title: `Final validation ${ref}`,
    user,
    activeNav: 'final',
    body,
    stats,
  });
}

function ticketViewPage(user, ticket, { flash, backHref, activeNav, layout, stats, extraBody } = {}) {
  const t = ticket;
  const ref = t.reference;
  const monitoring = layout === 'monitoring';
  const nav = activeNav || 'reports';
  const back = backHref || '/officer/tickets';
  const backLabel = monitoring ? 'Back to monitoring' : 'Back to risk reports';

  const body = monitoring
    ? `
    ${flashMessage(flash)}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: back,
      backLabel,
    })}
    ${ticketReadonlySections(t, { monitoring: true })}
    ${officerPlanSection(t, ref, { editable: canOfficerEditMitigation(t) })}
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}
    ${extraBody || ''}`
    : `
    ${flashMessage(flash)}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: back,
      backLabel,
    })}
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
    const acc = accomplishment;
    const accBlock = acc
      ? `<section class="card card--accent">
          <h2>Accomplishment report</h2>
          <p class="text-muted">Submitted by ${escapeHtml(acc.submittedByName || acc.submittedBy)} on ${escapeHtml(formatDate(acc.submittedAt))}</p>
          <p class="text-muted" style="margin-top:0.75rem">Awaiting Audit Officer review. You can monitor this ticket but cannot close it from the RMO console.</p>
          <h2 class="section-sub">Implementation summary</h2>
          <p>${escapeHtml(acc.summary)}</p>
          <h2 class="section-sub">Outcomes and results</h2>
          <p>${escapeHtml(acc.outcomes)}</p>
        </section>`
      : `<section class="card"><p class="text-muted">Accomplishment record not found.</p></section>`;
    return ticketViewPage(user, ticket, {
      ...opts,
      layout: 'monitoring',
      backHref: '/officer/monitoring',
      activeNav: 'monitoring',
      extraBody: accBlock,
    });
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
