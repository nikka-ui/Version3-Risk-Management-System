const { getCategoryLabel, getStatusLabel, getStatusTone } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { getAccomplishmentForTicket } = require('../tickets');
const { flashMessage, commentsSection, executiveCommentsSection } = require('./layout');
const { auditAppLayout } = require('./audit-layout');
const { layoutNotifications } = require('../notifications');
const { evidenceSection } = require('./evidence');
const {
  supPageHead,
  supTicketHead,
  supQuickActions,
  supTableCard,
  supDetailCard,
  supDecisionPanel,
} = require('./console-ui');

const CALENDAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

function statusPill(status, overdue) {
  const tone = overdue ? 'bad' : getStatusTone(status);
  return `<span class="pill pill--${tone}">${escapeHtml(getStatusLabel(status))}</span>`;
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
        <td class="sup-truncate">${escapeHtml(t.title)}</td>
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
    ? `<p class="sup-detail-desc">${escapeHtml(t.officerNotes)}</p>
        ${t.mitigationDueAt ? `<div class="sup-meta-footer">
          <span class="sup-meta-footer__icon">${CALENDAR_ICON}</span>
          <span class="sup-meta-footer__label">Proposed implementation due</span>
          <span class="sup-meta-footer__value">${escapeHtml(formatDate(t.mitigationDueAt))}</span>
        </div>` : ''}`
    : '';

  const auditInner = t.auditNotes ? `<p>${escapeHtml(t.auditNotes)}</p>` : '';

  const detailInner = `<dl class="detail-dl detail-dl--console">
      <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
      <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
      <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
      <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
      <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
    </dl>
    <p class="sup-detail-desc">${escapeHtml(t.description || '—')}</p>`;

  return `<div class="sup-detail-stack">
    ${supDetailCard('Risk details', detailInner)}
    ${supDetailCard('5W1H report', fiveW1HReadonly(t))}
    ${evidenceSection(t, { attachmentBasePath: '/audit/attachments', theme: 'console', interactive: true })}
    ${supDetailCard('AI classification', aiInner, { compact: true })}
    ${t.officerNotes ? supDetailCard(`RMO mitigation solution${t.mitigationPlanVersion ? ` <span class="text-muted">(v${t.mitigationPlanVersion})</span>` : ''}`, solutionInner, { accent: true }) : ''}
    ${t.auditNotes ? supDetailCard('Audit notes', auditInner) : ''}
  </div>`;
}

const KPI_ICONS = {
  review: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  final: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  implementing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  returned: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
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

function auditPage({ title, user, activeNav, body, stats = {}, notifications }) {
  return auditAppLayout({
    title,
    user,
    activeNav,
    body,
    stats,
    notifications: notifications || layoutNotifications(user),
  });
}

function auditOverviewPage(user, stats, flash) {
  const recentRows = ticketTableRows((stats.recentTickets || []).slice(0, 6));
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Audit dashboard',
      desc: 'Independently review mitigation solutions and accomplishment reports before tickets are closed.',
      actionHtml: '<a href="/audit/review" class="sup-btn-primary">Open solution queue</a>',
    })}
    <div class="sup-kpi-grid">
      ${kpiCard('/audit/review', KPI_ICONS.review, stats.awaitingReview, 'Solution review', Number(stats.awaitingReview) > 0 ? 'sup-kpi--accent' : '')}
      ${kpiCard('/audit/final-validation', KPI_ICONS.final, stats.awaitingFinalValidation, 'Accomplishment review')}
      ${kpiCard('/audit/tickets', KPI_ICONS.implementing, stats.inImplementation, 'In implementation')}
      ${kpiCard('/audit/tickets', KPI_ICONS.returned, stats.returnedToRmo, 'Returned to RMO', Number(stats.returnedToRmo) > 0 ? 'sup-kpi--warn' : '')}
      ${kpiCard('/audit/tickets', KPI_ICONS.closed, stats.closed, 'Closed')}
    </div>
    ${supQuickActions([
      { href: '/audit/review', label: 'Solution queue', count: stats.awaitingReview },
      { href: '/audit/final-validation', label: 'Accomplishment review', count: stats.awaitingFinalValidation },
      { href: '/audit/tickets', label: 'All tickets', count: stats.open },
    ])}
    ${supTableCard({
      title: 'Recent activity',
      linkHref: '/audit/tickets',
      linkLabel: 'View all',
      rows: recentRows,
      emptyMessage: 'No ticket activity yet.',
    })}`;

  return auditPage({
    title: 'Audit dashboard',
    user,
    activeNav: 'overview',
    body,
    stats,
  });
}

function queueListPage(user, { title, desc, tickets, flash, error, activeNav, emptyMessage, stats = {} }) {
  const rows = ticketTableRows(tickets);
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supPageHead({ title, desc })}
    ${supTableCard({ rows, emptyMessage, showHead: false })}`;

  return auditPage({ title, user, activeNav, body, stats });
}

function auditFinalValidationQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Accomplishment review',
    desc: 'Department accomplishment reports awaiting your final audit review before closure.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'final',
    emptyMessage: 'No accomplishment reports awaiting audit review.',
    stats: opts.stats,
  });
}

function accomplishmentSection(accomplishment) {
  const acc = accomplishment;
  if (!acc) {
    return supDetailCard('Accomplishment report', '<p class="sup-muted-block">Accomplishment record not found.</p>', { accent: true });
  }
  const evidenceList = (acc.evidence || []).length
    ? `<ul class="evidence-list">${(acc.evidence || [])
        .map((e) => `<li>${escapeHtml(e.name || e.originalName || '—')}</li>`)
        .join('')}</ul>`
    : '<p class="sup-report-field__empty">No additional evidence references.</p>';
  const reportField = (label, valueHtml) => `<div class="sup-report-field">
      <span class="sup-report-field__label">${escapeHtml(label)}</span>
      <div class="sup-report-field__value">${valueHtml}</div>
    </div>`;
  const inner = `
    <p class="sup-report-meta">Submitted by <strong>${escapeHtml(acc.submittedByName || acc.submittedBy)}</strong> on ${escapeHtml(formatDate(acc.submittedAt))}</p>
    <div class="sup-report-grid">
      ${reportField('Implementation summary', `<p>${escapeHtml(acc.summary)}</p>`)}
      ${reportField('Outcomes and results', `<p>${escapeHtml(acc.outcomes)}</p>`)}
      ${reportField('Resolution evidence', evidenceList)}
    </div>`;
  return supDetailCard('Accomplishment report', inner, { accent: true });
}

