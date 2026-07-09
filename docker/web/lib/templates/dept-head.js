const {
  getCategoryLabel,
  getStatusLabel,
  getStatusTone,
  getPriorityLabel,
  getPriorityTone,
  DEPARTMENTS,
} = require('../../config/tickets');
const { escapeHtml, formatDate, formatIncidentDate, formatDateOnly } = require('../html');
const { flashMessage } = require('./layout');
const { deptHeadAppLayout } = require('./dept-head-layout');
const { layoutNotifications } = require('../notifications');
const { evidenceSection } = require('./evidence');
const { supTicketHead, supDetailCard } = require('./console-ui');
const { threadDiscussionSection } = require('./thread-discussion');

/* —— shared bits —— */

function statusPill(status, overdue) {
  const tone = overdue ? 'bad' : getStatusTone(status);
  return `<span class="pill pill--${tone}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function priorityPill(priority) {
  if (!priority) return '<span class="text-muted">—</span>';
  return `<span class="pill pill--${getPriorityTone(priority)}">${escapeHtml(getPriorityLabel(priority))}</span>`;
}

function riskLevelFromSeverityLocal(severity1to5) {
  const sev = Math.max(1, Math.min(5, Number(severity1to5) || 2));
  if (sev <= 2) return { id: 'low', label: 'Low' };
  if (sev === 3) return { id: 'moderate', label: 'Moderate' };
  if (sev === 4) return { id: 'high', label: 'High' };
  return { id: 'critical', label: 'Extreme/Critical' };
}

function ticketRiskLevel(ticket) {
  if (ticket?.ai?.riskLevel) return ticket.ai.riskLevel;
  const sev =
    ticket?.ai?.severity
    || (ticket?.likelihood && ticket?.impact ? Math.round((ticket.likelihood + ticket.impact) / 2) : 2);
  return riskLevelFromSeverityLocal(sev);
}

function riskLevelBadge(riskLevel) {
  const id = riskLevel?.id || 'low';
  const label = riskLevel?.label || 'Low';
  return `<span class="risk-badge risk-badge--${escapeHtml(id)}">${escapeHtml(label)}</span>`;
}

function ownershipBadge(ticket) {
  const state = ticket.ownership?.state || 'unassigned';
  const map = {
    pending: { cls: 'info', label: 'Awaiting acceptance' },
    accepted: { cls: 'rmo', label: 'Owned' },
    rejected: { cls: 'warn', label: 'Rejected' },
    unassigned: { cls: 'muted', label: 'Unassigned' },
  };
  const m = map[state] || map.unassigned;
  return `<span class="pill pill--${m.cls}">${escapeHtml(m.label)}</span>`;
}

const KPI_ICONS = {
  total: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
  inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  active: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  drafts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`,
  president: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v6c0 5 3.8 8.5 9 9 5.2-.5 9-4 9-9V7z"/></svg>`,
  overdue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  closed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
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

function pageLayout(opts) {
  const { stats, user, ...rest } = opts;
  const notifications = opts.notifications || layoutNotifications(user);
  return deptHeadAppLayout({ stats, user, notifications, ...rest });
}

/* —— list / table rendering —— */

function ticketRows(tickets, { showDueColumn = false } = {}) {
  return tickets
    .map(
      (t) => `<tr class="${t.isOverdue ? 'ticket-row--overdue' : ''}">
        <td class="mono nowrap"><a href="/dept/tickets/${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${escapeHtml(t.submittedByName || t.submittedBy)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel || getCategoryLabel(t.category))}</td>
        <td>${ownershipBadge(t)}</td>
        <td>${statusPill(t.status, t.isOverdue)}</td>
        ${showDueColumn ? `<td class="nowrap cell--overdue">${t.dueAt ? `${escapeHtml(formatDateOnly(t.dueAt))} <span class="pill pill--bad pill--overdue">Overdue</span>` : '—'}</td>` : ''}
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
      </tr>`,
    )
    .join('');
}

function draftPlanRows(tickets) {
  return tickets
    .map(
      (t) => `<tr>
        <td class="mono nowrap"><a href="/dept/tickets/${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${escapeHtml(t.submittedByName || t.submittedBy)}</td>
        <td><span class="pill pill--warn">Draft</span></td>
        <td class="nowrap">${escapeHtml(formatDate(t.actionPlanDraftUpdatedAt || t.updatedAt))}</td>
        <td class="nowrap">${t.dueAt ? escapeHtml(formatDateOnly(t.dueAt)) : '—'}</td>
      </tr>`,
    )
    .join('');
}

function queuePage(user, { title, desc, tickets, flash, error, activeNav, emptyMessage, stats, showDueColumn = false }) {
  const rows = ticketRows(tickets, { showDueColumn });
  const colSpan = showDueColumn ? 8 : 7;
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
              <th>Reporter</th>
              <th>Category</th>
              <th>Ownership</th>
              <th>Status</th>
              ${showDueColumn ? '<th>Target date</th>' : ''}
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${colSpan}" class="empty">${escapeHtml(emptyMessage)}</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

  return pageLayout({ title, user, activeNav, body, stats });
}

/* —— dashboard —— */

function deptHeadOverviewPage(user, stats, flash, tickets = []) {
  const recent = tickets.slice(0, 6);
  const rows = ticketRows(recent);
  const dept = user.department || 'your department';

  const body = `
    ${flashMessage(flash)}
    <div class="sup-page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="sup-page-desc">Welcome, ${escapeHtml(user.displayName || user.username)} — you own risk tickets routed to ${escapeHtml(dept)}.</p>
      </div>
      <a href="/dept/inbox" class="filter-pill filter-pill--head">Ownership inbox <span class="filter-pill__count">${stats.inbox}</span></a>
    </div>
    <div class="sup-kpi-grid sup-kpi-grid--officer">
      ${kpiCard('/dept/tickets', KPI_ICONS.total, stats.total, 'Department tickets', 'sup-kpi--accent')}
      ${kpiCard('/dept/inbox', KPI_ICONS.inbox, stats.inbox, 'Awaiting acceptance', stats.inbox ? 'sup-kpi--warn' : '')}
      ${kpiCard('/dept/active', KPI_ICONS.active, stats.active, 'In progress')}
      ${kpiCard('/dept/drafts', KPI_ICONS.drafts, stats.drafts, 'Action plan drafts', stats.drafts ? 'sup-kpi--warn' : '')}
      ${kpiCard('/dept/closure', KPI_ICONS.closed, stats.pendingClosure, 'Pending closure', stats.pendingClosure ? 'sup-kpi--warn' : '')}
      ${kpiCard('/dept/tickets', KPI_ICONS.president, stats.awaitingPresident, 'Awaiting President')}
      ${kpiCard('/dept/overdue', KPI_ICONS.overdue, stats.overdue, 'Overdue', stats.overdue ? 'sup-kpi--warn' : '')}
      ${kpiCard('/dept/tickets', KPI_ICONS.closed, stats.closed, 'Closed')}
    </div>
    <section class="sup-card sup-card--table">
      <div class="sup-card__head">
        <h2>Recent department tickets</h2>
        <a href="/dept/tickets" class="sup-link">View all</a>
      </div>
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table sup-table">
          <thead>
            <tr>
              <th>Reference</th><th>Title</th><th>Reporter</th><th>Category</th><th>Ownership</th><th>Status</th><th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="7" class="empty">No tickets have been routed to your department yet.</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

  return pageLayout({ title: 'Dashboard', user, activeNav: 'dashboard', body, stats });
}

function deptHeadInboxPage(user, tickets, flash, opts = {}) {
  return queuePage(user, {
    title: 'Ownership inbox',
    desc: 'Risk tickets the AI routed to your department. Accept ownership, reject with a reason, or reassign to another department.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'inbox',
    emptyMessage: 'No tickets are awaiting your ownership decision.',
    stats: opts.stats,
  });
}

function deptHeadActivePage(user, tickets, flash, opts = {}) {
  return queuePage(user, {
    title: 'In progress',
    desc: 'Tickets you own before the action plan is sent — accept ownership, build the mitigation plan, and publish it to the reporter.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'active',
    emptyMessage: 'You have no tickets in progress.',
    stats: opts.stats,
  });
}

function deptHeadDraftsPage(user, tickets, flash, opts = {}) {
  const rows = draftPlanRows(tickets);
  const body = `
    ${flashMessage(flash)}
    ${opts.error ? flashMessage(opts.error, 'error') : ''}
    <div class="sup-page-head">
      <div>
        <h1>Action plan drafts</h1>
        <p class="sup-page-desc">Saved action plans you have not sent to the reporter yet. Open a ticket to continue editing, then publish when ready.</p>
      </div>
    </div>
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table sup-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Reporter</th>
              <th>Plan</th>
              <th>Draft saved</th>
              <th>Target date</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No action plan drafts. Save a draft from a ticket you own in progress.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return pageLayout({ title: 'Action plan drafts', user, activeNav: 'drafts', body, stats: opts.stats });
}

function deptHeadOverduePage(user, tickets, flash, opts = {}) {
  return queuePage(user, {
    title: 'Overdue tickets',
    desc: 'Department tickets past the mitigation target date. These may be waiting on reporter implementation or still need your follow-up.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'overdue',
    emptyMessage: 'No overdue tickets. All active department tickets are within their target dates.',
    stats: opts.stats,
    showDueColumn: true,
  });
}

function deptHeadPendingClosurePage(user, tickets, flash, opts = {}) {
  return queuePage(user, {
    title: 'Pending closure',
    desc: 'Reporter accomplishment reports awaiting your review and ticket closure.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'closure',
    emptyMessage: 'No tickets are awaiting closure.',
    stats: opts.stats,
  });
}

function deptHeadAllTicketsPage(user, tickets, flash, opts = {}) {
  return queuePage(user, {
    title: 'All department tickets',
    desc: 'Every risk ticket associated with your department across the full lifecycle.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'tickets',
    emptyMessage: 'No department tickets yet.',
    stats: opts.stats,
  });
}

/* —— ticket detail —— */

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

function transferIndication(ticket) {
  const from = ticket.ownership?.reassignedFrom;
  if (!from) return '';
  const latest = [...(ticket.reassignments || [])].reverse()[0];
  const at = latest?.at ? formatDate(latest.at) : '';
  return `<div class="dept-transfer-note" role="note">
    <div class="dept-transfer-note__body">
      <strong>Department transfer</strong>
      <p>Transferred from <span class="dept-transfer-note__from">${escapeHtml(from)}</span> to ${escapeHtml(ticket.department || '—')}${at ? ` · ${escapeHtml(at)}` : ''}</p>
    </div>
  </div>`;
}

function detailsSidebar(ticket) {
  const riskLevel = ticketRiskLevel(ticket);
  const owner = ticket.ownership?.ownerName
    ? `${escapeHtml(ticket.ownership.ownerName)}`
    : '<span class="text-muted">Unassigned</span>';
  const due = ticket.mitigationDueAt || ticket.actionPlan?.targetDate;
  const submittedAt = ticket.submittedAt || ticket.routedAt || ticket.createdAt;
  const incidentDate = formatIncidentDate(ticket.fiveW1H?.when);

  return `<div class="dept-side-card">
    <h3 class="dept-side-card__title">Details</h3>
    <dl class="detail-dl detail-dl--console">
      <dt>Ownership</dt><dd>${ownershipBadge(ticket)}</dd>
      <dt>Owner</dt><dd>${owner}</dd>
      <dt>Department</dt><dd>${escapeHtml(ticket.department || '—')}</dd>
      <dt>Reporter</dt><dd>${escapeHtml(ticket.submittedByName || ticket.submittedBy || '—')}</dd>
      <dt>Reporter dept.</dt><dd>${escapeHtml(ticket.reporterDepartment || '—')}</dd>
      <dt>Category</dt><dd>${escapeHtml(ticket.categoryLabel || getCategoryLabel(ticket.category))}</dd>
      <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel)}</dd>
      <dt>Priority</dt><dd>${priorityPill(ticket.priority)}</dd>
      <dt>Likelihood × Impact</dt><dd>${ticket.likelihood} × ${ticket.impact} (${ticket.riskScore || ticket.likelihood * ticket.impact})</dd>
      <dt>Submitted</dt><dd>${escapeHtml(formatDate(submittedAt))}</dd>
      ${incidentDate ? `<dt>Incident occurred</dt><dd>${escapeHtml(incidentDate)}</dd>` : ''}
      ${due ? `<dt>Target date</dt><dd>${escapeHtml(formatDate(due))}</dd>` : ''}
    </dl>
  </div>`;
}

function aiCard(ticket) {
  if (!ticket.ai) return '';
  const inner = `<p class="sup-muted-block">${escapeHtml(ticket.ai.summary)}</p>
    <dl class="detail-dl detail-dl--console">
      <dt>Likelihood</dt><dd>${ticket.ai.likelihood || ticket.likelihood}/5</dd>
      <dt>Impact</dt><dd>${ticket.ai.impact || ticket.impact}/5</dd>
      <dt>Confidence</dt><dd>${Math.round((ticket.ai.confidence || 0) * 100)}%</dd>
    </dl>
    ${ticket.ai.suggestedMitigation ? `<div class="dept-suggested"><strong>Suggested initial mitigation</strong><p>${escapeHtml(ticket.ai.suggestedMitigation)}</p></div>` : ''}`;
  return supDetailCard('AI classification &amp; routing', inner, { compact: true });
}

function reassignmentHistoryCard(ticket) {
  const items = ticket.reassignments || [];
  if (!items.length) return '';
  const rows = [...items]
    .reverse()
    .map(
      (r) => `<li class="audit-trail-item">
        <div class="audit-trail-meta">
          <span class="audit-trail-action">${escapeHtml(r.fromDepartment)} → ${escapeHtml(r.toDepartment)}</span>
          <span class="audit-trail-user">${escapeHtml(r.byName || r.byUsername)}</span>
          <span class="audit-trail-time">${escapeHtml(formatDate(r.at))}</span>
        </div>
        <p class="audit-trail-current__plan">${escapeHtml(r.reason)}</p>
      </li>`,
    )
    .join('');
  return supDetailCard('Reassignment history', `<ul class="audit-trail-list">${rows}</ul>`);
}

function actionPlanCard(ticket, ref, { editable }) {
  const plan = ticket.actionPlan;
  const isDraft = plan && !plan.publishedToReporterAt && !plan.submittedForReviewAt;
  const view = plan
    ? `<div class="sup-card__body">
        <p class="dept-plan__summary">${escapeHtml(plan.summary)}</p>
        ${(plan.steps || []).length ? `<ol class="dept-plan__steps">${plan.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : ''}
        <p class="sup-muted-block">v${plan.version} · updated ${escapeHtml(formatDate(plan.updatedAt))} by ${escapeHtml(plan.updatedByName || '—')}${plan.targetDate ? ` · target ${escapeHtml(formatDate(plan.targetDate))}` : ''}${plan.publishedToReporterAt || plan.submittedForReviewAt ? ` · sent to reporter ${escapeHtml(formatDate(plan.publishedToReporterAt || plan.submittedForReviewAt))}` : ''}</p>
      </div>`
    : `<div class="sup-card__body"><p class="sup-muted-block">No action plan yet.</p></div>`;

  const form = editable
    ? `<form method="post" action="/dept/tickets/${escapeHtml(ref)}/action-plan" class="stack-form stack-form--console dept-inline-form">
        <div class="field field--console">
          <label for="planSummary">${plan ? 'Update action plan' : 'Action plan summary'}</label>
          <textarea id="planSummary" name="summary" rows="3" required placeholder="Describe the corrective actions the department will take…">${escapeHtml(plan?.summary || '')}</textarea>
        </div>
        <div class="field field--console">
          <label for="planSteps">Action steps <span class="text-muted">(one per line, optional)</span></label>
          <textarea id="planSteps" name="steps" rows="3" placeholder="Step 1&#10;Step 2&#10;Step 3">${escapeHtml((plan?.steps || []).join('\n'))}</textarea>
        </div>
        <div class="field field--console">
          <label for="planTarget">Target completion date <span class="text-muted">(required to send to reporter)</span></label>
          <input id="planTarget" name="targetDate" type="date" value="${plan?.targetDate ? new Date(plan.targetDate).toISOString().slice(0, 10) : ''}">
        </div>
        <button type="submit" class="btn-accept--outline">${plan ? 'Save draft' : 'Save action plan draft'}</button>
        <button type="submit" name="submitForReview" value="1" class="btn-primary btn-primary--auto">Send to reporter for implementation</button>
      </form>`
    : '';

  return `<section class="sup-card sup-card--accent">
    <div class="sup-card__head"><h2>Action plan${ticket.actionPlan ? ` <span class="text-muted">(v${ticket.actionPlan.version})</span>` : ''}${isDraft ? ' <span class="pill pill--warn">Draft</span>' : ''}</h2></div>
    ${isDraft ? '<div class="dept-plan-draft-banner" role="status">Draft saved — not sent to the reporter yet. Set a target date and use “Send to reporter for implementation” when ready.</div>' : ''}
    ${view}
    ${form ? `<div class="sup-card__body">${form}</div>` : ''}
  </section>`;
}

function deptExecutionToolbar(ref, { editable }) {
  if (!editable) return '';
  return `<div class="dept-compact-actions" aria-label="Ticket workbench actions">
    <button type="button" class="dept-compact-btn" data-dept-modal-open="progress">Post progress update</button>
  </div>`;
}

function progressCard(ticket, ref, { editable }) {
  const updates = ticket.progressUpdates || [];
  if (!updates.length) return '';

  const list = `<ul class="dept-progress">${[...updates]
    .reverse()
    .map(
      (u) => `<li class="dept-progress__item">
        <div class="dept-progress__meta">
          ${u.percent != null ? `<span class="dept-progress__pct">${u.percent}%</span>` : ''}
          <span class="dept-progress__author">${escapeHtml(u.authorName || u.authorUsername)}</span>
          <span class="dept-progress__time">${escapeHtml(formatDate(u.at))}</span>
        </div>
        <p class="dept-progress__body">${escapeHtml(u.body)}</p>
      </li>`,
    )
    .join('')}</ul>`;

  return `<section class="sup-card sup-card--compact dept-panel--compact">
    <div class="sup-card__head"><h2>Progress updates <span class="text-muted">(${updates.length})</span></h2></div>
    <div class="sup-card__body">${list}</div>
  </section>`;
}

function deptExecutionModals(ref) {
  const progressForm = `<form method="post" action="/dept/tickets/${escapeHtml(ref)}/progress" class="stack-form stack-form--console dept-modal__form">
    <div class="field field--console">
      <label for="progressBody">Progress update</label>
      <textarea id="progressBody" name="update" rows="3" required placeholder="Describe what has been done since the last update…"></textarea>
    </div>
    <div class="field field--console">
      <label for="progressPct">Completion %</label>
      <input id="progressPct" name="percent" type="number" min="0" max="100" placeholder="e.g. 60">
    </div>
    <div class="dept-modal__actions">
      <button type="button" class="btn-outline btn-primary--auto" data-dept-modal-close>Cancel</button>
      <button type="submit" class="btn-primary btn-primary--auto">Submit update</button>
    </div>
  </form>`;

  return deptModalShell('dept-modal-progress', 'Post progress update', 'Record implementation progress for the reporter and audit trail.', progressForm);
}

function documentsSection(ticket, ref, { editable }) {
  const evidence = evidenceSection(ticket, {
    attachmentBasePath: '/dept/attachments',
    theme: 'console',
    interactive: true,
  });
  const uploadForm = editable
    ? `<section class="sup-card">
        <div class="sup-card__head"><h2>Upload documents</h2></div>
        <div class="sup-card__body">
          <form method="post" action="/dept/tickets/${escapeHtml(ref)}/documents" enctype="multipart/form-data" class="stack-form stack-form--console dept-inline-form">
            <div class="field field--console">
              <label for="deptDocs">Supporting documents</label>
              <p class="field-hint">Upload action-plan documents, evidence of implementation, or supporting files (max 20MB each).</p>
              <input id="deptDocs" name="attachments" type="file" multiple>
            </div>
            <button type="submit" class="btn-accept--outline">Upload</button>
          </form>
        </div>
      </section>`
    : '';
  return `${evidence}${uploadForm}`;
}

function finalResolutionCard(ticket, ref, { editable }) {
  const res = ticket.finalResolution;
  if (!res) return '';
  return supDetailCard(
      'Final resolution',
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

function accomplishmentReviewCard(ticket) {
  const acc = ticket.accomplishment;
  if (!acc) return '';
  return supDetailCard(
    'Reporter accomplishment report',
    `<p class="sup-muted-block">Submitted by ${escapeHtml(acc.submittedByName || acc.submittedBy)} on ${escapeHtml(formatDate(acc.submittedAt))}</p>
     <div class="accomplishment-blocks">
       <div class="accomplishment-block">
         <h3 class="accomplishment-block__label">Implementation summary</h3>
         <p class="accomplishment-block__content">${escapeHtml(acc.summary)}</p>
       </div>
       <div class="accomplishment-block">
         <h3 class="accomplishment-block__label">Outcomes and results</h3>
         <p class="accomplishment-block__content">${escapeHtml(acc.outcomes)}</p>
       </div>
     </div>`,
    { accent: true },
  );
}

function closureActionCard(ref, { canClose }) {
  if (!canClose) return '';
  return `<section class="dept-closure-card dept-closure-card--compact" aria-label="Close ticket">
    <button type="button" class="dept-closure-card__btn" data-dept-modal-open="close">Close ticket</button>
  </section>`;
}

function closureModal(ref) {
  const closeForm = `<form method="post" action="/dept/tickets/${escapeHtml(ref)}/close" class="stack-form stack-form--console dept-modal__form">
    <div class="field field--console">
      <label for="closingNotes">Closing notes <span class="text-muted">(optional)</span></label>
      <textarea id="closingNotes" name="closingNotes" rows="3" placeholder="Summarize closure decision or follow-up items…"></textarea>
    </div>
    <div class="dept-modal__actions">
      <button type="button" class="btn-outline btn-primary--auto" data-dept-modal-close>Cancel</button>
      <button type="submit" class="dept-closure-card__btn dept-closure-card__btn--inline">Close ticket</button>
    </div>
  </form>`;
  return deptModalShell(
    'dept-modal-close',
    'Close ticket',
    'The reporter submitted an accomplishment report. Add optional closing notes, then confirm closure.',
    closeForm,
  );
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

function departmentSelectOptions(excludeDepartment) {
  return DEPARTMENTS.filter((d) => d !== excludeDepartment)
    .map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`)
    .join('');
}

