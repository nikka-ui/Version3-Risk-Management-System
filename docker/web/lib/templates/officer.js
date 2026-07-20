const { getCategoryLabel, getStatusLabel, getStatusTone, DEPARTMENTS } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { getAccomplishmentForTicket } = require('../tickets');
const { flashMessage } = require('./layout');
const { threadDiscussionSection } = require('./thread-discussion');
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

function aiReadonlyCard(ticket) {
  const t = ticket;
  if (!t.ai) {
    return supDetailCard('AI analysis', '<p class="sup-muted-block">No AI classification available.</p>', { compact: true });
  }
  const inner = `<p class="sup-muted-block">${escapeHtml(t.ai.summary)}</p>
    <dl class="detail-dl detail-dl--console">
      <dt>Category</dt><dd>${escapeHtml(t.categoryLabel || getCategoryLabel(t.category))}</dd>
      <dt>Likelihood</dt><dd>${t.ai.likelihood || t.likelihood}/5</dd>
      <dt>Impact</dt><dd>${t.ai.impact || t.impact}/5</dd>
      <dt>Confidence</dt><dd>${Math.round((t.ai.confidence || 0) * 100)}%</dd>
      <dt>Manual review</dt><dd>${t.ai.manualReviewRequired ? 'Required' : 'No'}</dd>
      <dt>Routed department</dt><dd>${escapeHtml(t.department || '—')}</dd>
    </dl>`;
  return supDetailCard('AI analysis (read-only)', inner, { compact: true });
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

function officerPlanSection(ticket) {
  return officerNotesCard(ticket);
}

function ownershipMonitorCard(ticket) {
  const state = ticket.ownership?.state || ticket.ownershipState || 'unassigned';
  const map = {
    pending: { cls: 'info', label: 'Awaiting department acceptance' },
    accepted: { cls: 'rmo', label: 'Owned by department' },
    rejected: { cls: 'warn', label: 'Returned by department' },
    unassigned: { cls: 'muted', label: 'Unassigned' },
  };
  const m = map[state] || map.unassigned;
  const owner = ticket.ownership?.ownerName || ticket.ownerName;
  const inner = `<p class="sup-muted-block">The RMU monitors this ticket but does <strong>not</strong> own it. Ownership rests with the responsible department.</p>
    <dl class="detail-dl detail-dl--console">
      <dt>Ownership</dt><dd><span class="pill pill--${m.cls}">${escapeHtml(m.label)}</span></dd>
      <dt>Responsible department</dt><dd>${escapeHtml(ticket.department || '—')}</dd>
      <dt>Department owner</dt><dd>${owner ? escapeHtml(owner) : '<span class="text-muted">—</span>'}</dd>
    </dl>`;
  return supDetailCard('Ownership (read-only)', inner, { compact: true });
}

function actionPlanReadonlyCard(ticket) {
  const plan = ticket.actionPlan;
  if (!plan) {
    return supDetailCard('Department action plan', '<p class="sup-muted-block">No department action plan submitted yet.</p>');
  }
  const inner = `<p>${escapeHtml(plan.summary)}</p>
    ${(plan.steps || []).length ? `<ol class="dept-plan__steps">${plan.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : ''}
    <p class="sup-muted-block">v${plan.version} · updated ${escapeHtml(formatDate(plan.updatedAt))}${plan.targetDate ? ` · target ${escapeHtml(formatDate(plan.targetDate))}` : ''}</p>`;
  return supDetailCard(`Department action plan <span class="text-muted">(v${plan.version})</span>`, inner, { accent: true });
}

function threadCommentsBlock(ticket, ref) {
  return threadDiscussionSection(ticket, ref, {
    title: 'Discussion thread',
    hint: '',
    postAction: `/officer/tickets/${ref}/thread-comment`,
    canPost: true,
    canReact: false,
    canEditOwn: false,
    showAttachments: false,
    composeLabel: 'Add comment',
    composePlaceholder: 'Comment visible to the reporter and responsible department…',
    submitLabel: 'Post comment',
  });
}

function ticketReadonlySections(ticket) {
  const t = ticket;
  const riskLevel = ticketRiskLevel(t);
  const categoryLabel = t.categoryLabel || getCategoryLabel(t.category);
  const due = t.mitigationDueAt || t.actionPlan?.targetDate;

  const detailInner = `<dl class="detail-dl detail-dl--console">
        <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.reporterDepartment || '—')})</dd>
        <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
        <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel)}</dd>
        <dt>Category</dt><dd>${escapeHtml(categoryLabel)}</dd>
        <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
        <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
        ${due ? `<dt>SLA / target date</dt><dd>${escapeHtml(formatDate(due))}${t.isOverdue ? ' <span class="pill pill--bad">Overdue</span>' : ''}</dd>` : ''}
      </dl>
      <p class="sup-detail-desc">${escapeHtml(t.description || '—')}</p>`;

  const evidence = evidenceSection(t, {
    attachmentBasePath: '/officer/attachments',
    compact: false,
    theme: 'console',
    interactive: true,
  });

  return `<div class="sup-detail-stack">
    ${ownershipMonitorCard(t)}
    ${supDetailCard('Risk details', detailInner)}
    ${supDetailCard('5W1H report', fiveW1HReadonly(t))}
    ${evidence}
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
                ? 'Plan updated & resubmitted for compliance review'
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

