const { getCategoryLabel, getStatusLabel, getStatusTone } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { flashMessage } = require('./layout');
const { presidentAppLayout } = require('./president-layout');
const { trendChart } = require('./executive');
const { layoutNotifications } = require('../notifications');
const { evidenceSection } = require('./evidence');
const { threadDiscussionSection } = require('./thread-discussion');
const { supPageHead, supTicketHead, supQuickActions, supDetailCard } = require('./console-ui');

const TABLE_HEAD = `<tr>
  <th>Reference</th>
  <th>Title</th>
  <th>Level</th>
  <th>Category</th>
  <th>Department</th>
  <th>Status</th>
  <th>Updated</th>
</tr>`;

function riskLevelBadge(riskLevelId, label) {
  const id = riskLevelId || 'high';
  const text = label || 'High';
  return `<span class="risk-badge risk-badge--${escapeHtml(id)}">${escapeHtml(text)}</span>`;
}

function statusPill(status, overdue) {
  const tone = overdue ? 'bad' : getStatusTone(status);
  return `<span class="pill pill--${tone}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function ticketTableRows(tickets, { linkPrefix = '/president/tickets/', highlightCritical = true } = {}) {
  return tickets
    .map((t) => {
      const rowCls = highlightCritical && t.riskLevel === 'critical' ? ' class="row--critical"' : '';
      return `<tr${rowCls}>
        <td class="mono nowrap"><a href="${linkPrefix}${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td class="sup-truncate">${escapeHtml(t.title)}</td>
        <td class="nowrap">${riskLevelBadge(t.riskLevel, t.riskLevelLabel)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel)}</td>
        <td class="nowrap">${escapeHtml(t.department)}</td>
        <td>${statusPill(t.status, t.isOverdue)}</td>
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
      </tr>`;
    })
    .join('');
}

function tableCard({ title, linkHref, linkLabel, rows, emptyMessage, showHead = true }) {
  return `<section class="sup-card sup-card--table">
    ${
      showHead && title
        ? `<div class="sup-card__head">
            <h2>${escapeHtml(title)}</h2>
            ${linkHref ? `<a href="${linkHref}" class="sup-link">${escapeHtml(linkLabel || 'View all')}</a>` : ''}
          </div>`
        : ''
    }
    <div class="table-wrap">
      <table class="data-table data-table--compact sup-table">
        <thead>${TABLE_HEAD}</thead>
        <tbody>${rows || `<tr><td colspan="7" class="empty">${emptyMessage}</td></tr>`}</tbody>
      </table>
    </div>
  </section>`;
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

function finalResolutionCard(ticket) {
  const res = ticket.finalResolution;
  if (!res) return '';
  return supDetailCard(
    'Department resolution',
    `<div class="dept-resolution">
      <h4>Resolution summary</h4>
      <p>${escapeHtml(res.summary)}</p>
      <h4>Outcomes</h4>
      <p>${escapeHtml(res.outcomes)}</p>
      <p class="sup-muted-block">Submitted by ${escapeHtml(res.submittedByName || '—')} on ${escapeHtml(formatDate(res.submittedAt))}</p>
    </div>`,
    { accent: true },
  );
}

function rmuRecommendationsCard(ticket) {
  const items = ticket.rmuRecommendations || [];
  if (!items.length) return '';
  const rows = [...items]
    .reverse()
    .map(
      (r) => `<li class="audit-trail-item">
        <div class="audit-trail-meta">
          <span class="audit-trail-action">Recommendation</span>
          <span class="audit-trail-user">${escapeHtml(r.authorName || r.authorUsername)}</span>
          <span class="audit-trail-time">${escapeHtml(formatDate(r.at))}</span>
        </div>
        <p class="audit-trail-current__plan">${escapeHtml(r.body)}</p>
      </li>`,
    )
    .join('');
  return supDetailCard('RMU recommendations', `<ul class="audit-trail-list">${rows}</ul>`);
}

function complianceFindingsCard(ticket) {
  const notes = ticket.auditNotes;
  const trail = (ticket.auditTrail || []).filter((e) =>
    /compliance|audit/i.test(e.action || ''),
  );
  if (!notes && !trail.length) return '';
  const trailHtml = trail.length
    ? `<ul class="audit-trail-list">${trail
        .slice(-5)
        .reverse()
        .map(
          (e) => `<li class="audit-trail-item">
            <div class="audit-trail-meta">
              <span class="audit-trail-action">${escapeHtml(e.action)}</span>
              <span class="audit-trail-time">${escapeHtml(formatDate(e.at))}</span>
            </div>
            ${e.detail ? `<p class="audit-trail-current__plan">${escapeHtml(e.detail)}</p>` : ''}
          </li>`,
        )
        .join('')}</ul>`
    : '';
  return supDetailCard(
    'Compliance findings',
    `${notes ? `<p>${escapeHtml(notes)}</p>` : ''}${trailHtml}`,
  );
}

function needsActionPlanDecision(ticket) {
  const level = ticket.riskLevel || ticket.ai?.riskLevel?.id;
  if (!['high', 'critical'].includes(level)) return false;
  if (!String(ticket.actionPlan?.summary || '').trim()) return false;
  if (ticket.presidentPlanDecision?.decisionId === 'approve') return false;
  if (ticket.status === 'pending_president_final') return false;
  if (['closed', 'resolved', 'draft'].includes(ticket.status)) return false;
  return true;
}

function actionPlanCard(ticket) {
  const plan = ticket.actionPlan;
  if (!plan) return '';
  const steps = (plan.steps || []).length
    ? `<ol class="dept-plan__steps">${plan.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`
    : '';
  return supDetailCard(
    'Department action plan',
    `<p class="dept-plan__summary">${escapeHtml(plan.summary || plan.description || '—')}</p>
     ${steps}
     ${plan.targetDate || plan.dueAt ? `<p class="sup-muted-block">Target: ${escapeHtml(formatDate(plan.targetDate || plan.dueAt))}</p>` : ''}
     ${plan.updatedByName ? `<p class="sup-muted-block">Updated by ${escapeHtml(plan.updatedByName)}${plan.updatedAt ? ` · ${escapeHtml(formatDate(plan.updatedAt))}` : ''}</p>` : ''}`,
    { accent: true },
  );
}

function detailsSidebar(ticket) {
  const riskLevel = ticket.ai?.riskLevel || { id: ticket.riskLevel, label: ticket.riskLevelLabel };
  const due = ticket.actionPlan?.targetDate || ticket.mitigationDueAt;
  return `<div class="dept-side-card">
    <h3 class="dept-side-card__title">Details</h3>
    <dl class="detail-dl detail-dl--console">
      <dt>Department</dt><dd>${escapeHtml(ticket.department || '—')}</dd>
      <dt>Submitted by</dt><dd>${escapeHtml(ticket.submittedByName || ticket.submittedBy || '—')}</dd>
      <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(ticket.category))}</dd>
      <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel?.id || ticket.riskLevel, riskLevel?.label || ticket.riskLevelLabel)}</dd>
      <dt>Status</dt><dd>${statusPill(ticket.status, ticket.isOverdue)}</dd>
      <dt>Submitted</dt><dd>${escapeHtml(formatDate(ticket.submittedAt || ticket.createdAt))}</dd>
      ${due ? `<dt>Target date</dt><dd>${escapeHtml(formatDate(due))}</dd>` : ''}
    </dl>
  </div>`;
}

function presidentModalShell(id, title, desc, formHtml) {
  return `<div class="dept-modal" id="${escapeHtml(id)}" hidden aria-hidden="true">
    <div class="dept-modal__backdrop" data-pres-modal-close tabindex="-1" aria-hidden="true"></div>
    <div class="dept-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(id)}-title">
      <div class="dept-modal__head">
        <h2 class="dept-modal__title" id="${escapeHtml(id)}-title">${escapeHtml(title)}</h2>
        <button type="button" class="dept-modal__close" data-pres-modal-close aria-label="Close">&times;</button>
      </div>
      ${desc ? `<p class="dept-modal__desc">${escapeHtml(desc)}</p>` : ''}
      ${formHtml}
    </div>
  </div>`;
}

/** Side action bar — Approve / Decline / Return (mirrors department-head ownership bar). */
function actionPlanDecisionSideBar(ticket, ref) {
  if (!needsActionPlanDecision(ticket)) return '';
  return `<section class="dept-action-bar dept-action-bar--side" id="president-decision" aria-label="Action plan decision">
    <div class="dept-action-bar__copy">
      <strong>Action plan decision</strong>
      <p>Approve or decline this High/Critical action plan before implementation.</p>
    </div>
    <div class="dept-action-bar__buttons">
      <button type="button" class="dept-action-btn dept-action-btn--accept" data-pres-modal-open="approve">Approve action plan</button>
      <button type="button" class="dept-action-btn dept-action-btn--reject" data-pres-modal-open="decline">Decline action plan</button>
      <button type="button" class="dept-action-btn dept-action-btn--reassign" data-pres-modal-open="return">Return for revision</button>
    </div>
  </section>`;
}

function presidentFinalDecisionSideBar(ticket, ref) {
  if (ticket.status !== 'pending_president_final' || ticket.presidentFinalDecision) return '';
  return `<section class="dept-action-bar dept-action-bar--side" aria-label="Final decision">
    <div class="dept-action-bar__copy">
      <strong>Final decision</strong>
      <p>Close the ticket or return it to the department.</p>
    </div>
    <div class="dept-action-bar__buttons">
      <button type="button" class="dept-action-btn dept-action-btn--accept" data-pres-modal-open="close">Close ticket</button>
      <button type="button" class="dept-action-btn dept-action-btn--reassign" data-pres-modal-open="return-final">Return to department</button>
    </div>
  </section>`;
}

function presidentDecisionModals(ticket, ref) {
  const modals = [];

  if (needsActionPlanDecision(ticket)) {
    const approveForm = `<form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console dept-modal__form">
      <input type="hidden" name="decision" value="approve">
      <div class="dept-modal__actions">
        <button type="button" class="btn-outline btn-primary--auto" data-pres-modal-close>Cancel</button>
        <button type="submit" class="btn-accept--outline">Approve action plan</button>
      </div>
    </form>`;

    const declineForm = `<form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console dept-modal__form">
      <input type="hidden" name="decision" value="decline">
      <div class="field field--console">
        <label for="declineNote">Reason <span class="text-muted">(required)</span></label>
        <textarea id="declineNote" name="note" rows="3" required placeholder="Explain why the action plan is declined…"></textarea>
      </div>
      <div class="dept-modal__actions">
        <button type="button" class="btn-outline btn-primary--auto" data-pres-modal-close>Cancel</button>
        <button type="submit" class="btn-danger--outline">Decline action plan</button>
      </div>
    </form>`;

    const returnForm = `<form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console dept-modal__form">
      <input type="hidden" name="decision" value="return">
      <div class="field field--console">
        <label for="returnNote">Instructions <span class="text-muted">(required)</span></label>
        <textarea id="returnNote" name="note" rows="3" required placeholder="What should the department revise…"></textarea>
      </div>
      <div class="dept-modal__actions">
        <button type="button" class="btn-outline btn-primary--auto" data-pres-modal-close>Cancel</button>
        <button type="submit" class="btn-primary btn-primary--auto">Return to department</button>
      </div>
    </form>`;

    modals.push(
      presidentModalShell('pres-modal-approve', 'Approve action plan', 'Release this plan to the reporter for implementation.', approveForm),
      presidentModalShell('pres-modal-decline', 'Decline action plan', 'Reject the plan. The department must create a new one.', declineForm),
      presidentModalShell('pres-modal-return', 'Return for revision', 'Send the plan back with revision instructions.', returnForm),
    );
  }

  if (ticket.status === 'pending_president_final' && !ticket.presidentFinalDecision) {
    const closeForm = `<form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console dept-modal__form">
      <input type="hidden" name="decision" value="close">
      <div class="field field--console">
        <label for="closeNote">Note <span class="text-muted">(optional)</span></label>
        <textarea id="closeNote" name="note" rows="3" placeholder="Optional closing note…"></textarea>
      </div>
      <div class="dept-modal__actions">
        <button type="button" class="btn-outline btn-primary--auto" data-pres-modal-close>Cancel</button>
        <button type="submit" class="btn-accept--outline">Close ticket</button>
      </div>
    </form>`;

    const returnFinalForm = `<form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console dept-modal__form">
      <input type="hidden" name="decision" value="return">
      <div class="field field--console">
        <label for="returnNoteFinal">Reason <span class="text-muted">(required)</span></label>
        <textarea id="returnNoteFinal" name="note" rows="3" required placeholder="What should the department revise or complete…"></textarea>
      </div>
      <div class="dept-modal__actions">
        <button type="button" class="btn-outline btn-primary--auto" data-pres-modal-close>Cancel</button>
        <button type="submit" class="btn-primary btn-primary--auto">Return ticket</button>
      </div>
    </form>`;

    modals.push(
      presidentModalShell('pres-modal-close', 'Close ticket', 'Close this ticket after accomplishment review.', closeForm),
      presidentModalShell('pres-modal-return-final', 'Return to department', 'Return the ticket for further work.', returnFinalForm),
    );
  }

  return modals.join('');
}

const PRESIDENT_MODALS_SCRIPT = `<script>
(function () {
  function closeAllPresModals() {
    document.querySelectorAll('.dept-modal:not([hidden])').forEach(function (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('dept-modal-open');
  }

  function openPresModal(id) {
    closeAllPresModals();
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('dept-modal-open');
    var focusable = modal.querySelector('textarea, select, button:not(.dept-modal__close)');
    if (focusable) focusable.focus();
  }

  document.querySelectorAll('[data-pres-modal-open]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openPresModal('pres-modal-' + btn.getAttribute('data-pres-modal-open'));
    });
  });

  document.querySelectorAll('[data-pres-modal-close]').forEach(function (el) {
    el.addEventListener('click', closeAllPresModals);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeAllPresModals();
  });
})();
</script>`;

function presidentDecisionCard(ticket) {
  const decisions = [ticket.presidentPlanDecision, ticket.presidentFinalDecision, ticket.presidentDecision].filter(Boolean);
  if (!decisions.length) return '';
  return decisions.map((d) =>
    supDetailCard(
      d.phase === 'final' ? 'President final decision' : 'President approval',
      `<p><strong>${escapeHtml(d.decision || 'Decision')}</strong></p>
     ${d.note ? `<p>${escapeHtml(d.note)}</p>` : ''}
     <p class="sup-muted-block">${escapeHtml(d.authorName || 'President')} · ${escapeHtml(formatDate(d.at))}</p>`,
      { accent: true },
    ),
  ).join('');
}

function commentsSection(ticket, ref, user) {
  return threadDiscussionSection(ticket, ref, {
    title: 'Discussion thread',
    hint: 'Share feedback on the action plan. Visible to the Department Head and Risk Governance Office (RMU). Not visible to the ticket reporter.',
    postAction: `/president/tickets/${escapeHtml(ref)}/comment`,
    canPost: true,
    canReact: false,
    canEditOwn: false,
    currentUsername: user?.username,
    showAttachments: false,
    composeLabel: 'Add comment',
    composePlaceholder: 'Comment on this High/Critical risk action plan…',
    submitLabel: 'Post comment',
  });
}

const KPI_ICONS = {
  low: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>`,
  moderate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none"/></svg>`,
  high: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16l4-4 3 2 5-7"/><path d="M15 7h4v4"/></svg>`,
  critical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none"/></svg>`,
  pending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  total: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  closed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7l-9 9-4-4"/></svg>`,
};