function deptModalShell(id, title, desc, formHtml) {
  return `<div class="dept-modal" id="${escapeHtml(id)}" hidden aria-hidden="true">
    <div class="dept-modal__backdrop" data-dept-modal-close tabindex="-1" aria-hidden="true"></div>
    <div class="dept-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(id)}-title">
      <div class="dept-modal__head">
        <h3 class="dept-modal__title" id="${escapeHtml(id)}-title">${escapeHtml(title)}</h3>
        <button type="button" class="dept-modal__close" aria-label="Close" data-dept-modal-close>&times;</button>
      </div>
      ${desc ? `<p class="dept-modal__desc">${escapeHtml(desc)}</p>` : ''}
      ${formHtml}
    </div>
  </div>`;
}

function ownershipActionBar(ref, { mode }) {
  const sideClass = ' dept-action-bar--side';
  if (mode === 'assigned') {
    return `<section class="dept-action-bar${sideClass}" aria-label="Ownership actions">
      <div class="dept-action-bar__copy">
        <strong>Ownership decision</strong>
        <p>Review the report, then choose an action.</p>
      </div>
      <div class="dept-action-bar__buttons">
        <form method="post" action="/dept/tickets/${escapeHtml(ref)}/accept" class="dept-action-form">
          <button type="submit" class="dept-action-btn dept-action-btn--accept">Accept ownership</button>
        </form>
        <button type="button" class="dept-action-btn dept-action-btn--reject" data-dept-modal-open="reject">Reject ownership</button>
        <button type="button" class="dept-action-btn dept-action-btn--reassign" data-dept-modal-open="reassign">Request reassignment</button>
      </div>
    </section>`;
  }
  if (mode === 'reassign') {
    return `<section class="dept-action-bar dept-action-bar--compact${sideClass}" aria-label="Transfer actions">
      <div class="dept-action-bar__copy">
        <strong>Transfer ticket</strong>
        <p>Send to another department if this no longer belongs here.</p>
      </div>
      <div class="dept-action-bar__buttons">
        <button type="button" class="dept-action-btn dept-action-btn--reassign" data-dept-modal-open="reassign">Transfer to another department</button>
      </div>
    </section>`;
  }
  return '';
}