function officerPageLayout(opts) {
  const { stats, user, ...rest } = opts;
  const notifications = opts.notifications || layoutNotifications(user);
  return officerAppLayout({ stats, user, notifications, ...rest });
}

function quickActionsBar(stats) {
  const actions = [
    { href: '/officer/tickets', label: 'Risk register', count: stats.total },
    { href: '/officer/overdue', label: 'Overdue & SLA', count: stats.overdueMitigation },
    { href: '/officer/action-plans', label: 'Action plans', count: stats.awaitingFinalValidation },
    { href: '/officer/monitoring', label: 'Active monitoring', count: stats.inMitigation },
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
        <p class="sup-page-desc">Welcome, Risk Governance Office — view organizational risks, monitor SLA compliance, and participate in ticket discussion threads. The RMU does not own or edit tickets.</p>
      </div>
      <a href="/officer/overdue" class="filter-pill filter-pill--head">Overdue <span class="filter-pill__count">${stats.overdueMitigation}</span></a>
    </div>
    <div class="sup-kpi-grid sup-kpi-grid--officer">
      ${kpiCard('/officer/tickets', KPI_ICONS.total, stats.total, 'Risk register', 'sup-kpi--accent')}
      ${kpiCard('/officer/monitoring', KPI_ICONS.mitigation, stats.open, 'Open risks')}
      ${kpiCard('/officer/overdue', KPI_ICONS.overdue, stats.overdueMitigation, 'Overdue / SLA', stats.overdueMitigation ? 'sup-kpi--warn' : '')}
      ${kpiCard('/officer/action-plans', KPI_ICONS.final, stats.awaitingFinalValidation, 'Action plans')}
      <div class="sup-kpi">
        <span class="sup-kpi__icon">${KPI_ICONS.closed}</span>
        <span class="sup-kpi__body">
          <span class="sup-kpi__value">${stats.complianceOpen || 0}</span>
          <span class="sup-kpi__label">Compliance risks</span>
        </span>
      </div>
    </div>
    ${quickActionsBar(stats)}
    <div class="officer-dash-grid">
      <section class="sup-card">
        <div class="sup-card__head">
          <h2>Risks by department</h2>
          <a href="/officer/tickets" class="sup-link">View register</a>
        </div>
        <div class="sup-card__body">${departmentTiles(departments)}</div>
      </section>
      <section class="sup-card">
        <div class="sup-card__head">
          <h2>Organization risk matrix</h2>
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
    title: 'AI classification review',
    desc: 'Review AI analysis and override classifications when necessary. The RMU monitors but does not own these tickets.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'ai-review',
    emptyMessage: 'No tickets currently flagged for AI review.',
    stats: opts.stats,
  });
}

function finalValidationQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Department action plans',
    desc: 'Review action plans submitted by owning departments (read-only).',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'action-plans',
    emptyMessage: 'No department action plans to review.',
    stats: opts.stats,
  });
}

function overdueQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Overdue & SLA',
    desc: 'Tickets past their target date or SLA threshold.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'overdue',
    emptyMessage: 'No overdue tickets.',
    stats: opts.stats,
  });
}

function monitoringQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Active monitoring',
    desc: 'All active organizational risks across the department ownership lifecycle.',
    tickets,
    flash,
    activeNav: 'monitoring',
    emptyMessage: 'No active tickets to monitor.',
    stats: opts.stats,
  });
}

function allTicketsPage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Organization risk register',
    desc: 'Complete view of organizational risk tickets (excluding drafts).',
    tickets,
    flash,
    activeNav: 'register',
    emptyMessage: 'No submitted tickets yet.',
    stats: opts.stats,
  });
}

function ticketGovernancePage(user, ticket, { flash, error, stats, backHref, activeNav } = {}) {
  const t = ticket;
  const ref = t.reference;
  const accomplishment = t.accomplishment || getAccomplishmentForTicket(t);
  const accBlock = accomplishment
    ? accomplishmentReportSection(accomplishment, {
        notice: t.status === 'closed'
          ? 'Accomplishment on record. Only the Risk Governance Office can reopen this ticket and reassign it to a department.'
          : 'Accomplishment on record — RMU monitors only; department head closes the ticket.',
      })
    : '';

  const deptOptions = DEPARTMENTS.map(
    (d) => `<option value="${escapeHtml(d)}"${d === t.department ? ' selected' : ''}>${escapeHtml(d)}</option>`,
  ).join('');

  const reopenBlock = ['closed', 'resolved'].includes(t.status)
    ? `<section class="sup-card sup-card--accent officer-reopen-card">
        <div class="sup-card__head"><h2>Reopen ticket</h2></div>
        <div class="sup-card__body">
          <p class="sup-muted-block">Reopen this closed ticket and assign it back to a department for a new ownership cycle. Only Risk Governance Office users can perform this action.</p>
          <form method="post" action="/officer/tickets/${escapeHtml(ref)}/reopen" class="stack-form stack-form--console">
            <div class="field field--console">
              <label for="reopenReason">Reason <span class="text-muted">(required)</span></label>
              <textarea id="reopenReason" name="reason" rows="3" required placeholder="Explain why this ticket must be reopened…"></textarea>
            </div>
            <div class="field field--console">
              <label for="reopenDepartment">Assign to department <span class="text-muted">(required)</span></label>
              <select id="reopenDepartment" name="department" required>${deptOptions}</select>
            </div>
            <button type="submit" class="btn-primary btn-primary--auto">Reopen and assign</button>
          </form>
        </div>
      </section>`
    : '';

  const closureBlock = t.closure
    ? supDetailCard(
        'Closure',
        `<p>${escapeHtml(t.closure.notes || 'Ticket closed.')}</p>
         <p class="sup-muted-block">${escapeHtml(t.closure.closedByName || t.closure.closedBy || 'Department')} · ${escapeHtml(formatDate(t.closure.closedAt))}</p>`,
        { accent: true },
      )
    : '';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: backHref || '/officer/tickets',
      backLabel: 'Back to risk register',
    })}
    ${ticketReadonlySections(t)}
    ${aiReadonlyCard(t)}
    ${actionPlanReadonlyCard(t)}
    ${accBlock}
    ${closureBlock}
    ${reopenBlock}
    ${threadCommentsBlock(t, ref)}`;

  return officerPageLayout({
    title: ref,
    user,
    activeNav: activeNav || 'register',
    body,
    stats,
  });
}

function renderOfficerTicketPage(user, ticket, opts) {
  return ticketGovernancePage(user, ticket, opts);
}

module.exports = {
  officerOverviewPage,
  reviewQueuePage,
  finalValidationQueuePage,
  overdueQueuePage,
  monitoringQueuePage,
  allTicketsPage,
  renderOfficerTicketPage,
};
