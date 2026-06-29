const { getCategoryLabel, getStatusLabel, getStatusTone } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { getAccomplishmentForTicket, canOfficerEditMitigation } = require('../tickets');
const { flashMessage, executiveCommentsSection, commentsSection } = require('./layout');
const { officerAppLayout } = require('./officer-layout');
const { layoutNotifications } = require('../notifications');
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

function officerFormField({ id, label, hint, inputHtml }) {
  return `<div class="field field--console">
    <label for="${escapeHtml(id)}">${label}</label>
    ${hint ? `<p class="field-hint">${hint}</p>` : ''}
    ${inputHtml}
  </div>`;
}

function officerDecisionActions(panels, { single = false } = {}) {
  const cards = panels
    .map(
      (panel) => `<section class="decision-action-card decision-action-card--${escapeHtml(panel.variant || 'default')}">
      <h3 class="decision-action-card__title">${panel.title}</h3>
      ${panel.hint ? `<p class="decision-action-card__hint">${escapeHtml(panel.hint)}</p>` : ''}
      ${panel.formHtml}
    </section>`,
    )
    .join('');
  const gridClass = single ? 'decision-actions decision-actions--single' : 'decision-actions';
  return `<div class="${gridClass}">${cards}</div>`;
}

const KPI_ICONS = {
  total: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
  review: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  final: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  mitigation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  overdue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  closed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  returned: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
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

function executiveCommentsBlock(ticket, ref) {
  return executiveCommentsSection(ticket.executiveComments || [], {
    replyAction: `/officer/tickets/${escapeHtml(ref)}/executive-reply`,
    canReply: true,
  });
}

function privateCommentsBlock(ticket, ref) {
  return commentsSection(ticket.comments || ticket.privateComments || [], {
    postAction: `/officer/tickets/${escapeHtml(ref)}/comment`,
    placeholder: 'Private comment for the Audit Officer (not visible to the department)…',
    compact: true,
  });
}

function commentSectionsBlock(ticket, ref) {
  return `<div class="sup-detail-stack sup-detail-stack--comments">
    ${privateCommentsBlock(ticket, ref)}
    ${executiveCommentsBlock(ticket, ref)}
  </div>`;
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
    interactive: true,
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

function accomplishmentReportSection(accomplishment, { notice = '' } = {}) {
  const acc = accomplishment;
  if (!acc) {
    return supDetailCard('Accomplishment report', '<p class="sup-muted-block">Accomplishment record not found.</p>');
  }

  const evidenceBlock = (acc.evidence || []).length
    ? `<div class="accomplishment-block">
        <h3 class="accomplishment-block__label">Evidence references</h3>
        <ul class="accomplishment-block__list">${(acc.evidence || [])
          .map((e) => `<li>${escapeHtml(e.name || e.originalName || '—')}</li>`)
          .join('')}</ul>
      </div>`
    : '';

  const inner = `
    <p class="sup-muted-block accomplishment-report__meta">Submitted by ${escapeHtml(acc.submittedByName || acc.submittedBy)} on ${escapeHtml(formatDate(acc.submittedAt))}</p>
    ${notice ? `<p class="accomplishment-notice">${escapeHtml(notice)}</p>` : ''}
    <div class="accomplishment-blocks">
      <div class="accomplishment-block">
        <h3 class="accomplishment-block__label">Implementation summary</h3>
        <p class="accomplishment-block__content">${escapeHtml(acc.summary)}</p>
      </div>
      <div class="accomplishment-block">
        <h3 class="accomplishment-block__label">Outcomes and results</h3>
        <p class="accomplishment-block__content">${escapeHtml(acc.outcomes)}</p>
      </div>
      ${evidenceBlock}
    </div>`;

  return supDetailCard('Accomplishment report', inner, { accent: true });
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
              <span class="audit-trail-current__label">Updated plan</span>
              <p class="audit-trail-current__plan">${escapeHtml(h.updated?.plan || '—')}</p>
              ${h.updated?.dueAt ? `<p class="audit-trail-current__due">Due: ${escapeHtml(formatDate(h.updated.dueAt))}</p>` : ''}
            </div>
          </li>`;
        })
        .join('')
    : '<li class="text-muted">No plan revisions recorded yet.</li>';

  return `<section class="sup-card sup-card--history">
    <div class="sup-card__head"><h2>Mitigation plan history</h2></div>
    <div class="sup-card__body">
      <p class="sup-muted-block">Audit trail of solution changes (previous and updated values).</p>
      <ul class="audit-trail-list">${items}</ul>
    </div>
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
  const isAuditReturned = ticket.status === 'audit_returned';
  const panelDesc = isAuditReturned
    ? 'The Audit Officer returned this plan. Update it and resubmit for review.'
    : 'This ticket is under audit review. You can still adjust the mitigation plan if needed.';
  const cardHint = isAuditReturned
    ? 'Update the plan and resubmit it to the Audit Officer.'
    : 'Adjust approved actions, owners, or the due date while audit review is in progress.';

  const formHtml = `<form method="post" action="/officer/tickets/${escapeHtml(ref)}/update-mitigation" class="stack-form stack-form--console">
      ${officerFormField({
        id: 'editMitigationPlan',
        label: 'Mitigation plan',
        hint: 'Required. Update the approved actions, owners, and expectations.',
        inputHtml: `<textarea id="editMitigationPlan" name="mitigationPlan" rows="${inSplitRow ? 8 : 6}" required>${escapeHtml(ticket.officerNotes || '')}</textarea>`,
      })}
      ${officerFormField({
        id: 'editMitigationDueAt',
        label: 'Implementation due date',
        hint: 'When the department should complete the mitigation.',
        inputHtml: `<input id="editMitigationDueAt" name="mitigationDueAt" type="date" value="${escapeHtml(dueValue)}" required>`,
      })}
      <button type="submit" class="btn-accept--outline">Save mitigation plan</button>
    </form>`;

  if (inSplitRow) {
    return `<section class="${cardClass}">
    <h2>Edit mitigation plan</h2>
    ${formHtml}
  </section>`;
  }

  return supDecisionPanel({
    title: 'Edit mitigation plan',
    desc: panelDesc,
    bodyHtml: officerDecisionActions(
      [
        {
          variant: 'accept',
          title: 'Mitigation plan',
          hint: cardHint,
          formHtml,
        },
      ],
      { single: true },
    ),
  });
}

function officerPageLayout(opts) {
  const { stats, user, ...rest } = opts;
  const notifications = opts.notifications || layoutNotifications(user);
  return officerAppLayout({ stats, user, notifications, ...rest });
}

function quickActionsBar(stats) {
  const actions = [
    { href: '/officer/review', label: 'Review queue', count: stats.awaitingReview },
    { href: '/officer/review?filter=audit_returned', label: 'Returned by audit', count: stats.returnedByAudit },
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
      <a href="/officer/review" class="filter-pill filter-pill--head">Review queue <span class="filter-pill__count">${stats.awaitingReview}</span></a>
    </div>
    <div class="sup-kpi-grid sup-kpi-grid--officer">
      ${kpiCard('/officer/tickets', KPI_ICONS.total, stats.total, 'Total reports', 'sup-kpi--accent')}
      ${kpiCard('/officer/review', KPI_ICONS.review, stats.pendingReview, 'Pending review')}
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
      ${kpiCard('/officer/review?filter=audit_returned', KPI_ICONS.returned, stats.returnedByAudit, 'Returned by audit', stats.returnedByAudit > 0 ? 'sup-kpi--warn' : '')}
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
  const auditReturned = opts.filter === 'audit_returned';
  return queueListPage(user, {
    title: auditReturned ? 'Returned by audit' : 'Review queue',
    desc: auditReturned
      ? 'Mitigation solutions returned by the Audit Officer. Revise the plan and resubmit for audit review.'
      : 'Risk reports submitted by department supervisors awaiting your validation (accept and assign mitigation, or return for revision).',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'reports',
    emptyMessage: auditReturned
      ? 'No tickets returned by the Audit Officer.'
      : 'No tickets awaiting RMO review.',
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
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}
    ${commentSectionsBlock(t, ref)}`;

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

  const decisionBody = officerDecisionActions([
    {
      variant: 'accept',
      title: 'Accept &amp; assign mitigation',
      hint: 'Approve this report and send your mitigation plan to the Audit Officer.',
      formHtml: `<form method="post" action="/officer/tickets/${escapeHtml(ref)}/accept" class="stack-form stack-form--console">
        ${officerFormField({
          id: 'mitigationPlan',
          label: 'Mitigation plan',
          hint: 'Required. Describe approved actions, responsible owners, and what success looks like.',
          inputHtml: `<textarea id="mitigationPlan" name="mitigationPlan" rows="4" required placeholder="e.g. Replace overloaded outlet, assign maintenance lead, inspect adjacent rooms within 48 hours…"></textarea>`,
        })}
        ${officerFormField({
          id: 'mitigationDueAt',
          label: 'Implementation due date',
          hint: 'Target date for the department to complete the mitigation.',
          inputHtml: `<input id="mitigationDueAt" name="mitigationDueAt" type="date" value="${dueValue}">`,
        })}
        <button type="submit" class="btn-accept--outline">Accept &amp; submit for audit</button>
      </form>`,
    },
    {
      variant: 'return',
      title: 'Return for revision',
      hint: 'Send the report back to the department if details are missing or need correction.',
      formHtml: `<form method="post" action="/officer/tickets/${escapeHtml(ref)}/reject" class="stack-form stack-form--console">
        ${officerFormField({
          id: 'rejectionNotes',
          label: 'Feedback for the department',
          hint: 'Required. Be specific about what must be updated before resubmission.',
          inputHtml: `<textarea id="rejectionNotes" name="rejectionNotes" rows="4" required placeholder="e.g. Add photos of the affected area and confirm who was on site when the incident occurred…"></textarea>`,
        })}
        <button type="submit" class="btn-danger--outline">Return to department</button>
      </form>`,
    },
  ]);

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
    ${commentSectionsBlock(t, ref)}
    ${supDecisionPanel({
      title: 'Your decision',
      desc: 'Review the risk report above, then choose whether to accept it or return it to the department.',
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

  const accBlock = accomplishmentReportSection(acc);

  const decisionBody = officerDecisionActions([
    {
      variant: 'accept',
      title: 'Close ticket',
      hint: 'Confirm the mitigation was effective and close this risk report.',
      formHtml: `<form method="post" action="/officer/tickets/${escapeHtml(ref)}/close" class="stack-form stack-form--console">
        ${officerFormField({
          id: 'closingNotes',
          label: 'Closing notes',
          hint: 'Optional. Summarize the validation outcome for the record.',
          inputHtml: `<textarea id="closingNotes" name="closingNotes" rows="3" placeholder="e.g. Mitigation verified on site; no further action required…"></textarea>`,
        })}
        <button type="submit" class="btn-accept--outline">Close ticket</button>
      </form>`,
    },
    {
      variant: 'return',
      title: 'Return for further implementation',
      hint: 'Send the accomplishment report back if gaps remain in the mitigation work.',
      formHtml: `<form method="post" action="/officer/tickets/${escapeHtml(ref)}/return-accomplishment" class="stack-form stack-form--console">
        ${officerFormField({
          id: 'returnNotes',
          label: 'Feedback for the department',
          hint: 'Required. Explain what still needs to be completed or documented.',
          inputHtml: `<textarea id="returnNotes" name="returnNotes" rows="4" required placeholder="e.g. Provide updated photos and a signed completion checklist…"></textarea>`,
        })}
        <button type="submit" class="btn-danger--outline">Return to department</button>
      </form>`,
    },
  ]);

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
    ${commentSectionsBlock(t, ref)}
    ${supDecisionPanel({
      title: 'Final validation',
      desc: 'Review the accomplishment report above, then close the ticket or return it for further work.',
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
    ${commentSectionsBlock(t, ref)}
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
    ${(t.mitigationPlanHistory || []).length ? mitigationPlanHistorySection(t.mitigationPlanHistory) : ''}
    ${commentSectionsBlock(t, ref)}`;

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
    const accBlock = accomplishmentReportSection(accomplishment, {
      notice: 'Awaiting Audit Officer review. You can monitor this ticket but cannot close it from the RMO console.',
    });
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