function deptOwnershipModals(ref, ticket) {
  const deptOptions = departmentSelectOptions(ticket.department);

  const rejectForm = `<form method="post" action="/dept/tickets/${escapeHtml(ref)}/reject" class="stack-form stack-form--console dept-modal__form">
    <div class="field field--console">
      <label for="rejectReason">Reason <span class="text-muted">(required)</span></label>
      <textarea id="rejectReason" name="reason" rows="3" required placeholder="Explain why this ticket does not belong to your department…"></textarea>
    </div>
    <div class="dept-modal__actions">
      <button type="button" class="btn-outline btn-primary--auto" data-dept-modal-close>Cancel</button>
      <button type="submit" class="btn-danger--outline">Reject ownership</button>
    </div>
  </form>`;

  const reassignForm = `<form method="post" action="/dept/tickets/${escapeHtml(ref)}/reassign" class="stack-form stack-form--console dept-modal__form">
    <div class="field field--console">
      <label for="reassignReason">Reason <span class="text-muted">(required)</span></label>
      <textarea id="reassignReason" name="reason" rows="2" required placeholder="e.g. This incident is related to Facilities Management."></textarea>
    </div>
    <div class="field field--console">
      <label for="reassignComment">Comment <span class="text-muted">(required)</span></label>
      <textarea id="reassignComment" name="comment" rows="3" required placeholder="I recommend transferring the ticket to the Administration Department."></textarea>
    </div>
    <div class="field field--console">
      <label for="reassignTarget">Transfer to <span class="text-muted">(required)</span></label>
      <select id="reassignTarget" name="targetDepartment" required>
        <option value="">Select department…</option>
        ${deptOptions}
      </select>
    </div>
    <div class="dept-modal__actions">
      <button type="button" class="btn-outline btn-primary--auto" data-dept-modal-close>Cancel</button>
      <button type="submit" class="btn-primary btn-primary--auto">Transfer ticket</button>
    </div>
  </form>`;

  return [
    deptModalShell('dept-modal-reject', 'Reject ownership', 'Decline ownership. The Risk Management Unit will re-route the ticket.', rejectForm),
    deptModalShell('dept-modal-reassign', 'Request reassignment', 'Transfer this ticket to the correct department. Your reason and comment are recorded on the activity timeline.', reassignForm),
  ].join('');
}