/* Only these lists exist for the President console; Low/Moderate cards render as plain stats. */
const KPI_HREFS = {
  pending: '/president/pending',
  high: '/president/high',
  critical: '/president/critical',
};

function levelKpiCard(id, label, count, variant = '') {
  const href = KPI_HREFS[id];
  const cls = `sup-kpi sup-kpi--risk sup-kpi--risk-${id === 'pending' ? 'high' : id}${variant ? ` ${variant}` : ''}`;
  const inner = `<span class="sup-kpi__icon">${KPI_ICONS[id] || KPI_ICONS.high}</span>
    <span class="sup-kpi__body">
      <span class="sup-kpi__value">${count}</span>
      <span class="sup-kpi__label">${escapeHtml(label)}</span>
    </span>`;
  return href
    ? `<a href="${href}" class="${cls}">${inner}</a>`
    : `<div class="${cls}">${inner}</div>`;
}

function statKpi(icon, value, label, href) {
  const inner = `<span class="sup-kpi__icon">${icon}</span>
    <span class="sup-kpi__body">
      <span class="sup-kpi__value">${value}</span>
      <span class="sup-kpi__label">${escapeHtml(label)}</span>
    </span>`;
  return href
    ? `<a href="${href}" class="sup-kpi">${inner}</a>`
    : `<div class="sup-kpi">${inner}</div>`;
}

