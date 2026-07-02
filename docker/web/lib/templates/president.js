const { getCategoryLabel, getStatusLabel, getStatusTone } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { flashMessage } = require('./layout');
const { presidentAppLayout } = require('./president-layout');
const { layoutNotifications } = require('../notifications');
const { evidenceSection } = require('./evidence');
const { supPageHead, supTicketHead, supQuickActions, supDetailCard, supDecisionPanel } = require('./console-ui');

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

function actionPlanCard(ticket) {
  const plan = ticket.actionPlan;
  if (!plan) return '';
  return supDetailCard(
    'Department action plan',
    `<p>${escapeHtml(plan.summary || plan.description || '—')}</p>
     ${plan.dueAt ? `<p class="sup-muted-block">Target: ${escapeHtml(formatDate(plan.dueAt))}</p>` : ''}`,
  );
}

function presidentDecisionPanel(ticket, ref) {
  const isActionPlanPhase = ticket.status === 'pending_president' && !ticket.presidentPlanDecision;
  const isFinalPhase = ticket.status === 'pending_president_final' && !ticket.presidentFinalDecision;
  if (!isActionPlanPhase && !isFinalPhase) return '';

  if (isFinalPhase) {
    return supDecisionPanel({
      title: 'President final decision',
      desc: 'After compliance review of the accomplishment report, close the ticket or return it to the department for further work.',
      bodyHtml: `<div class="decision-actions">
        <section class="decision-action-card decision-action-card--accept">
          <h3 class="decision-action-card__title">Close ticket</h3>
          <form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console">
            <input type="hidden" name="decision" value="close">
            <div class="field field--console">
              <label for="closeNote">Note <span class="text-muted">(optional)</span></label>
              <textarea id="closeNote" name="note" rows="2" placeholder="Optional closing note…"></textarea>
            </div>
            <button type="submit" class="btn-accept--outline">Close ticket</button>
          </form>
        </section>
        <section class="decision-action-card decision-action-card--return">
          <h3 class="decision-action-card__title">Return to department</h3>
          <form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console">
            <input type="hidden" name="decision" value="return">
            <div class="field field--console">
              <label for="returnNoteFinal">Reason <span class="text-muted">(required)</span></label>
              <textarea id="returnNoteFinal" name="note" rows="2" required placeholder="What should the department revise or complete…"></textarea>
            </div>
            <button type="submit" class="btn-outline btn-primary--auto">Return ticket</button>
          </form>
        </section>
      </div>`,
    });
  }

  return supDecisionPanel({
    title: 'President approval',
    desc: 'Review the validated action plan. Approve to release the department for implementation, or return/reject for revision.',
    bodyHtml: `<div class="decision-actions">
      <section class="decision-action-card decision-action-card--accept">
        <h3 class="decision-action-card__title">Approve action plan</h3>
        <form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console">
          <input type="hidden" name="decision" value="approve">
          <div class="field field--console">
            <label for="approveNote">Note <span class="text-muted">(optional)</span></label>
            <textarea id="approveNote" name="note" rows="2" placeholder="Optional approval note…"></textarea>
          </div>
          <button type="submit" class="btn-accept--outline">Approve for implementation</button>
        </form>
      </section>
      <section class="decision-action-card decision-action-card--return">
        <h3 class="decision-action-card__title">Reject action plan</h3>
        <form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console">
          <input type="hidden" name="decision" value="reject">
          <div class="field field--console">
            <label for="rejectNote">Reason <span class="text-muted">(required)</span></label>
            <textarea id="rejectNote" name="note" rows="2" required placeholder="Explain why the action plan is rejected…"></textarea>
          </div>
          <button type="submit" class="btn-danger--outline">Reject action plan</button>
        </form>
      </section>
      <section class="decision-action-card decision-action-card--reassign">
        <h3 class="decision-action-card__title">Return for revision</h3>
        <form method="post" action="/president/tickets/${escapeHtml(ref)}/decision" class="stack-form stack-form--console">
          <input type="hidden" name="decision" value="return">
          <div class="field field--console">
            <label for="returnNote">Instructions <span class="text-muted">(required)</span></label>
            <textarea id="returnNote" name="note" rows="2" required placeholder="What should the department revise…"></textarea>
          </div>
          <button type="submit" class="btn-outline btn-primary--auto">Return to department</button>
        </form>
      </section>
    </div>`,
  });
}

function presidentDecisionCard(ticket) {
  const decisions = [ticket.presidentPlanDecision, ticket.presidentFinalDecision, ticket.presidentDecision].filter(Boolean);
  if (!decisions.length) {
    if (['pending_president', 'pending_president_final'].includes(ticket.status)) {
      return `<section class="sup-card sup-card--accent">
        <div class="sup-card__head"><h2>President decision</h2></div>
        <div class="sup-card__body"><p class="sup-muted-block">Awaiting the President\u2019s decision.</p></div>
      </section>`;
    }
    return '';
  }
  return decisions.map((d) => supDetailCard(
    d.phase === 'final' ? 'President final decision' : 'President approval',
    `<p><strong>${escapeHtml(d.decision || 'Decision')}</strong></p>
     ${d.note ? `<p>${escapeHtml(d.note)}</p>` : ''}
     <p class="sup-muted-block">${escapeHtml(d.authorName || 'President')} · ${escapeHtml(formatDate(d.at))}</p>`,
    { accent: true },
  )).join('');
}