const DEPT_MODALS_SCRIPT = `<script>
(function () {
  function closeAllDeptModals() {
    document.querySelectorAll('.dept-modal:not([hidden])').forEach(function (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('dept-modal-open');
  }

  function openDeptModal(id) {
    closeAllDeptModals();
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('dept-modal-open');
    var focusable = modal.querySelector('textarea, select, button:not(.dept-modal__close)');
    if (focusable) focusable.focus();
  }

  document.querySelectorAll('[data-dept-modal-open]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openDeptModal('dept-modal-' + btn.getAttribute('data-dept-modal-open'));
    });
  });

  document.querySelectorAll('[data-dept-modal-close]').forEach(function (el) {
    el.addEventListener('click', closeAllDeptModals);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') closeAllDeptModals();
  });
})();
</script>`;

/* —— Jira-like activity (comments / history / timeline) —— */

function historyBlock(ticket) {
  const trail = ticket.auditTrail || [];
  const items = trail.length
    ? [...trail]
        .reverse()
        .map(
          (e) => `<li class="audit-trail-item">
            <div class="audit-trail-meta">
              <span class="audit-trail-action">${escapeHtml(e.action)}</span>
              <span class="audit-trail-user">${escapeHtml(e.actorName || e.actorUsername || 'System')}</span>
              <span class="audit-trail-time">${escapeHtml(formatDate(e.at))}</span>
            </div>
            ${e.detail ? `<p class="audit-trail-current__plan">${escapeHtml(e.detail)}</p>` : ''}
          </li>`,
        )
        .join('')
    : '<li class="text-muted">No history recorded yet.</li>';
  return `<div class="dept-activity__panel" data-activity-panel="history" hidden>
    <ul class="audit-trail-list">${items}</ul>
  </div>`;
}

