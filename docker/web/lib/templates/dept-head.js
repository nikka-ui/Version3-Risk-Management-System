const {
  getCategoryLabel,
  getStatusLabel,
  getStatusTone,
  getPriorityLabel,
  getPriorityTone,
  DEPARTMENTS,
} = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { flashMessage } = require('./layout');
const { deptHeadAppLayout } = require('./dept-head-layout');
const { layoutNotifications } = require('../notifications');
const { evidenceSection } = require('./evidence');
const { supTicketHead, supDetailCard, supDecisionPanel } = require('./console-ui');
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

function ticketRows(tickets) {
  return tickets
    .map(
      (t) => `<tr>
        <td class="mono nowrap"><a href="/dept/tickets/${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${escapeHtml(t.submittedByName || t.submittedBy)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel || getCategoryLabel(t.category))}</td>
        <td>${ownershipBadge(t)}</td>
        <td>${statusPill(t.status, t.isOverdue)}</td>
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
      </tr>`,
    )
    .join('');
}

function queuePage(user, { title, desc, tickets, flash, error, activeNav, emptyMessage, stats }) {
  const rows = ticketRows(tickets);
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
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="7" class="empty">${escapeHtml(emptyMessage)}</td></tr>`}</tbody>
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
      ${kpiCard('/dept/tickets', KPI_ICONS.president, stats.awaitingPresident, 'Awaiting President')}
      ${kpiCard('/dept/active', KPI_ICONS.overdue, stats.overdue, 'Overdue', stats.overdue ? 'sup-kpi--warn' : '')}
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
    desc: 'Tickets you own and are actively working — build action plans, assign personnel, report progress, and submit resolutions.',
    tickets,
    flash,
    error: opts.error,
    activeNav: 'active',
    emptyMessage: 'You have no tickets in progress.',
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

function detailsSidebar(ticket) {
  const riskLevel = ticketRiskLevel(ticket);
  const owner = ticket.ownership?.ownerName
    ? `${escapeHtml(ticket.ownership.ownerName)}`
    : '<span class="text-muted">Unassigned</span>';
  const due = ticket.mitigationDueAt || ticket.actionPlan?.targetDate;

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
      <dt>Reported</dt><dd>${escapeHtml(formatDate(ticket.submittedAt || ticket.createdAt))}</dd>
      ${due ? `<dt>Target date</dt><dd>${escapeHtml(formatDate(due))}</dd>` : ''}
      <dt>Personnel</dt><dd>${(ticket.personnel || []).length}</dd>
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
  const view = plan
    ? `<div class="sup-card__body">
        <p class="dept-plan__summary">${escapeHtml(plan.summary)}</p>
        ${(plan.steps || []).length ? `<ol class="dept-plan__steps">${plan.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : ''}
        <p class="sup-muted-block">v${plan.version} · updated ${escapeHtml(formatDate(plan.updatedAt))} by ${escapeHtml(plan.updatedByName || '—')}${plan.targetDate ? ` · target ${escapeHtml(formatDate(plan.targetDate))}` : ''}</p>
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
          <label for="planTarget">Target completion date</label>
          <input id="planTarget" name="targetDate" type="date" value="${plan?.targetDate ? new Date(plan.targetDate).toISOString().slice(0, 10) : ''}">
        </div>
        <button type="submit" class="btn-accept--outline">${plan ? 'Save draft' : 'Save action plan draft'}</button>
        <button type="submit" name="submitForReview" value="1" class="btn-primary btn-primary--auto">Submit for compliance review</button>
      </form>`
    : '';

  return `<section class="sup-card sup-card--accent">
    <div class="sup-card__head"><h2>Action plan${ticket.actionPlan ? ` <span class="text-muted">(v${ticket.actionPlan.version})</span>` : ''}</h2></div>
    ${view}
    ${form ? `<div class="sup-card__body">${form}</div>` : ''}
  </section>`;
}

function personnelCard(ticket, ref, { editable }) {
  const people = ticket.personnel || [];
  const list = people.length
    ? `<ul class="dept-people">${people
        .map(
          (p) => `<li class="dept-people__item">
            <span class="dept-people__name">${escapeHtml(p.name)}</span>
            ${p.role ? `<span class="dept-people__role">${escapeHtml(p.role)}</span>` : ''}
            <span class="dept-people__time">${escapeHtml(formatDate(p.assignedAt))}</span>
          </li>`,
        )
        .join('')}</ul>`
    : '<p class="sup-muted-block">No personnel assigned yet.</p>';

  const form = editable
    ? `<form method="post" action="/dept/tickets/${escapeHtml(ref)}/personnel" class="stack-form stack-form--console dept-inline-form dept-inline-form--row">
        <div class="field field--console">
          <label for="personName">Name</label>
          <input id="personName" name="personName" type="text" required placeholder="e.g. Juan Dela Cruz">
        </div>
        <div class="field field--console">
          <label for="personRole">Role / responsibility</label>
          <input id="personRole" name="personRole" type="text" placeholder="e.g. Incident Lead">
        </div>
        <button type="submit" class="btn-accept--outline">Assign personnel</button>
      </form>`
    : '';

  return `<section class="sup-card">
    <div class="sup-card__head"><h2>Assigned personnel <span class="text-muted">(${people.length})</span></h2></div>
    <div class="sup-card__body">${list}${form}</div>
  </section>`;
}

function progressCard(ticket, ref, { editable }) {
  const updates = ticket.progressUpdates || [];
  const list = updates.length
    ? `<ul class="dept-progress">${[...updates]
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
        .join('')}</ul>`
    : '<p class="sup-muted-block">No progress updates submitted yet.</p>';

  const form = editable
    ? `<form method="post" action="/dept/tickets/${escapeHtml(ref)}/progress" class="stack-form stack-form--console dept-inline-form">
        <div class="field field--console">
          <label for="progressBody">Progress update</label>
          <textarea id="progressBody" name="update" rows="3" required placeholder="Describe what has been done since the last update…"></textarea>
        </div>
        <div class="field field--console dept-field--pct">
          <label for="progressPct">Completion %</label>
          <input id="progressPct" name="percent" type="number" min="0" max="100" placeholder="e.g. 60">
        </div>
        <button type="submit" class="btn-accept--outline">Submit progress update</button>
      </form>`
    : '';

  return `<section class="sup-card">
    <div class="sup-card__head"><h2>Progress updates <span class="text-muted">(${updates.length})</span></h2></div>
    <div class="sup-card__body">${list}${form}</div>
  </section>`;
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

function ownershipDecisionPanel(ticket, ref) {
  const deptOptions = DEPARTMENTS.filter((d) => d !== ticket.department)
    .map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`)
    .join('');

  return supDecisionPanel({
    title: 'Ownership decision',
    desc: 'This ticket was routed to your department. Accept ownership to begin work, reject it with a reason, or transfer it to the correct department.',
    bodyHtml: `<div class="decision-actions">
      <section class="decision-action-card decision-action-card--accept">
        <h3 class="decision-action-card__title">Accept ownership</h3>
        <p class="decision-action-card__hint">Take ownership of this ticket for your department.</p>
        <form method="post" action="/dept/tickets/${escapeHtml(ref)}/accept" class="stack-form stack-form--console">
          <div class="field field--console">
            <label for="acceptNote">Note <span class="text-muted">(optional)</span></label>
            <textarea id="acceptNote" name="comment" rows="2" placeholder="Optional note recorded on the timeline…"></textarea>
          </div>
          <button type="submit" class="btn-accept--outline">Accept ownership</button>
        </form>
      </section>
      <section class="decision-action-card decision-action-card--return">
        <h3 class="decision-action-card__title">Reject ownership</h3>
        <p class="decision-action-card__hint">Decline ownership. The Risk Management Unit will re-route the ticket.</p>
        <form method="post" action="/dept/tickets/${escapeHtml(ref)}/reject" class="stack-form stack-form--console">
          <div class="field field--console">
            <label for="rejectReason">Reason <span class="text-muted">(required)</span></label>
            <textarea id="rejectReason" name="reason" rows="2" required placeholder="Explain why this ticket does not belong to your department…"></textarea>
          </div>
          <button type="submit" class="btn-danger--outline">Reject ownership</button>
        </form>
      </section>
      <section class="decision-action-card decision-action-card--reassign">
        <h3 class="decision-action-card__title">Request reassignment</h3>
        <p class="decision-action-card__hint">If the AI assigned the wrong department, request a transfer with a reason and comment.</p>
        <form method="post" action="/dept/tickets/${escapeHtml(ref)}/reassign" class="stack-form stack-form--console">
          <div class="field field--console">
            <label for="reassignReason">Reason <span class="text-muted">(required)</span></label>
            <textarea id="reassignReason" name="reason" rows="2" required placeholder="e.g. Building maintenance issue."></textarea>
          </div>
          <div class="field field--console">
            <label for="reassignComment">Comment <span class="text-muted">(required)</span></label>
            <textarea id="reassignComment" name="comment" rows="2" required placeholder="Additional context for the receiving department…"></textarea>
          </div>
          <div class="field field--console">
            <label for="reassignTarget">Target department <span class="text-muted">(required)</span></label>
            <select id="reassignTarget" name="targetDepartment" required>
              <option value="">Select department…</option>
              ${deptOptions}
            </select>
          </div>
          <button type="submit" class="btn-primary btn-primary--auto">Request reassignment</button>
        </form>
      </section>
    </div>`,
  });
}

function reassignOnlyPanel(ticket, ref) {
  const deptOptions = DEPARTMENTS.filter((d) => d !== ticket.department)
    .map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`)
    .join('');
  return `<section class="sup-card">
    <div class="sup-card__head"><h2>Reassign ticket</h2></div>
    <div class="sup-card__body">
      <p class="sup-muted-block">Transfer this ticket to another department if it no longer belongs here. A reason is recorded on the activity timeline.</p>
      <form method="post" action="/dept/tickets/${escapeHtml(ref)}/reassign" class="stack-form stack-form--console">
        <div class="field field--console">
          <label for="reassignReason2">Reason</label>
          <textarea id="reassignReason2" name="reason" rows="2" required placeholder="Why should this ticket be reassigned?"></textarea>
        </div>
        <div class="field field--console">
          <label for="reassignComment2">Comment</label>
          <textarea id="reassignComment2" name="comment" rows="2" required placeholder="Additional details for the receiving department…"></textarea>
        </div>
        <div class="field field--console">
          <label for="reassignTarget2">Target department</label>
          <select id="reassignTarget2" name="targetDepartment" required>
            <option value="">Select department…</option>
            ${deptOptions}
          </select>
        </div>
        <button type="submit" class="btn-outline btn-primary--auto">Transfer ticket</button>
      </form>
    </div>
  </section>`;
}

/* —— Jira-like activity (comments / history / timeline) —— */

function threadCommentsBlock(ticket, ref) {
  const comments = ticket.threadComments || [];
  const tops = comments.filter((c) => !c.parentId);

  const kindTag = (c) => {
    if (c.kind === 'reassignment') return '<span class="comment-tag comment-tag--reassign">Reassignment</span>';
    if (c.kind === 'system') return '<span class="comment-tag comment-tag--system">System</span>';
    return '';
  };

  const renderComment = (c, { isReply } = {}) => {
    const replies = comments
      .filter((r) => r.parentId === c.id)
      .map((r) => renderComment(r, { isReply: true }))
      .join('');
    const replyForm = !isReply
      ? `<form method="post" action="/dept/tickets/${escapeHtml(ref)}/comment" class="stack-form comment-form comment-form--reply">
          <input type="hidden" name="parentId" value="${escapeHtml(c.id)}">
          <div class="field">
            <label class="visually-hidden" for="reply-${escapeHtml(c.id)}">Reply</label>
            <textarea id="reply-${escapeHtml(c.id)}" name="comment" rows="2" required placeholder="Write a reply…"></textarea>
          </div>
          <button type="submit" class="btn-outline btn-primary--auto">Reply</button>
        </form>`
      : '';
    return `<li class="comment${isReply ? ' comment--reply' : ''}${c.kind && c.kind !== 'comment' ? ' comment--event' : ''}">
      <div class="comment-meta">
        <span class="comment-author">${escapeHtml(c.authorName || c.authorUsername)}</span>
        <span class="comment-role">${escapeHtml(c.roleLabel || c.authorRole)}</span>
        ${kindTag(c)}
        <span class="comment-time">${escapeHtml(formatDate(c.at))}</span>
      </div>
      <p class="comment-body">${escapeHtml(c.body)}</p>
      ${replyForm}
      ${replies ? `<ul class="comment-list comment-list--replies">${replies}</ul>` : ''}
    </li>`;
  };

  const items = tops.length
    ? tops.map((c) => renderComment(c)).join('')
    : '<li class="comment comment--empty text-muted">No comments yet. Start the discussion below.</li>';

  return `<div class="dept-activity__panel" data-activity-panel="comments">
    <ul class="comment-list">${items}</ul>
    <form method="post" action="/dept/tickets/${escapeHtml(ref)}/comment" class="stack-form comment-form">
      <div class="field">
        <label for="thread-comment">Add comment</label>
        <textarea id="thread-comment" name="comment" rows="3" required placeholder="Discuss this ticket with the reporter and Risk Management Unit…"></textarea>
      </div>
      <button type="submit" class="btn-primary btn-primary--auto">Post comment</button>
    </form>
  </div>`;
}

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
  }).replace('<section class="sup-card sup-card--thread">', '<div class="dept-activity__panel" data-activity-panel="comments">')
    .replace(/<h2><\/h2>\s*/, '')
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

  const banner = t.status === 'ownership_rejected'
    ? `<div class="flash flash--error" role="status">Ownership was rejected${t.ownership?.rejectionReason ? `: ${escapeHtml(t.ownership.rejectionReason)}` : ''}. Pending re-routing by the Risk Management Unit.</div>`
    : t.ownership?.reassignedFrom
      ? `<div class="flash flash--success" role="status">Transferred to ${escapeHtml(t.department)} from ${escapeHtml(t.ownership.reassignedFrom)}.</div>`
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
    ${personnelCard(t, ref, { editable: canExecute })}
    ${progressCard(t, ref, { editable: canExecute })}
    ${documentsSection(t, ref, { editable: canExecute })}
    ${finalResolutionCard(t, ref, { editable: canExecute })}
    ${presidentDecisionCard(t)}
    ${activitySection(t, ref, user)}`;

  const side = `
    ${detailsSidebar(t)}
    ${isAssigned ? ownershipDecisionPanel(t, ref) : ''}
    ${canExecute ? reassignOnlyPanel(t, ref) : ''}`;

  const body = `
    ${flashMessage(opts.flash)}
    ${opts.error ? flashMessage(opts.error, 'error') : ''}
    ${banner}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml: statusPill(t.status, t.isOverdue),
      backHref: isAssigned ? '/dept/inbox' : '/dept/tickets',
      backLabel: isAssigned ? 'Back to inbox' : 'Back to tickets',
    })}
    <div class="dept-detail">
      <div class="dept-detail__main">${main}</div>
      <aside class="dept-detail__side">${side}</aside>
    </div>
    ${ACTIVITY_TABS_SCRIPT}`;

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
  deptHeadAllTicketsPage,
  renderDeptHeadTicketPage,
};