function presidentPage({ title, user, activeNav, body, stats = {}, notifications }) {
  return presidentAppLayout({
    title,
    user,
    activeNav,
    body,
    stats,
    notifications: notifications || layoutNotifications(user),
  });
}

function presidentOverviewPage(user, dashboard, flash) {
  const { stats, org } = dashboard;
  const pendingRows = ticketTableRows(stats.pendingTickets || []);
  const pendingSection = stats.pendingCount
    ? tableCard({
        title: 'Awaiting your decision',
        linkHref: '/president/pending',
        linkLabel: 'View all pending',
        rows: pendingRows,
        emptyMessage: 'No tickets awaiting presidential decision.',
      })
    : `<section class="sup-card sup-card--critical-empty">
        <div class="sup-card__head"><h2>Pending decisions</h2></div>
        <div class="sup-card__body">
          <p class="sup-muted-block">No High or Critical risk tickets are awaiting your decision.</p>
        </div>
      </section>`;

  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'President dashboard',
      desc: 'Organization-wide risk oversight. Final approving authority for High and Critical risks — review and approve or decline department action plans before implementation.',
      actionHtml: stats.pendingCount
        ? '<a href="/president/pending" class="sup-btn-primary">Review pending decisions</a>'
        : '',
    })}
    <div class="sup-kpi-grid sup-kpi-grid--levels">
      ${levelKpiCard('low', 'Low', org.byLevel.low)}
      ${levelKpiCard('moderate', 'Moderate', org.byLevel.moderate)}
      ${levelKpiCard('high', 'High', org.byLevel.high)}
      ${levelKpiCard('critical', 'Critical', org.byLevel.critical, org.byLevel.critical ? 'sup-kpi--warn' : '')}
    </div>
    <div class="sup-kpi-grid sup-kpi-grid--stats">
      ${statKpi(KPI_ICONS.total, org.total, 'Total reports')}
      ${statKpi(KPI_ICONS.open, org.open, 'Open')}
      ${statKpi(KPI_ICONS.closed, org.closed, 'Closed')}
      ${statKpi(KPI_ICONS.pending, stats.pendingCount, 'Pending decisions', '/president/pending')}
    </div>
    ${supQuickActions([
      { href: '/president/pending', label: 'Pending decisions', count: stats.pendingCount },
      { href: '/president/critical', label: 'Critical risks', count: stats.criticalCount },
      { href: '/president/high', label: 'High risks', count: stats.highCount },
      { href: '/president/trends', label: 'Trends', count: null },
    ])}
    ${pendingSection}`;

  return presidentPage({ title: 'President dashboard', user, activeNav: 'overview', body, stats });
}

function presidentTrendsPage(user, dashboard, flash) {
  const { stats, trends } = dashboard;
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Trends',
      desc: 'Monthly volume of submitted risk reports over the last 12 months. High/Critical share is highlighted.',
    })}
    <section class="sup-card">
      <div class="sup-card__head"><h2>Report volume trend</h2></div>
      <div class="sup-card__body">${trendChart(trends)}</div>
    </section>`;

  return presidentPage({ title: 'Trends', user, activeNav: 'trends', body, stats });
}