function ticketAccomplishmentAuditPage(user, ticket, accomplishment, { flash, error, stats = {} } = {}) {
  const t = ticket;
  const ref = t.reference;

  const decisionBody = `
    <form method="post" action="/audit/tickets/${escapeHtml(ref)}/close" class="stack-form stack-form--console">
      <h3 class="sup-section-sub">Approve &amp; close</h3>
      <div class="field">
        <label for="closingNotes">Audit remarks (optional)</label>
        <textarea id="closingNotes" name="closingNotes" rows="2" placeholder="Record your final audit assessment…"></textarea>
      </div>
      <button type="submit" class="btn-accept--outline">Approve accomplishment &amp; close ticket</button>
    </form>
    <form method="post" action="/audit/tickets/${escapeHtml(ref)}/return-accomplishment" class="stack-form stack-form--console stack-form--divider">
      <h3 class="sup-section-sub">Return for further implementation</h3>
      <div class="field">
        <label for="returnNotes">Return notes *</label>
        <textarea id="returnNotes" name="returnNotes" rows="3" required placeholder="Describe gaps in the accomplishment report or evidence…"></textarea>
      </div>
      <button type="submit" class="btn-danger--outline">Return to department</button>
    </form>`;

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: '/audit/final-validation',
      backLabel: 'Back to accomplishment review',
    })}
    ${ticketReadonlySections(t)}
    ${accomplishmentSection(accomplishment)}
    ${supDecisionPanel({
      title: 'Audit decision',
      desc: 'Review the accomplishment report, mitigation evidence, and implementation outcomes. Approve to close the ticket, or return to the department for further action.',
      bodyHtml: decisionBody,
    })}`;

  return auditPage({
    title: `Accomplishment review ${ref}`,
    user,
    activeNav: 'final',
    body,
    stats,
  });
}

function auditReviewQueuePage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'Solution queue',
    desc: 'Mitigation solutions submitted by the RMO awaiting your review — approve to release for implementation, or return to the RMO as insufficient.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'review',
    emptyMessage: 'No solutions awaiting audit review.',
    stats: opts.stats,
  });
}

function allTicketsPage(user, tickets, flash, opts = {}) {
  return queueListPage(user, {
    title: 'All tickets',
    desc: 'Organization-wide risk tickets (excluding drafts).',
    tickets,
    flash,
    activeNav: 'tickets',
    emptyMessage: 'No submitted tickets yet.',
    stats: opts.stats,
  });
}

function ticketAuditPage(user, ticket, { flash, error, stats = {} } = {}) {
  const t = ticket;
  const ref = t.reference;
  const dueValue = t.mitigationDueAt
    ? new Date(t.mitigationDueAt).toISOString().slice(0, 10)
    : '';

  const decisionBody = `
    <form method="post" action="/audit/tickets/${escapeHtml(ref)}/approve" class="stack-form stack-form--console">
      <h3 class="sup-section-sub">Approve solution</h3>
      <div class="field">
        <label for="approveNotes">Audit remarks (optional)</label>
        <textarea id="approveNotes" name="auditNotes" rows="3" placeholder="Record your assessment of the mitigation solution…"></textarea>
      </div>
      <div class="field">
        <label for="mitigationDueAt">Confirm implementation due date</label>
        <input id="mitigationDueAt" name="mitigationDueAt" type="date" value="${escapeHtml(dueValue)}">
      </div>
      <button type="submit" class="btn-accept--outline">Approve &amp; release for implementation</button>
    </form>
    <form method="post" action="/audit/tickets/${escapeHtml(ref)}/return" class="stack-form stack-form--console stack-form--divider">
      <h3 class="sup-section-sub">Return to RMO</h3>
      <div class="field">
        <label for="returnNotes">Comments / suggestions *</label>
        <textarea id="returnNotes" name="auditNotes" rows="3" required placeholder="Explain why the solution is insufficient and what the RMO should revise…"></textarea>
      </div>
      <button type="submit" class="btn-danger--outline">Return to RMO</button>
    </form>`;

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: '/audit/review',
      backLabel: 'Back to solution queue',
    })}
    ${ticketReadonlySections(t)}
    <div class="sup-detail-stack sup-detail-stack--comments">
      ${commentsSection(t.comments, {
        postAction: `/audit/tickets/${escapeHtml(ref)}/comment`,
        placeholder: 'Private comment for the RMO (not visible to the department)…',
      })}
      ${executiveCommentsBlock(t, ref)}
    </div>
    ${supDecisionPanel({
      title: 'Audit decision',
      desc: 'Approve the mitigation solution so the department can begin implementation, or return it to the RMO if it is insufficient.',
      bodyHtml: decisionBody,
    })}`;

  return auditPage({
    title: `Audit ${ref}`,
    user,
    activeNav: 'review',
    body,
    stats,
  });
}

function ticketViewPage(user, ticket, { flash, stats = {} } = {}) {
  const t = ticket;
  const body = `
    ${flashMessage(flash)}
    ${supTicketHead({
      title: t.title,
      ref: t.reference,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: '/audit/tickets',
      backLabel: 'Back to all tickets',
    })}
    ${ticketReadonlySections(t)}
    <div class="sup-detail-stack sup-detail-stack--comments">
      ${commentsSection(t.comments, {
        postAction: `/audit/tickets/${escapeHtml(t.reference)}/comment`,
        placeholder: 'Private comment for the RMO (not visible to the department)…',
      })}
      ${executiveCommentsBlock(t, t.reference)}
    </div>`;

  return auditPage({
    title: t.reference,
    user,
    activeNav: 'tickets',
    body,
    stats,
  });
}

function renderAuditTicketPage(user, ticket, opts) {
  if (ticket.status === 'under_audit') {
    return ticketAuditPage(user, ticket, opts);
  }
  if (ticket.status === 'pending_audit') {
    const accomplishment = getAccomplishmentForTicket(ticket);
    return ticketAccomplishmentAuditPage(user, ticket, accomplishment, opts);
  }
  return ticketViewPage(user, ticket, opts);
}

module.exports = {
  auditOverviewPage,
  auditReviewQueuePage,
  auditFinalValidationQueuePage,
  allTicketsPage,
  renderAuditTicketPage,
};