const KPI_ICONS = {
  high: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16l4-4 3 2 5-7"/><path d="M15 7h4v4"/></svg>`,
  critical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none"/></svg>`,
  pending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
};

function levelKpiCard(id, label, count, variant = '') {
  const href = id === 'pending' ? '/president/pending' : `/president/${id}`;
  return `<a href="${href}" class="sup-kpi sup-kpi--risk sup-kpi--risk-${id === 'pending' ? 'high' : id}${variant ? ` ${variant}` : ''}">
    <span class="sup-kpi__icon">${KPI_ICONS[id] || KPI_ICONS.high}</span>
    <span class="sup-kpi__body">
      <span class="sup-kpi__value">${count}</span>
      <span class="sup-kpi__label">${escapeHtml(label)}</span>
    </span>
  </a>`;
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

function presidentOverviewPage(user, stats, flash) {
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
      desc: 'Final approving authority for High and Critical organizational risks. Low and Moderate risks are resolved by departments and may be auto-approved per department policy.',
      actionHtml: stats.pendingCount
        ? '<a href="/president/pending" class="sup-btn-primary">Review pending decisions</a>'
        : '',
    })}
    <div class="sup-kpi-grid sup-kpi-grid--levels">
      ${levelKpiCard('pending', 'Pending decisions', stats.pendingCount, stats.pendingCount ? 'sup-kpi--warn' : '')}
      ${levelKpiCard('high', 'High risks', stats.byLevel.high)}
      ${levelKpiCard('critical', 'Critical risks', stats.byLevel.critical, stats.byLevel.critical ? 'sup-kpi--warn' : '')}
    </div>
    ${supQuickActions([
      { href: '/president/pending', label: 'Pending decisions', count: stats.pendingCount },
      { href: '/president/critical', label: 'Critical risks', count: stats.criticalCount },
      { href: '/president/high', label: 'High risks', count: stats.highCount },
    ])}
    ${pendingSection}`;

  return presidentPage({ title: 'President dashboard', user, activeNav: 'overview', body, stats });
}

function pendingQueuePage(user, tickets, flash, stats = {}) {
  const rows = ticketTableRows(tickets);
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Pending decisions',
      desc: 'High and Critical risk tickets with final resolutions awaiting your approval.',
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
    desc: 'High-risk reports requiring presidential oversight when a final resolution is submitted.',
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
  const isCritical = (riskLevel?.id || t.riskLevel) === 'critical';
  const statusHtml = `${riskLevelBadge(riskLevel?.id || t.riskLevel, riskLevel?.label || t.riskLevelLabel)} · ${statusPill(t.status, t.isOverdue)}`;

  const detailInner = `<dl class="detail-dl detail-dl--console">
      <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
      <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
      <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
      <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel?.id || t.riskLevel, riskLevel?.label || t.riskLevelLabel)}</dd>
      <dt>Status</dt><dd>${statusPill(t.status, t.isOverdue)}</dd>
      <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
    </dl>
    <p class="sup-detail-desc">${escapeHtml(t.description || '—')}</p>`;

  const aiInner = t.ai
    ? `<p class="sup-muted-block">${escapeHtml(t.ai.summary)}</p>
        <dl class="detail-dl detail-dl--console">
          <dt>Likelihood</dt><dd>${t.ai.likelihood || t.likelihood}/5</dd>
          <dt>Impact</dt><dd>${t.ai.impact || t.impact}/5</dd>
        </dl>`
    : '<p class="sup-muted-block">No AI classification available.</p>';

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
    ${isCritical ? '<div class="critical-banner" role="status">Critical risk — requires presidential oversight</div>' : ''}
    <div class="sup-detail-stack">
      ${supDetailCard('Risk details', detailInner)}
      ${supDetailCard('5W1H report', fiveW1HReadonly(t))}
      ${evidenceSection(t, { attachmentBasePath: '/president/attachments', theme: 'console', interactive: true })}
      ${supDetailCard('AI classification', aiInner, { compact: true })}
      ${actionPlanCard(t)}
      ${finalResolutionCard(t)}
      ${rmuRecommendationsCard(t)}
      ${complianceFindingsCard(t)}
      ${presidentDecisionCard(t)}
      ${presidentDecisionPanel(t, ref)}
    </div>`;

  return presidentPage({
    title: ref,
    user,
    activeNav: 'pending',
    body,
    stats,
  });
}

module.exports = {
  presidentOverviewPage,
  pendingQueuePage,
  highTicketsPage,
  criticalTicketsPage,
  ticketDetailPage,
};