function pendingQueuePage(user, tickets, flash, stats = {}) {
  const rows = ticketTableRows(tickets);
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Pending decisions',
      desc: 'High and Critical risk action plans awaiting your approval or decline.',
    })}
    ${tableCard({ rows, emptyMessage: 'No tickets awaiting presidential decision.', showHead: false })}`;

  return presidentPage({ title: 'Pending decisions', user, activeNav: 'pending', body, stats });
}

function riskListPage(user, { title, desc, tickets, flash, activeNav, level, stats = {} }) {
  const rows = ticketTableRows(tickets);
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({ title, desc })}
    ${tableCard({ rows, emptyMessage: `No ${level} risk reports at this time.`, showHead: false })}`;

  return presidentPage({ title, user, activeNav, body, stats });
}

function highTicketsPage(user, tickets, flash, stats = {}) {
  return riskListPage(user, {
    title: 'High risks',
    desc: 'High-risk reports. Action plans on these tickets require presidential approve or decline.',
    tickets,
    flash,
    activeNav: 'high',
    level: 'high',
    stats,
  });
}

function criticalTicketsPage(user, tickets, flash, stats = {}) {
  return riskListPage(user, {
    title: 'Critical risks',
    desc: 'Extreme/Critical risk reports — highest priority for presidential review.',
    tickets,
    flash,
    activeNav: 'critical',
    level: 'critical',
    stats,
  });
}