function timelineBlock(ticket) {
  const timeline = ticket.timeline || [];
  const items = timeline.length
    ? timeline
        .map(
          (e) => `<li class="ticket-timeline-item">
            <div class="ticket-timeline-item__dot" aria-hidden="true"></div>
            <div class="ticket-timeline-item__body">
              <div class="ticket-timeline-item__meta">
                <strong>${escapeHtml(e.action)}</strong>
                <span class="ticket-timeline-item__time">${escapeHtml(formatDate(e.at))}</span>
              </div>
              ${e.detail ? `<p class="ticket-timeline-item__detail">${escapeHtml(e.detail)}</p>` : ''}
              ${e.actorName ? `<span class="ticket-timeline-item__actor">${escapeHtml(e.actorName)}</span>` : ''}
            </div>
          </li>`,
        )
        .join('')
    : '<li class="text-muted">Lifecycle events will appear here.</li>';
  return `<div class="dept-activity__panel" data-activity-panel="timeline" hidden>
    <ol class="ticket-timeline">${items}</ol>
  </div>`;
}

function activitySection(ticket, ref, user) {
  const commentCount = (ticket.threadComments || []).length;
  const historyCount = (ticket.auditTrail || []).length;
  const timelineCount = (ticket.timeline || []).length;

  const discussion = threadDiscussionSection(ticket, ref, {
    title: '',
    hint: '',
    postAction: `/dept/tickets/${ref}/comment`,
    editAction: `/dept/tickets/${ref}/comment/edit`,
    reactAction: `/dept/tickets/${ref}/comment/react`,
    canPost: true,
    canReact: true,
    canEditOwn: true,
    currentUsername: user?.username,
    composePlaceholder: 'Discuss this ticket with the reporter and Risk Management Unit…',
  }).replace('<section class="sup-card sup-card--thread">', '<div class="dept-activity__panel" data-activity-panel="comments">')
    .replace(/<div class="sup-card__head"><h2><\/h2><\/div>\s*/, '')
    .replace(/<p class="section-hint"><\/p>\s*/, '')
    .replace('</section>', '</div>');

  return `<section class="sup-card dept-activity" data-activity>
    <div class="sup-card__head"><h2>Activity</h2></div>
    <div class="sup-card__body">
      <div class="dept-activity__tabs" role="tablist">
        <button type="button" class="dept-activity__tab is-active" data-activity-tab="comments">Comments <span class="dept-activity__count">${commentCount}</span></button>
        <button type="button" class="dept-activity__tab" data-activity-tab="history">History <span class="dept-activity__count">${historyCount}</span></button>
        <button type="button" class="dept-activity__tab" data-activity-tab="timeline">Timeline <span class="dept-activity__count">${timelineCount}</span></button>
      </div>
      ${discussion}
      ${historyBlock(ticket)}
      ${timelineBlock(ticket)}
    </div>
  </section>`;
}