function ticketDetailPage(user, ticket, { flash, error, stats = {} } = {}) {
  const t = ticket;
  const ref = t.reference;
  const riskLevel = t.ai?.riskLevel || { id: t.riskLevel, label: t.riskLevelLabel };
  const riskLevelId = riskLevel?.id || t.riskLevel;
  const isCritical = riskLevelId === 'critical';
  const isHigh = riskLevelId === 'high';
  const needsDecision = needsActionPlanDecision(t) || t.status === 'pending_president_final';
  const statusHtml = `${riskLevelBadge(riskLevelId, riskLevel?.label || t.riskLevelLabel)} · ${statusPill(t.status, t.isOverdue)}`;
  const showModals = needsActionPlanDecision(t) || t.status === 'pending_president_final';

  const main = `
    ${supDetailCard('Risk details', `<dl class="detail-dl detail-dl--console">
        <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
        <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
        <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
        <dt>Risk level</dt><dd>${riskLevelBadge(riskLevelId, riskLevel?.label || t.riskLevelLabel)}</dd>
        <dt>Status</dt><dd>${statusPill(t.status, t.isOverdue)}</dd>
        <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
      </dl>
      <p class="sup-detail-desc">${escapeHtml(t.description || '—')}</p>`)}
    ${supDetailCard('5W1H report', fiveW1HReadonly(t))}
    ${evidenceSection(t, { attachmentBasePath: '/president/attachments', theme: 'console', interactive: true })}
    ${supDetailCard(
      'AI classification',
      t.ai
        ? `<p class="sup-muted-block">${escapeHtml(t.ai.summary)}</p>
            <dl class="detail-dl detail-dl--console">
              <dt>Likelihood</dt><dd>${t.ai.likelihood || t.likelihood}/5</dd>
              <dt>Impact</dt><dd>${t.ai.impact || t.impact}/5</dd>
            </dl>`
        : '<p class="sup-muted-block">No AI classification available.</p>',
      { compact: true },
    )}
    ${actionPlanCard(t)}
    ${finalResolutionCard(t)}
    ${rmuRecommendationsCard(t)}
    ${complianceFindingsCard(t)}
    ${presidentDecisionCard(t)}
    ${commentsSection(t, ref, user)}`;

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml,
      backHref: '/president/pending',
      backLabel: 'Back to pending',
    })}
    ${needsActionPlanDecision(t) && isCritical ? '<div class="critical-banner" role="status">Critical risk — action plan requires presidential approval</div>' : ''}
    ${needsActionPlanDecision(t) && isHigh ? '<div class="critical-banner critical-banner--high" role="status">High risk — action plan requires presidential approval</div>' : ''}
    ${t.status === 'pending_president_final' ? '<div class="critical-banner" role="status">Awaiting your final decision to close or return this ticket</div>' : ''}
    <div class="dept-detail">
      <div class="dept-detail__main">${main}</div>
      <aside class="dept-detail__side">
        ${detailsSidebar(t)}
        ${actionPlanDecisionSideBar(t, ref)}
        ${presidentFinalDecisionSideBar(t, ref)}
      </aside>
    </div>
    ${showModals ? presidentDecisionModals(t, ref) : ''}
    ${showModals ? PRESIDENT_MODALS_SCRIPT : ''}`;

  return presidentPage({
    title: ref,
    user,
    activeNav: needsDecision ? 'pending' : (isCritical ? 'critical' : 'high'),
    body,
    stats,
  });
}

module.exports = {
  presidentOverviewPage,
  presidentTrendsPage,
  pendingQueuePage,
  highTicketsPage,
  criticalTicketsPage,
  ticketDetailPage,
};