const ACTIVITY_TABS_SCRIPT = `<script>
(function () {
  document.querySelectorAll('[data-activity]').forEach(function (root) {
    var tabs = root.querySelectorAll('[data-activity-tab]');
    var panels = root.querySelectorAll('[data-activity-panel]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-activity-tab');
        tabs.forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        panels.forEach(function (p) { p.hidden = p.getAttribute('data-activity-panel') !== target; });
      });
    });
  });
})();
</script>`;

function renderDeptHeadTicketPage(user, ticket, opts = {}) {
  const t = ticket;
  const ref = t.reference;
  const isAssigned = t.status === 'assigned';
  const isOwner = Boolean(t.ownership?.ownerUsername && t.ownership.ownerUsername === user.username);
  const canExecute = ['in_progress', 'reopened'].includes(t.status) && isOwner;
  const canClose = t.status === 'pending_audit' && Boolean(t.accomplishment);

  const statusNotice = t.status === 'ownership_rejected'
    ? `<div class="dept-status-notice dept-status-notice--error" role="note">This ticket was returned to the reporter${t.ownership?.rejectionReason ? `: ${escapeHtml(t.ownership.rejectionReason)}` : ''}. Awaiting reporter revision.</div>`
    : t.status === 'in_mitigation'
      ? `<div class="dept-status-notice dept-status-notice--info" role="note">Mitigation plan sent to the reporter. Awaiting their implementation and accomplishment report.</div>`
    : t.status === 'closed'
      ? `<div class="dept-status-notice dept-status-notice--success" role="note">This ticket is closed${t.closure?.closedByName ? ` by ${escapeHtml(t.closure.closedByName)}` : ''}${t.closure?.closedAt ? ` on ${escapeHtml(formatDate(t.closure.closedAt))}` : ''}.</div>`
      : '';

  const main = `
    ${supDetailCard(
      'Risk report',
      `<dl class="detail-dl detail-dl--console">
        <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
        <dt>Reported by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)}${t.reporterDepartment ? ` (${escapeHtml(t.reporterDepartment)})` : ''}</dd>
      </dl>
      <p class="sup-detail-desc">${escapeHtml(t.description || '—')}</p>`,
    )}
    ${supDetailCard('5W1H report', fiveW1HReadonly(t))}
    ${aiCard(t)}
    ${reassignmentHistoryCard(t)}
    ${actionPlanCard(t, ref, { editable: canExecute })}
    ${deptExecutionToolbar(ref, { editable: canExecute })}
    ${progressCard(t, ref, { editable: canExecute })}
    ${documentsSection(t, ref, { editable: canExecute })}
    ${accomplishmentReviewCard(t)}
    ${finalResolutionCard(t, ref, { editable: canExecute })}
    ${presidentDecisionCard(t)}
    ${activitySection(t, ref, user)}`;

  const showOwnershipBar = isAssigned;
  const showReassignBar = canExecute;
  const showModals = showOwnershipBar || showReassignBar || canClose || canExecute;

  const body = `
    ${flashMessage(opts.flash)}
    ${opts.error ? flashMessage(opts.error, 'error') : ''}
    ${statusNotice}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: isAssigned ? '/dept/inbox' : '/dept/tickets',
      backLabel: isAssigned ? 'Back to inbox' : 'Back to tickets',
    })}
    <div class="dept-detail">
      <div class="dept-detail__main">${main}</div>
      <aside class="dept-detail__side">
        ${transferIndication(t)}
        ${detailsSidebar(t)}
        ${closureActionCard(ref, { canClose })}
        ${showOwnershipBar ? ownershipActionBar(ref, { mode: 'assigned' }) : ''}
        ${showReassignBar ? ownershipActionBar(ref, { mode: 'reassign' }) : ''}
      </aside>
    </div>
    ${showModals ? deptOwnershipModals(ref, t) : ''}
    ${canExecute ? deptExecutionModals(ref) : ''}
    ${canClose ? closureModal(ref) : ''}
    ${ACTIVITY_TABS_SCRIPT}
    ${showModals ? DEPT_MODALS_SCRIPT : ''}`;

  return pageLayout({
    title: ref,
    user,
    activeNav: isAssigned ? 'inbox' : 'tickets',
    body,
    stats: opts.stats,
  });
}

module.exports = {
  deptHeadOverviewPage,
  deptHeadInboxPage,
  deptHeadActivePage,
  deptHeadDraftsPage,
  deptHeadOverduePage,
  deptHeadPendingClosurePage,
  deptHeadAllTicketsPage,
  renderDeptHeadTicketPage,
};
