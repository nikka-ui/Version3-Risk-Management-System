const { RISK_CATEGORIES, getCategoryLabel, getStatusLabel, getStatusTone, getPriorityLabel, getPriorityTone, REPORTER_REVISION_STATUSES } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { canSupervisorSubmitAccomplishment } = require('../tickets');
const { supervisorAppLayout } = require('./supervisor-layout');
const { flashMessage } = require('./layout');
const { evidenceSection } = require('./evidence');
const { threadDiscussionSection } = require('./thread-discussion');
const { layoutNotifications } = require('../notifications');

function categoryOptions(selected) {
  return RISK_CATEGORIES.map(
    (c) =>
      `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${escapeHtml(c.label)}</option>`,
  ).join('');
}

function likelihoodOptions(selected) {
  return [1, 2, 3, 4, 5]
    .map((n) => `<option value="${n}" ${Number(selected) === n ? 'selected' : ''}>${n}</option>`)
    .join('');
}

function statusPill(status, overdue) {
  const tone = overdue ? 'bad' : getStatusTone(status);
  const overdueBadge = overdue
    ? ' <span class="pill pill--bad pill--overdue">Overdue</span>'
    : '';
  return `<span class="pill pill--${tone}">${escapeHtml(getStatusLabel(status))}</span>${overdueBadge}`;
}

function priorityPill(priority) {
  if (!priority) return '<span class="text-muted">—</span>';
  const tone = getPriorityTone(priority);
  return `<span class="pill pill--${tone} priority-pill">${escapeHtml(getPriorityLabel(priority))}</span>`;
}

function confidenceBadge(confidence) {
  if (confidence == null) return '—';
  const pct = Math.round(Number(confidence) * 100);
  const tone = pct >= 85 ? 'done' : pct >= 70 ? 'info' : 'warn';
  return `<span class="pill pill--${tone} confidence-pill">${pct}%</span>`;
}

function rmoReturnFeedbackBlock(notes, hint) {
  if (!notes?.trim()) return '';
  return revisionFeedbackBlock({
    title: 'RMO feedback',
    notes: notes.trim(),
    hint,
  });
}

function revisionFeedbackBlock({ title, notes, hint, ref, department, rejectedBy, rejectedAt }) {
  if (!notes?.trim()) return '';
  const meta = [
    rejectedBy ? `From: ${rejectedBy}` : '',
    department ? `Department: ${department}` : '',
    rejectedAt ? formatDate(rejectedAt) : '',
  ].filter(Boolean).join(' · ');
  return `<section class="rmo-feedback-alert revision-feedback-alert" role="alert" aria-live="polite">
    <div class="rmo-feedback-alert__icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 9V13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="12" cy="17" r="1.25" fill="currentColor"/>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="rmo-feedback-alert__body">
      <p class="rmo-feedback-alert__title">${escapeHtml(title)}</p>
      ${meta ? `<p class="rmo-feedback-alert__meta text-muted">${escapeHtml(meta)}</p>` : ''}
      <p class="rmo-feedback-alert__message">${escapeHtml(notes.trim())}</p>
      ${hint ? `<p class="rmo-feedback-alert__hint">${escapeHtml(hint)}</p>` : ''}
      ${ref ? `<p class="rmo-feedback-alert__actions"><a href="/supervisor/tickets/${escapeHtml(ref)}/edit" class="sup-btn-primary sup-btn-primary--sm">Revise and resubmit</a></p>` : ''}
    </div>
  </section>`;
}

function deptReturnFeedbackBlock(ticket) {
  const ownership = ticket?.ownership;
  if (ticket?.status !== 'ownership_rejected' || !ownership?.rejectionReason) return '';
  const rejectedBy = ownership.rejectedByPosition
    ? `${ownership.rejectedByName || 'Department head'} — ${ownership.rejectedByPosition}`
    : ownership.rejectedByName || 'Department head';
  return revisionFeedbackBlock({
    title: 'Returned by responsible department',
    notes: ownership.rejectionReason,
    hint: 'Update your report details or evidence, then resubmit. AI will re-analyze and route the ticket again.',
    ref: ticket.reference,
    department: ticket.department,
    rejectedBy,
    rejectedAt: ownership.rejectedAt,
  });
}

function overdueAlertBlock(ticket) {
  if (!ticket?.isOverdue) return '';
  const dueRaw = ticket.dueAt || ticket.deptActionPlan?.targetDate || ticket.mitigationDueAt;
  const dueLabel = dueRaw ? formatDate(dueRaw) : 'the target date';
  return `<section class="reporter-overdue-alert" role="alert" aria-live="polite">
    <div class="reporter-overdue-alert__icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
        <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="reporter-overdue-alert__body">
      <p class="reporter-overdue-alert__title">This ticket is overdue</p>
      <p class="reporter-overdue-alert__message">The department target date was <strong>${escapeHtml(dueLabel)}</strong>. Mitigation is still in progress past the agreed deadline.</p>
    </div>
  </section>`;
}

function deptAssignmentBlock(ticket) {
  const assignment = ticket?.departmentAssignment;
  const isDeptHandling = assignment
    || ticket?.isDeptAssigned
    || ['assigned', 'in_progress', 'pending_president', 'reopened'].includes(ticket?.status);
  if (!isDeptHandling) return '';

  const awaitingAcceptance = ticket?.status === 'assigned'
    || assignment?.state === 'pending'
    || (!assignment?.acceptedAt && ticket?.status === 'assigned');

  if (awaitingAcceptance) {
    return `<section class="dept-assignment-banner" role="note">
      <div class="dept-assignment-banner__head">
        <span class="dept-assignment-banner__badge">Department routing</span>
      </div>
      <p class="dept-assignment-banner__plan">Routed to <strong>${escapeHtml(assignment?.department || ticket.department || '—')}</strong>. Awaiting department head acceptance.</p>
    </section>`;
  }

  const owner = assignment?.ownerPosition
    ? `${assignment.ownerName || 'Department head'} — ${assignment.ownerPosition}`
    : assignment?.ownerName || 'Department head';
  const plan = ticket.deptActionPlan;
  const dueRaw = plan?.targetDate || ticket.dueAt;
  const dueLine = dueRaw
    ? `<dt>Target date</dt><dd class="${ticket.isOverdue ? 'cell--overdue' : ''}">${escapeHtml(formatDate(dueRaw))}${ticket.isOverdue ? ' <span class="pill pill--bad pill--overdue">Overdue</span>' : ''}</dd>`
    : '';
  return `<section class="dept-assignment-banner${ticket.isOverdue ? ' dept-assignment-banner--overdue' : ''}" role="note">
    <div class="dept-assignment-banner__head">
      <span class="dept-assignment-banner__badge">Department handling</span>
      ${ticket.isOverdue ? '<span class="pill pill--bad pill--overdue">Overdue</span>' : ''}
    </div>
    <dl class="detail-dl detail-dl--inline">
      <dt>Responsible department</dt><dd>${escapeHtml(assignment?.department || ticket.department || '—')}</dd>
      <dt>Accepted by</dt><dd>${escapeHtml(owner)}${assignment?.acceptedAt ? ` · ${escapeHtml(formatDate(assignment.acceptedAt))}` : ''}</dd>
      ${dueLine}
    </dl>
    ${plan?.summary ? `<p class="dept-assignment-banner__plan"><strong>Action plan:</strong> ${escapeHtml(plan.summary)}</p>` : ''}
    ${(plan?.steps || []).length ? `<ol class="dept-assignment-banner__steps">${plan.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : ''}
  </section>`;
}

function dueDateCell(ticket) {
  if (!ticket.dueAt) {
    return '<td class="nowrap text-muted">—</td>';
  }
  return `<td class="nowrap${ticket.isOverdue ? ' cell--overdue' : ''}">${escapeHtml(formatDate(ticket.dueAt))}${ticket.isOverdue ? ' <span class="pill pill--bad pill--overdue">Overdue</span>' : ''}</td>`;
}

function accomplishmentSubmittedBlock(accomplishment) {
  if (!accomplishment) return '';
  return `<section class="card card--accent accomplishment-report-card">
    <h2>Accomplishment report submitted</h2>
    <p class="text-muted">Submitted ${escapeHtml(formatDate(accomplishment.submittedAt))} · sent to your department head for review and closure. The Risk Governance Office is notified.</p>
    <div class="accomplishment-blocks">
      <div class="accomplishment-block">
        <h3 class="accomplishment-block__label">Implementation summary</h3>
        <p class="accomplishment-block__content">${escapeHtml(accomplishment.summary)}</p>
      </div>
      <div class="accomplishment-block">
        <h3 class="accomplishment-block__label">Outcomes and results</h3>
        <p class="accomplishment-block__content">${escapeHtml(accomplishment.outcomes)}</p>
      </div>
    </div>
  </section>`;
}

function accomplishmentPendingBlock(ticket) {
  const eligibility = ticket?.accomplishmentEligibility;
  if (!eligibility || eligibility.state === 'submitted' || eligibility.canSubmit) return '';
  return `<section class="card accomplishment-report-card accomplishment-report-card--pending" role="note">
    <h2>Accomplishment report</h2>
    <p class="text-muted">${escapeHtml(eligibility.reason || 'Not available yet for this ticket.')}</p>
  </section>`;
}

const KPI_ICONS = {
  tickets: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
  drafts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  action: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
  returned: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
  overdue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  closed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>`,
  done: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`,
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

/** Red asterisk for required field labels. */
function reqLabel(text, { required = false } = {}) {
  const star = required ? '<span class="req" aria-hidden="true">*</span>' : '';
  return `${escapeHtml(text)}${star}`;
}

function ticketTableRows(tickets, { linkPrefix = '/supervisor/tickets/', showActions = false, scoreColumn = false, showDueColumn = false } = {}) {
  return tickets
    .map((t) => {
      const isDraft = t.status === 'draft';
      let actions = `<a href="${linkPrefix}${escapeHtml(t.reference)}" class="btn-link">View</a>`;
      if (showActions && isDraft) {
        actions = `<div class="ticket-actions">
          <a href="/supervisor/tickets/${escapeHtml(t.reference)}/edit" class="btn-link">Edit</a>
          <form method="post" action="/supervisor/tickets/${escapeHtml(t.reference)}/delete" class="inline-form"
            onsubmit="return confirm('Delete draft ${escapeHtml(t.reference)}? This cannot be undone.');">
            <button type="submit" class="btn-link btn-link--danger">Delete</button>
          </form>
        </div>`;
      } else if (showActions && REPORTER_REVISION_STATUSES.includes(t.status)) {
        actions = `<a href="/supervisor/tickets/${escapeHtml(t.reference)}/edit" class="btn-link">Revise</a>`;
      } else if (showActions && !isDraft) {
        actions = `<a href="${linkPrefix}${escapeHtml(t.reference)}" class="btn-link">View</a>`;
      }
      const metricCell = scoreColumn
        ? `<td class="nowrap mono">${t.riskScore || t.likelihood * t.impact}</td>`
        : `<td class="nowrap">${t.evidenceCount || 0}</td>`;
      return `<tr class="${t.isOverdue ? 'ticket-row--overdue' : ''}${t.isDeptAssigned ? ' ticket-row--dept-assigned' : ''}">
        <td class="mono nowrap"><a href="${linkPrefix}${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel)}</td>
        <td>${statusPill(t.status, t.isOverdue)}</td>
        ${showDueColumn ? dueDateCell(t) : ''}
        ${metricCell}
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
        ${showActions ? `<td class="col-actions">${actions}</td>` : ''}
      </tr>`;
    })
    .join('');
}

function supervisorPage(title, user, activeNav, body, stats, notifications) {
  return supervisorAppLayout({
    title,
    user,
    activeNav,
    body,
    stats,
    notifications: notifications || layoutNotifications(user),
  });
}

function renderExistingAttachments(ticket, { inputPrefix = 'remove' } = {}) {
  const items = ticket?.evidence || [];
  if (!items.length) return '';
  const rows = items
    .map((e) => {
      const sizeMb = e.size ? ` · ${(e.size / 1024 / 1024).toFixed(2)} MB` : '';
      const link = e.storageKey
        ? `<a href="/supervisor/attachments/${escapeHtml(e.id)}" target="_blank" rel="noopener">${escapeHtml(e.name || e.originalName)}</a>`
        : escapeHtml(e.name || '—');
      const remove = e.id
        ? `<label class="attach-remove"><input type="checkbox" name="removeAttachmentIds" value="${escapeHtml(e.id)}"> Remove</label>`
        : '';
      return `<li class="upload-preview-item upload-preview-item--saved">
        <span class="upload-name">${link}</span>
        <span class="upload-meta">${escapeHtml(formatDate(e.uploadedAt))}${sizeMb}</span>
        ${remove}
      </li>`;
    })
    .join('');
  return `<ul class="upload-preview upload-preview--saved">${rows}</ul>`;
}

function supervisorOverviewPage(user, stats, flash, recentTickets = []) {
  const showDueColumn = stats.overdue > 0 || recentTickets.some((t) => t.dueAt);
  const recentRows = ticketTableRows(recentTickets.slice(0, 5), { showDueColumn });
  const dueHeader = showDueColumn ? '<th>Due date</th>' : '';
  const emptyColspan = showDueColumn ? 7 : 6;
  const body = `
    ${flashMessage(flash)}
    <div class="sup-page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="sup-page-desc">Report organizational risks, track AI-routed tickets, and monitor status from submission through closure.</p>
      </div>
      <a href="/supervisor/tickets/new" class="sup-btn-primary">+ Create new ticket</a>
    </div>
    <div class="routing-flow-banner" role="note">
      <strong>Automatic routing:</strong> Submit your report → AI analyzes <strong>incident details</strong> (what / why / where / how) → Responsible department is assigned. Your reporting unit does not affect assignment.
    </div>
    <div class="sup-kpi-grid">
      ${kpiCard('/supervisor/tickets', KPI_ICONS.tickets, stats.total, 'My tickets')}
      ${kpiCard('/supervisor/drafts', KPI_ICONS.drafts, stats.drafts, 'Draft reports')}
      ${kpiCard('/supervisor/submitted', KPI_ICONS.tickets, stats.submitted, 'Submitted reports')}
      ${kpiCard('/supervisor/returned', KPI_ICONS.returned, stats.returned, 'Returned reports', stats.returned > 0 ? 'sup-kpi--warn' : '')}
      ${kpiCard('/supervisor/overdue', KPI_ICONS.overdue, stats.overdue, 'Overdue', stats.overdue > 0 ? 'sup-kpi--warn' : '')}
      ${kpiCard('/supervisor/tickets?filter=closed', KPI_ICONS.closed, stats.closed, 'Closed')}
      ${kpiCard('/supervisor/accomplishments', KPI_ICONS.done, stats.accomplishments, 'Accomplishments')}
    </div>
    <section class="sup-card sup-card--table">
      <div class="sup-card__head">
        <h2>Recent tickets</h2>
        <a href="/supervisor/tickets" class="sup-link">View all</a>
      </div>
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              ${dueHeader}
              <th>Files</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${recentRows || `<tr><td colspan="${emptyColspan}" class="empty">No tickets yet. <a href="/supervisor/tickets/new">Create your first report</a>.</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

  return supervisorPage('Dashboard', user, 'overview', body, stats);
}

function ticketsListPage(user, tickets, flash, { filter, error, stats = {} } = {}) {
  const isClosedStatus = (t) => ['closed', 'resolved'].includes(t.status);
  const filtered =
    filter === 'draft'
      ? tickets.filter((t) => t.status === 'draft')
      : filter === 'returned'
        ? tickets.filter((t) => REPORTER_REVISION_STATUSES.includes(t.status))
        : filter === 'overdue'
          ? tickets.filter((t) => t.isOverdue)
          : filter === 'closed'
            ? tickets.filter(isClosedStatus)
            : filter === 'submitted'
              ? tickets.filter((t) => t.status !== 'draft')
              : tickets;
  const draftCount = tickets.filter((t) => t.status === 'draft').length;
  const returnedCount = tickets.filter((t) => REPORTER_REVISION_STATUSES.includes(t.status)).length;
  const closedCount = tickets.filter(isClosedStatus).length;
  const overdueCount = tickets.filter((t) => t.isOverdue).length;
  const pageTitle = filter === 'overdue' ? 'Overdue tickets' : 'My tickets';
  const pageDesc = filter === 'overdue'
    ? 'Tickets past the department or RMO target date. These need attention from the handling department.'
    : 'All risk tickets you have reported — from drafts through closure. Responsible department is assigned by AI on submit.';
  const showDueColumn = filter === 'overdue' || overdueCount > 0;
  const dueHeader = showDueColumn ? '<th>Due date</th>' : '';
  const tableColspan = 6 + (showDueColumn ? 1 : 0) + 1;
  const rows = ticketTableRows(filtered, { showActions: true, showDueColumn });
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(decodeURIComponent(error), 'error') : ''}
    <div class="sup-page-head">
      <div>
        <h1>${escapeHtml(pageTitle)}</h1>
        <p class="sup-page-desc">${escapeHtml(pageDesc)}</p>
      </div>
      <a href="/supervisor/tickets/new" class="sup-btn-primary">+ Create new ticket</a>
    </div>
    <div class="ticket-filters console-quick-actions">
      <a href="/supervisor/tickets" class="filter-pill ${!filter ? 'active' : ''}">All <span class="filter-pill__count">${tickets.length}</span></a>
      <a href="/supervisor/tickets?filter=draft" class="filter-pill ${filter === 'draft' ? 'active' : ''}">Drafts <span class="filter-pill__count">${draftCount}</span></a>
      <a href="/supervisor/tickets?filter=returned" class="filter-pill ${filter === 'returned' ? 'active' : ''}">Returned reports <span class="filter-pill__count">${returnedCount}</span></a>
      <a href="/supervisor/overdue" class="filter-pill filter-pill--warn ${filter === 'overdue' ? 'active' : ''}">Overdue <span class="filter-pill__count">${overdueCount}</span></a>
      <a href="/supervisor/tickets?filter=submitted" class="filter-pill ${filter === 'submitted' ? 'active' : ''}">Submitted <span class="filter-pill__count">${tickets.length - draftCount}</span></a>
      <a href="/supervisor/tickets?filter=closed" class="filter-pill ${filter === 'closed' ? 'active' : ''}">Closed <span class="filter-pill__count">${closedCount}</span></a>
    </div>
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table tickets-table tickets-table--crud">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              ${dueHeader}
              <th>Files</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${tableColspan}" class="empty">${filter === 'overdue' ? 'No overdue tickets.' : 'No tickets yet. <a href="/supervisor/tickets/new">Create your first risk report</a>.'}</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

  return supervisorPage(pageTitle, user, 'tickets', body, stats);
}

function fiveW1HFields(ticket, editable) {
  const w = ticket?.fiveW1H || {};
  const fields = [
    { key: 'what', label: 'What happened?', required: true },
    { key: 'why', label: 'Why did it happen?', required: true },
    { key: 'where', label: 'Where did it occur?', required: false },
    { key: 'when', label: 'When did it occur?', required: false },
    { key: 'who', label: 'Who was involved?', required: false },
    { key: 'how', label: 'How was it discovered?', required: false },
  ];
  if (!editable) {
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
  return `<div class="w1h-grid">
    ${fields
      .map(
        (f) => `<div class="field">
          <label for="${f.key}">${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
          <textarea id="${f.key}" name="${f.key}" rows="2" ${f.required ? 'required' : ''}>${escapeHtml(w[f.key] || '')}</textarea>
        </div>`,
      )
      .join('')}
  </div>`;
}

function timelineSection(timeline = []) {
  if (!timeline.length) {
    return `<section class="sup-card sup-card--history">
      <h2>Ticket timeline</h2>
      <p class="text-muted">Lifecycle events will appear here after submission.</p>
    </section>`;
  }
  const items = timeline
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
    .join('');
  const latest = timeline[timeline.length - 1];
  const countLabel = `${timeline.length} event${timeline.length === 1 ? '' : 's'}`;
  const latestLabel = latest
    ? `Latest: ${latest.action} · ${formatDate(latest.at)}`
    : '';
  return `<section class="sup-card sup-card--history ticket-timeline-panel" data-timeline-panel>
    <button type="button" class="ticket-timeline-panel__toggle" aria-expanded="false" aria-controls="ticketTimelineBody">
      <span class="ticket-timeline-panel__head">
        <span class="ticket-timeline-panel__title">Ticket timeline</span>
        <span class="ticket-timeline-panel__count">${escapeHtml(countLabel)}</span>
      </span>
      <span class="ticket-timeline-panel__preview">${escapeHtml(latestLabel)}</span>
      <span class="ticket-timeline-panel__chevron" aria-hidden="true"></span>
    </button>
    <div class="ticket-timeline-panel__body" id="ticketTimelineBody" hidden>
      <p class="section-hint">Complete lifecycle from submission through routing, review, and closure.</p>
      <ol class="ticket-timeline">${items}</ol>
    </div>
    <script>
      (function () {
        var panel = document.querySelector('[data-timeline-panel]');
        if (!panel) return;
        var btn = panel.querySelector('.ticket-timeline-panel__toggle');
        var body = panel.querySelector('.ticket-timeline-panel__body');
        if (!btn || !body) return;
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          var nextOpen = !open;
          btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
          body.hidden = !nextOpen;
          panel.classList.toggle('is-open', nextOpen);
        });
      })();
    </script>
  </section>`;
}

function threadCommentsSection(ticket, ref, user) {
  return threadDiscussionSection(ticket, ref, {
    title: 'Discussion thread',
    hint: '',
    postAction: `/supervisor/tickets/${ref}/comment`,
    editAction: `/supervisor/tickets/${ref}/comment/edit`,
    reactAction: `/supervisor/tickets/${ref}/comment/react`,
    canPost: ticket.status !== 'draft',
    canReact: ticket.status !== 'draft',
    canEditOwn: true,
    currentUsername: user?.username,
  });
}

function aiAnalysisPanel(ticket, { preview = false } = {}) {
  const ai = ticket?.ai || {};
  const riskCategoryLabel = getCategoryLabel(ai.riskCategory || ticket?.category);
  const riskLevel = ai.riskLevel || riskLevelFromSeverityLocal(
    ticket?.likelihood && ticket?.impact ? Math.round((ticket.likelihood + ticket.impact) / 2) : 2,
  );
  const dept = ticket.department || ai.responsibleDepartment || '—';
  const priority = ticket.priority || ai.priority;

  return `<section class="enterprise-card enterprise-card--ai ai-panel">
    <div class="enterprise-section-head enterprise-section-head--tight">
      <h2>${preview ? 'AI PREVIEW' : 'AI CLASSIFICATION &amp; ROUTING'}</h2>
      <div class="ai-badge">
        <span class="ai-badge__dot" aria-hidden="true"></span>
        <span>${preview ? 'Preview' : 'Post-submission analysis'}</span>
      </div>
    </div>
    <div class="ai-preview-grid">
      <div class="ai-summary">
        <div class="ai-summary-head"><strong>Incident summary</strong></div>
        <p>${escapeHtml(ai.summary || '—')}</p>
        ${ai.suggestedMitigation ? `<div class="ai-mitigation-suggestion"><strong>Suggested initial mitigation</strong><p>${escapeHtml(ai.suggestedMitigation)}</p></div>` : ''}
      </div>
      <div class="ai-analysis">
        <div class="ai-analysis-card">
          <div class="ai-analysis-row"><span class="ai-analysis-label">Risk category</span><span class="ai-analysis-value">${escapeHtml(riskCategoryLabel)}</span></div>
          <div class="ai-analysis-row"><span class="ai-analysis-label">Risk level</span><span>${riskLevelBadge(riskLevel)}</span></div>
          <div class="ai-analysis-row"><span class="ai-analysis-label">Responsible department</span><span class="ai-analysis-value ai-dept-value">${escapeHtml(dept)}</span></div>
          <div class="ai-analysis-row"><span class="ai-analysis-label">Priority</span><span>${priorityPill(priority)}</span></div>
          <div class="ai-analysis-row"><span class="ai-analysis-label">Confidence</span><span>${confidenceBadge(ai.confidence)}</span></div>
          <div class="ai-analysis-row"><span class="ai-analysis-label">Likelihood × Impact</span><span class="ai-analysis-value">${ai.likelihood ?? '—'}/5 × ${ai.impact ?? '—'}/5</span></div>
        </div>
      </div>
    </div>
    ${!preview && ticket.routedAt ? `<p class="routing-confirmation text-muted">Automatically routed to <strong>${escapeHtml(dept)}</strong> on ${escapeHtml(formatDate(ticket.routedAt))}.</p>` : ''}
    <p class="text-muted routing-note routing-note--basis">Responsible department is assigned from <strong>risk title</strong> and <strong>incident details</strong> (what / why / where / how). Your reporting unit and who was involved are not used.</p>
    ${preview ? '<p class="text-muted routing-note">Final department assignment is confirmed when you submit the ticket.</p>' : ''}
  </section>`;
}

function ticketFormPage(user, ticket, { mode, flash, error, stats = {} }) {
  const t = ticket || {};
  const ref = t.reference || '';

  const aiBlock = t.ai || t.department ? aiAnalysisPanel(t) : '';

  const deptRejectionBlock = deptReturnFeedbackBlock(t);
  const overdueBlock = overdueAlertBlock(t);
  const deptHandlingBlock = deptAssignmentBlock(t);

  const officerBlock =
    t.status === 'returned' && t.officerNotes
      ? rmoReturnFeedbackBlock(
          t.officerNotes,
          'Your report was returned for revision. Use Revise from My tickets to update and resubmit.',
        )
      : t.officerNotes && ['in_mitigation', 'reopened', 'pending_audit', 'closed', 'resolved'].includes(t.status)
        ? `<section class="card card--accent">
            <h2>Approved mitigation plan${t.mitigationPlanVersion ? ` <span class="text-muted">(v${t.mitigationPlanVersion})</span>` : ''}</h2>
            <p>${escapeHtml(t.officerNotes)}</p>
            ${t.mitigationDueAt ? `<p class="text-muted">Implementation due: ${escapeHtml(formatDate(t.mitigationDueAt))}</p>` : ''}
          </section>`
        : '';

  const supervisorFeedbackBlock = t.supervisorFeedback
    ? `<section class="card">
        <h2>RMO implementation feedback</h2>
        <p>${escapeHtml(t.supervisorFeedback)}</p>
      </section>`
    : '';

  const dueDetailRow = t.dueAt
    ? `<dt>Target date</dt><dd class="${t.isOverdue ? 'cell--overdue' : ''}">${escapeHtml(formatDate(t.dueAt))}${t.isOverdue ? ' <span class="pill pill--bad pill--overdue">Overdue</span>' : ''}</dd>`
    : '';

  const formSection = `<section class="card">
        <h2>Risk details</h2>
        <dl class="detail-dl">
          <dt>Title</dt><dd>${escapeHtml(t.title)}</dd>
          <dt>Reporting unit</dt><dd>${escapeHtml(t.reporterDepartment || '—')} <span class="text-muted">(not used for AI routing)</span></dd>
          <dt>Responsible department</dt><dd>${escapeHtml(t.department || t.ai?.responsibleDepartment || 'Pending AI routing')}</dd>
          <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
          <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
          <dt>Priority</dt><dd>${priorityPill(t.priority || t.ai?.priority)}</dd>
          <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
          ${dueDetailRow}
        </dl>
        <p style="margin-top:1rem">${escapeHtml(t.description || '—')}</p>
      </section>
      <section class="card">
        <h2>5W1H</h2>
        ${fiveW1HFields(t, false)}
      </section>`;

  const evidenceSectionHtml = evidenceSection(t, {
    attachmentBasePath: '/supervisor/attachments',
    theme: 'console',
    interactive: true,
  });

  const showAccomplishment = canSupervisorSubmitAccomplishment(t);
  const accomplishmentSubmitted = accomplishmentSubmittedBlock(t.accomplishment);
  const accomplishmentPending = accomplishmentPendingBlock(t);
  const existingEvidenceCount = (t.evidence || []).filter((e) => e.storageKey || !e.legacy).length;

  const addEvidenceForm =
    ['under_review', 'in_mitigation', 'in_progress', 'returned', 'pending_audit', 'reopened'].includes(t.status)
      ? `<section class="card${showAccomplishment ? ' card--required-evidence' : ''}">
          <h2>Add evidence${showAccomplishment ? ' <span class="req" aria-hidden="true">*</span>' : ''}</h2>
          <p class="text-muted">${
            showAccomplishment
              ? 'Required — upload at least one supporting file (PDF, PNG, or JPG) before submitting your accomplishment report.'
              : 'Upload PDF, PNG, or JPG files (max 20MB each).'
          }</p>
          <form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/evidence" class="stack-form" id="addEvidenceForm" enctype="multipart/form-data" novalidate>
            <div class="upload-zone" id="addEvDropzone" role="button" tabindex="0" aria-label="Upload evidence files">
              <div class="upload-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 16V4" stroke="#476C9B" stroke-width="2" stroke-linecap="round"/>
                  <path d="M7 9L12 4L17 9" stroke="#476C9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M20 16.5C19.2 18.7 17.2 20 15 20H9C6.8 20 4.8 18.7 4 16.5" stroke="#476C9B" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <p class="upload-title">Drag and drop files here</p>
              <p class="upload-sub">Accepted types: PDF, PNG, JPG (max 20MB)</p>
              <button type="button" class="btn-outline btn-upload" id="addEvBrowseBtn">Browse files</button>
              <input id="addEvFileInput" name="attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style="display:none">
            </div>
            <div class="upload-pending-wrap" id="addEvPending" hidden>
              <div class="upload-pending-head">
                <span class="upload-pending-badge" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
                <span class="upload-pending-label">New files ready to upload</span>
              </div>
              <ul class="upload-preview upload-preview--pending" id="addEvPreview"></ul>
            </div>
            <div class="upload-message" id="addEvMessage" role="status"></div>
            <button type="submit" class="btn-primary btn-primary--auto" id="addEvSubmitBtn" disabled>Upload files</button>
          </form>
          <script>
            (function () {
              const form = document.getElementById('addEvidenceForm');
              if (!form) return;
              const dropzone = document.getElementById('addEvDropzone');
              const browseBtn = document.getElementById('addEvBrowseBtn');
              const fileInput = document.getElementById('addEvFileInput');
              const pending = document.getElementById('addEvPending');
              const preview = document.getElementById('addEvPreview');
              const message = document.getElementById('addEvMessage');
              const submitBtn = document.getElementById('addEvSubmitBtn');
              const allowedExt = new Set(['pdf', 'png', 'jpg', 'jpeg']);
              let selectedFiles = [];

              function syncInput() {
                const dt = new DataTransfer();
                selectedFiles.forEach((f) => dt.items.add(f));
                fileInput.files = dt.files;
              }

              function setMessage(msg, type) {
                message.textContent = msg || '';
                message.className = 'upload-message';
                if (type === 'error') message.classList.add('upload-message--error');
                if (type === 'ok') message.classList.add('upload-message--ok');
              }

              function notify(msg, type) {
                setMessage(msg, type);
                if (window.showAppToast) window.showAppToast(msg, type === 'error' ? 'error' : 'success');
              }

              function render() {
                preview.innerHTML = '';
                if (!selectedFiles.length) {
                  pending.hidden = true;
                  submitBtn.disabled = true;
                  return;
                }
                pending.hidden = false;
                submitBtn.disabled = false;
                selectedFiles.forEach((f, idx) => {
                  const li = document.createElement('li');
                  li.className = 'upload-preview-item upload-preview-item--pending';
                  li.innerHTML =
                    '<span class="upload-pending-item-icon" aria-hidden="true">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                    '<path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
                    '</svg></span>' +
                    '<span class="upload-name"></span>' +
                    '<span class="upload-meta"></span>' +
                    '<button type="button" class="upload-remove-btn">Remove</button>';
                  li.querySelector('.upload-name').textContent = f.name;
                  li.querySelector('.upload-meta').textContent = (f.size / 1024 / 1024).toFixed(2) + ' MB · Ready to upload';
                  li.querySelector('.upload-remove-btn').addEventListener('click', () => {
                    selectedFiles.splice(idx, 1);
                    syncInput();
                    render();
                    if (!selectedFiles.length) setMessage('', null);
                  });
                  preview.appendChild(li);
                });
              }

              function validate(file) {
                const parts = String(file.name || '').toLowerCase().split('.');
                const ext = parts.length > 1 ? parts[parts.length - 1] : '';
                if (!allowedExt.has(ext)) return { ok: false, reason: 'Unsupported file type: ' + ext.toUpperCase() };
                if (file.size > 20 * 1024 * 1024) return { ok: false, reason: 'File exceeds 20MB: ' + file.name };
                return { ok: true };
              }

              function addFiles(files) {
                const arr = Array.from(files || []);
                const before = selectedFiles.length;
                const names = [];
                for (const f of arr) {
                  const v = validate(f);
                  if (!v.ok) { notify(v.reason, 'error'); continue; }
                  selectedFiles.push(f);
                  names.push(f.name);
                }
                selectedFiles = selectedFiles.slice(0, 10);
                const added = selectedFiles.length - before;
                syncInput();
                render();
                if (added > 0) {
                  notify(added === 1 ? '"' + names[names.length - 1] + '" added — ready to upload' : added + ' file(s) added — ready to upload', 'ok');
                  dropzone.classList.add('upload-zone--success');
                  setTimeout(() => dropzone.classList.remove('upload-zone--success'), 2000);
                }
              }

              browseBtn.addEventListener('click', () => fileInput.click());
              dropzone.addEventListener('click', (e) => { if (e.target === dropzone) fileInput.click(); });
              dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
              fileInput.addEventListener('change', (e) => { addFiles(e.target.files); });
              ['dragenter', 'dragover'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); }));
              ['dragleave', 'drop'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
              dropzone.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

              form.addEventListener('submit', (e) => {
                if (!selectedFiles.length) {
                  e.preventDefault();
                  notify('Select at least one file to upload.', 'error');
                  return;
                }
                syncInput();
              });
            })();
          </script>
        </section>`
      : '';

  const accomplishmentForm = showAccomplishment
      ? `<section class="card card--accent accomplishment-report-card">
          <h2>Submit accomplishment report</h2>
          <p class="text-muted">Document mitigation implementation and outcomes after completing the department action plan. Upload supporting evidence, then submit for department head review and closure.</p>
          ${t.deptActionPlan?.summary ? `<p class="accomplishment-plan-ref"><strong>Department action plan:</strong> ${escapeHtml(t.deptActionPlan.summary)}</p>` : ''}
          <form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/accomplishment" class="stack-form" id="accomplishmentForm" enctype="multipart/form-data" novalidate>
            <div class="field field--required">
              <label for="summary">Implementation summary *</label>
              <textarea id="summary" name="summary" rows="3" required></textarea>
            </div>
            <div class="field field--required">
              <label for="outcomes">Outcomes and results *</label>
              <textarea id="outcomes" name="outcomes" rows="3" required></textarea>
            </div>
            <div class="field field--required" id="accEvidenceField" data-required="evidence">
              <label for="acc_attachments">Resolution evidence *</label>
              <p class="field-hint">Upload at least one supporting file (PDF, PNG, or JPG, max 20MB each). You may also use files already attached above.</p>
              <div class="upload-evidence-status ${existingEvidenceCount > 0 ? 'upload-evidence-status--ok' : 'upload-evidence-status--missing'}" id="accEvidenceStatus" role="status">
                ${existingEvidenceCount > 0 ? `${existingEvidenceCount} file(s) already attached to this ticket.` : 'No evidence attached yet. Upload at least one file to continue.'}
              </div>
              <input id="acc_attachments" name="attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg"${existingEvidenceCount === 0 ? ' required' : ''}>
            </div>
            <button type="submit" class="btn-primary btn-primary--auto" id="accomplishmentSubmitBtn"${existingEvidenceCount === 0 ? ' disabled' : ''}>Submit accomplishment</button>
          </form>
          <script>
            (function () {
              const form = document.getElementById('accomplishmentForm');
              if (!form) return;
              const savedCount = ${existingEvidenceCount};
              const fileInput = document.getElementById('acc_attachments');
              const statusEl = document.getElementById('accEvidenceStatus');
              const evidenceField = document.getElementById('accEvidenceField');
              const submitBtn = document.getElementById('accomplishmentSubmitBtn');

              function updateState() {
                const newCount = fileInput && fileInput.files ? fileInput.files.length : 0;
                const hasEvidence = savedCount > 0 || newCount > 0;
                if (statusEl) {
                  statusEl.className = 'upload-evidence-status ' + (hasEvidence ? 'upload-evidence-status--ok' : 'upload-evidence-status--missing');
                  if (newCount > 0) {
                    statusEl.textContent = newCount + ' new file(s) selected' + (savedCount > 0 ? ' (' + savedCount + ' already on ticket).' : ' — ready to submit.');
                  } else if (savedCount > 0) {
                    statusEl.textContent = savedCount + ' file(s) already attached to this ticket.';
                  } else {
                    statusEl.textContent = 'No evidence attached yet. Upload at least one file to continue.';
                  }
                }
                if (evidenceField) evidenceField.classList.toggle('field--invalid', !hasEvidence);
                if (submitBtn) submitBtn.disabled = !hasEvidence;
              }

              form.addEventListener('submit', function (e) {
                const newCount = fileInput && fileInput.files ? fileInput.files.length : 0;
                if (savedCount === 0 && newCount === 0) {
                  e.preventDefault();
                  updateState();
                  if (window.showAppToast) {
                    window.showAppToast('Upload at least one evidence file before submitting your accomplishment report.', 'error');
                  }
                }
              });

              if (fileInput) fileInput.addEventListener('change', updateState);
              updateState();
            })();
          </script>
        </section>`
      : '';

  const finalDecisionBlock = t.finalDecision
    ? `<section class="sup-card sup-card--accent">
        <h2>Final decision</h2>
        <p><strong>${escapeHtml(t.finalDecision.decision || 'Closed')}</strong></p>
        <p>${escapeHtml(t.finalDecision.summary || t.finalDecision.notes || '')}</p>
        <p class="text-muted">By ${escapeHtml(t.finalDecision.authorName || 'Approving authority')} · ${escapeHtml(formatDate(t.finalDecision.at))}</p>
      </section>`
    : '';
  const closedNoDecision = ['closed', 'resolved'].includes(t.status) && !t.finalDecision
    ? `<section class="sup-card"><h2>Final decision</h2><p class="text-muted">This ticket has been closed. Final decision details will appear here when recorded by the approving authority.</p></section>`
    : '';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head page-head--row${t.isOverdue ? ' page-head--overdue' : ''}${t.isDeptAssigned ? ' page-head--dept-assigned' : ''}">
      <div>
        <h1>${escapeHtml(t.title || 'Ticket')}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)} ${t.priority || t.ai?.priority ? `· ${priorityPill(t.priority || t.ai?.priority)}` : ''}${t.dueAt ? ` · <span class="ticket-due-label${t.isOverdue ? ' ticket-due-label--overdue' : ''}">Due ${escapeHtml(formatDate(t.dueAt))}</span>` : ''}</p>
      </div>
      <a href="/supervisor/tickets" class="btn-outline">Back to tickets</a>
      ${REPORTER_REVISION_STATUSES.includes(t.status) ? `<a href="/supervisor/tickets/${escapeHtml(ref)}/edit" class="sup-btn-primary">Revise and resubmit</a>` : ''}
    </div>
    ${overdueBlock}
    ${deptRejectionBlock}
    ${deptHandlingBlock}
    ${officerBlock}
    ${formSection}
    ${aiBlock}
    ${supervisorFeedbackBlock}
    ${evidenceSectionHtml}
    ${addEvidenceForm}
    ${accomplishmentSubmitted}
    ${accomplishmentPending}
    ${accomplishmentForm}
    ${timelineSection(t.timeline || [])}
    ${threadCommentsSection(t, ref, user)}
    ${finalDecisionBlock || closedNoDecision}`;

  return supervisorPage(ref, user, 'tickets', body, stats);
}

function progressSteps(step) {
  const mk = (id, label) => {
    const active = step === id;
    const cls = active ? 'progress-step progress-step--active' : 'progress-step';
    return `<div class="${cls}">
      <span class="progress-num">${id}</span>
      <span class="progress-label">${escapeHtml(label)}</span>
    </div>`;
  };
  return `<div class="progress-steps">
    ${mk(1, 'Risk information')}
    ${mk(2, 'AI preview')}
  </div>`;
}

function riskLevelBadge(riskLevel) {
  const id = riskLevel?.id || 'low';
  const label = riskLevel?.label || 'Low';
  return `<span class="risk-badge risk-badge--${escapeHtml(id)}">${escapeHtml(label)}</span>`;
}

function riskLevelFromSeverityLocal(severity1to5) {
  const sev = Math.max(1, Math.min(5, Number(severity1to5)));
  if (sev <= 2) return { id: 'low', label: 'Low' };
  if (sev === 3) return { id: 'moderate', label: 'Moderate' };
  if (sev === 4) return { id: 'high', label: 'High' };
  return { id: 'critical', label: 'Extreme/Critical' };
}

function newRiskReportStep1Page(user, ticketRef, { flash, error, ticket = null, mode = 'new', stats = {} } = {}) {
  const isRevise = mode === 'revise' && REPORTER_REVISION_STATUSES.includes(ticket?.status);
  const isDeptReturn = ticket?.status === 'ownership_rejected';
  const isEdit = (mode === 'edit' && ticket?.status === 'draft') || isRevise;
  const t = ticket || {};
  const w = t.fiveW1H || {};
  const formAction = isEdit
    ? `/supervisor/tickets/${escapeHtml(t.reference)}/edit`
    : '/supervisor/tickets/new/preview';
  const pageTitle = isRevise ? (isDeptReturn ? 'REVISE RETURNED REPORT' : 'REVISE RISK REPORT') : isEdit ? 'EDIT DRAFT REPORT' : 'NEW RISK REPORT';
  const pageDesc = isRevise
    ? isDeptReturn
      ? 'The responsible department returned this ticket. Update the details and evidence, then resubmit for AI routing.'
      : 'Your report was returned by the Risk Management Unit. Update the details and evidence, then resubmit.'
    : isEdit
      ? 'Update your draft report. Only drafts can be edited or deleted before submission.'
      : 'Submit a structured incident report. AI assigns the handling department from the risk title and incident details — your profile department is not used.';
  const reporterDept = user.department || t.reporterDepartment || '';
  const reportingUnitNote = reporterDept
    ? `<p class="reporting-unit-note" role="note">Reporting as <strong>${escapeHtml(reporterDept)}</strong> — this is recorded for audit only and does <strong>not</strong> affect AI department assignment.</p>`
    : '';
  const existingAttachments = isEdit ? renderExistingAttachments(t) : '';
  const rmoFeedbackBlock = isRevise && ticket?.status === 'returned'
    ? rmoReturnFeedbackBlock(
        t.officerNotes,
        'Address the feedback below, then continue to the AI preview and resubmit.',
      )
    : '';
  const deptFeedbackBlock = isRevise && isDeptReturn ? deptReturnFeedbackBlock(t) : '';
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="enterprise-module">
      <div class="enterprise-top">
        ${progressSteps(1)}
        <div class="enterprise-title">
          <h1>${escapeHtml(pageTitle)}</h1>
          <p class="page-desc">${escapeHtml(pageDesc)}</p>
          <p class="required-legend"><span class="req">*</span> Required field</p>
        </div>
      </div>
      ${rmoFeedbackBlock}
      ${deptFeedbackBlock}
      ${reportingUnitNote}

      <form method="post" action="${formAction}" class="enterprise-form" id="riskForm" enctype="multipart/form-data" novalidate>
        <input type="hidden" name="referenceOverride" value="${escapeHtml(isEdit ? t.reference : ticketRef)}">

        <section class="enterprise-card">
          <div class="enterprise-section-head">
            <h2>RISK INFORMATION</h2>
            <div class="ticket-ref">
              <span class="ticket-ref__label">Auto-generated Ticket Number</span>
              <span class="ticket-ref__value">${escapeHtml(isEdit ? t.reference : ticketRef)}</span>
            </div>
          </div>

          <div class="enterprise-grid enterprise-grid--2">
            <div class="field field--required" data-required="title">
              <label for="title">${reqLabel('Risk Title', { required: true })}</label>
              <input id="title" name="title" type="text" required aria-required="true" placeholder="Short, specific risk title (e.g. Financial fraud in vendor payments)" class="enterprise-input" value="${escapeHtml(t.title || '')}">
              <p class="field-hint">Used by AI routing together with incident details below.</p>
            </div>
            <div class="field field--required" data-required="location">
              <label for="location">${reqLabel('Incident location', { required: true })}</label>
              <input id="location" name="location" type="text" required aria-required="true" placeholder="Building / unit / site" class="enterprise-input" value="${escapeHtml(t.location || '')}">
            </div>
          </div>
        </section>

        <section class="enterprise-card">
          <div class="enterprise-section-head">
            <h2>INCIDENT DETAILS</h2>
            <p class="section-hint">AI department assignment uses these fields plus the risk title. Who was involved is not used for routing.</p>
          </div>

          <div class="incident-grid">
            <div class="field field--required" data-required="what">
              <label for="what">${reqLabel('What happened?', { required: true })}</label>
              <textarea id="what" name="what" rows="4" required aria-required="true" placeholder="Describe the incident/event.">${escapeHtml(w.what || '')}</textarea>
            </div>
            <div class="field field--required" data-required="why">
              <label for="why">${reqLabel('Why did it happen?', { required: true })}</label>
              <textarea id="why" name="why" rows="4" required aria-required="true" placeholder="State the root cause(s) or contributing factors.">${escapeHtml(w.why || '')}</textarea>
            </div>
            <div class="field">
              <label for="where">Where did it occur?</label>
              <textarea id="where" name="where" rows="3" placeholder="Department area, system, or location details.">${escapeHtml(w.where || '')}</textarea>
            </div>
            <div class="field">
              <label for="when">When did it occur?</label>
              <textarea id="when" name="when" rows="3" placeholder="Date/time or period (approx. is okay).">${escapeHtml(w.when || '')}</textarea>
            </div>
            <div class="field">
              <label for="who">Who was involved?</label>
              <textarea id="who" name="who" rows="3" placeholder="Teams, roles, vendors, or affected persons.">${escapeHtml(w.who || '')}</textarea>
            </div>
            <div class="field">
              <label for="how">How was it discovered?</label>
              <textarea id="how" name="how" rows="3" placeholder="How the issue was identified/detected.">${escapeHtml(w.how || '')}</textarea>
            </div>
          </div>
        </section>

        <section class="enterprise-card" id="evidenceSection" data-required="evidence">
          <div class="enterprise-section-head">
            <h2>EVIDENCE REQUIREMENTS <span class="req" aria-hidden="true">*</span></h2>
            <p class="section-hint">Upload at least one supporting file (PDF, PNG, or JPG). This section is required.</p>
          </div>

          <div class="upload-zone" id="dropzone">
            <div class="upload-icon" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 16V4" stroke="#476C9B" stroke-width="2" stroke-linecap="round"/>
                <path d="M7 9L12 4L17 9" stroke="#476C9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M20 16.5C19.2 18.7 17.2 20 15 20H9C6.8 20 4.8 18.7 4 16.5" stroke="#476C9B" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="upload-title">Drag and drop files here</p>
            <p class="upload-sub">Accepted types: PDF, PNG, JPG (max 20MB)</p>
            <button type="button" class="btn-outline btn-upload" id="browseBtn">Browse files</button>
            <input id="fileInput" name="attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" style="display:none">
          </div>

          ${existingAttachments}
          <div class="upload-pending-wrap" id="pendingUploads" hidden>
            <div class="upload-pending-head">
              <span class="upload-pending-badge" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="upload-pending-label">New files ready to upload</span>
            </div>
            <ul class="upload-preview upload-preview--pending" id="filePreview"></ul>
          </div>
          <div class="upload-message" id="uploadMessage" role="status"></div>
        </section>

        ${
          isRevise
            ? `<p class="revision-required-hint" id="revisionRequiredHint" role="status">Make at least one change to the report details or evidence before continuing.</p>`
            : ''
        }

        <div class="enterprise-actions enterprise-actions--split">
          ${isEdit ? '<a href="/supervisor/tickets" class="btn-enterprise-outline">Back to My Tickets</a>' : ''}
          <button type="submit" id="nextBtn" class="btn-enterprise-primary btn-enterprise-next" disabled>
            ${isRevise ? 'UPDATE &amp; PREVIEW' : isEdit ? 'UPDATE &amp; PREVIEW' : 'NEXT: SUMMARY PREVIEW'}
          </button>
        </div>
      </form>
    </div>

    <div class="ai-loading-overlay" id="aiLoading" aria-hidden="true">
      <div class="ai-loading-card">
        <div class="ai-spinner" aria-hidden="true"></div>
        <div class="ai-loading-text">Generating AI summary…</div>
      </div>
    </div>

    <script>
      (function () {
        const riskForm = document.getElementById('riskForm');
        const nextBtn = document.getElementById('nextBtn');
        const fileInput = document.getElementById('fileInput');
        const savedCount = ${isEdit ? (t.evidence || []).length : 0};
        const dropzone = document.getElementById('dropzone');
        const browseBtn = document.getElementById('browseBtn');
        const filePreview = document.getElementById('filePreview');
        const pendingUploads = document.getElementById('pendingUploads');
        const uploadMessage = document.getElementById('uploadMessage');
        const aiLoading = document.getElementById('aiLoading');
        const isReviseMode = ${isRevise ? 'true' : 'false'};
        const initialSnapshot = ${JSON.stringify({
          title: t.title || '',
          location: t.location || '',
          what: w.what || '',
          why: w.why || '',
          where: w.where || '',
          when: w.when || '',
          who: w.who || '',
          how: w.how || '',
        })};

        let selectedFiles = [];
        const allowedExt = new Set(['pdf','png','jpg','jpeg']);

        function countSavedNotRemoved() {
          const boxes = document.querySelectorAll('input[name="removeAttachmentIds"]:checked');
          return Math.max(0, savedCount - boxes.length);
        }

        function syncInputFiles() {
          const dt = new DataTransfer();
          selectedFiles.forEach((f) => dt.items.add(f));
          fileInput.files = dt.files;
        }

        function renderPreview() {
          filePreview.innerHTML = '';
          if (!selectedFiles.length) {
            if (pendingUploads) pendingUploads.hidden = true;
            return;
          }
          if (pendingUploads) pendingUploads.hidden = false;
          selectedFiles.forEach((f, idx) => {
            const li = document.createElement('li');
            li.className = 'upload-preview-item upload-preview-item--pending';
            li.innerHTML =
              '<span class="upload-pending-item-icon" aria-hidden="true">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
              '</svg></span>' +
              '<span class="upload-name"></span>' +
              '<span class="upload-meta"></span>' +
              '<button type="button" class="upload-remove-btn">Remove</button>';
            li.querySelector('.upload-name').textContent = f.name;
            li.querySelector('.upload-meta').textContent =
              (f.size / 1024 / 1024).toFixed(2) + ' MB · Ready to upload';
            li.querySelector('.upload-remove-btn').addEventListener('click', () => {
              selectedFiles.splice(idx, 1);
              syncInputFiles();
              renderPreview();
              if (!selectedFiles.length) setMessage('', null);
              updateNextState();
            });
            filePreview.appendChild(li);
          });
        }

        function notifyUpload(msg, type) {
          setMessage(msg, type);
          if (window.showAppToast) window.showAppToast(msg, type === 'error' ? 'error' : 'success');
        }

        function setMessage(msg, type) {
          uploadMessage.textContent = msg || '';
          uploadMessage.className = 'upload-message';
          if (type === 'error') uploadMessage.classList.add('upload-message--error');
          if (type === 'ok') uploadMessage.classList.add('upload-message--ok');
        }

        function validateFile(file) {
          const parts = String(file.name || '').toLowerCase().split('.');
          const ext = parts.length > 1 ? parts[parts.length - 1] : '';
          if (!allowedExt.has(ext)) return { ok: false, reason: 'Unsupported file type: ' + ext.toUpperCase() };
          // UI constraint: max 20MB
          const maxBytes = 20 * 1024 * 1024;
          if (file.size > maxBytes) return { ok: false, reason: 'File exceeds 20MB: ' + file.name };
          return { ok: true };
        }

        function addFiles(files) {
          const arr = Array.from(files || []);
          const before = selectedFiles.length;
          const next = [...selectedFiles];
          const addedNames = [];
          for (const f of arr) {
            const v = validateFile(f);
            if (!v.ok) {
              notifyUpload(v.reason, 'error');
              continue;
            }
            next.push(f);
            addedNames.push(f.name);
          }
          selectedFiles = next.slice(0, 10);
          const addedCount = selectedFiles.length - before;
          syncInputFiles();
          renderPreview();
          if (addedCount > 0) {
            const msg =
              addedCount === 1
                ? '"' + addedNames[addedNames.length - 1] + '" added — ready to upload'
                : addedCount + ' file(s) added — ready to upload';
            notifyUpload(msg, 'ok');
            dropzone.classList.add('upload-zone--success');
            setTimeout(() => dropzone.classList.remove('upload-zone--success'), 2000);
          }
          updateNextState();
        }

        function setFieldInvalid(id, invalid) {
          const el = document.getElementById(id);
          const wrap = el && el.closest('.field');
          if (wrap) wrap.classList.toggle('field--invalid', invalid);
        }

        function isFormDirty() {
          if (!isReviseMode) return true;
          if (selectedFiles.length > 0) return true;
          if (document.querySelectorAll('input[name="removeAttachmentIds"]:checked').length > 0) return true;
          return (
            document.getElementById('title').value.trim() !== initialSnapshot.title ||
            document.getElementById('location').value.trim() !== initialSnapshot.location ||
            document.getElementById('what').value.trim() !== initialSnapshot.what ||
            document.getElementById('why').value.trim() !== initialSnapshot.why ||
            document.getElementById('where').value.trim() !== initialSnapshot.where ||
            document.getElementById('when').value.trim() !== initialSnapshot.when ||
            document.getElementById('who').value.trim() !== initialSnapshot.who ||
            document.getElementById('how').value.trim() !== initialSnapshot.how
          );
        }

        function updateRequiredIndicators() {
          const title = document.getElementById('title').value.trim();
          const location = document.getElementById('location').value.trim();
          const what = document.getElementById('what').value.trim();
          const why = document.getElementById('why').value.trim();
          const evCount = selectedFiles.length + countSavedNotRemoved();
          const revised = isFormDirty();
          const revisionHint = document.getElementById('revisionRequiredHint');

          setFieldInvalid('title', !title);
          setFieldInvalid('location', !location);
          setFieldInvalid('what', !what);
          setFieldInvalid('why', !why);

          const evidenceMissing = evCount === 0;
          const evidenceSection = document.getElementById('evidenceSection');
          if (evidenceSection) evidenceSection.classList.toggle('field--invalid', evidenceMissing);
          dropzone.classList.toggle('upload-zone--invalid', evidenceMissing);
          if (revisionHint) {
            revisionHint.classList.toggle('revision-required-hint--visible', isReviseMode && !revised);
          }

          const ready = title && location && what && why && !evidenceMissing && revised;
          nextBtn.disabled = !ready;
          if (ready) nextBtn.classList.add('btn-enterprise-next-ready');
          else nextBtn.classList.remove('btn-enterprise-next-ready');
        }

        function updateNextState() {
          updateRequiredIndicators();
        }

        function onFilesPicked(e) {
          addFiles(e.target.files);
          // allow selecting the same file again
          e.target.value = '';
        }

        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', onFilesPicked);

        ['dragenter','dragover'].forEach(evt => {
          dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
          });
        });
        ['dragleave','drop'].forEach(evt => {
          dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
          });
        });
        dropzone.addEventListener('drop', (e) => {
          const dt = e.dataTransfer;
          if (dt && dt.files) addFiles(dt.files);
        });

        // Smart validation as the user types.
        ['title','location','what','why','where','when','who','how'].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          el.addEventListener('input', updateNextState);
          el.addEventListener('change', updateNextState);
        });

        document.querySelectorAll('input[name="removeAttachmentIds"]').forEach((el) => {
          el.addEventListener('change', updateNextState);
        });

        riskForm.addEventListener('submit', (e) => {
          if (nextBtn.disabled) {
            e.preventDefault();
            if (isReviseMode && !isFormDirty() && window.showAppToast) {
              window.showAppToast('Make at least one change to the report or evidence before continuing.', 'error');
            }
            return;
          }
          syncInputFiles();
          aiLoading.style.display = 'flex';
        });

        updateNextState();
      })();
    </script>
  `;

  return supervisorPage(isRevise ? 'Revise report' : isEdit ? 'Edit draft' : 'New report', user, isRevise ? 'returned' : isEdit ? 'tickets' : 'new', body, stats);
}

function newRiskReportPreviewPage(user, ticket, { flash, error, stats = {}, showUploadToast = false, revisionBlocked = false } = {}) {
  const isRevise = REPORTER_REVISION_STATUSES.includes(ticket?.status);

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${
      revisionBlocked
        ? `<div class="rmo-feedback-alert revision-blocked-alert" role="alert">
            <div class="rmo-feedback-alert__body">
              <p class="rmo-feedback-alert__title">Revision required</p>
              <p class="rmo-feedback-alert__message">No changes were detected since this ticket was returned. Go back, update the report details or evidence, then return to submit.</p>
              <p class="rmo-feedback-alert__hint"><a href="/supervisor/tickets/${escapeHtml(ticket.reference)}/edit">Edit returned report</a></p>
            </div>
          </div>`
        : ''
    }
    <div class="enterprise-module">
      <div class="enterprise-top">
        ${progressSteps(2)}
        <div class="enterprise-title">
          <h1>${isRevise ? 'REVISE RISK REPORT' : 'NEW RISK REPORT'}</h1>
          <p class="page-desc">${isRevise ? 'Review your updates. On resubmit, AI will re-analyze and route the ticket to the responsible department.' : 'Review the AI-generated summary, classification, and proposed routing before submitting.'}</p>
        </div>
      </div>

      ${aiAnalysisPanel(ticket, { preview: true })}

      <section class="enterprise-card">
        <div class="enterprise-section-head">
          <h2>EVIDENCE ATTACHMENTS</h2>
          <p class="section-hint">Supporting files attached to this risk report.</p>
        </div>
        ${renderExistingAttachments(ticket) || '<p class="text-muted">No attachments on file.</p>'}
      </section>

      <section class="enterprise-card review-submission-section review-submission-section--pending" id="reviewSubmissionSection">
        <div class="enterprise-section-head review-submission-section__head">
          <h2>
            <span class="review-submission-section__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            ${isRevise ? 'FINAL STEP: RESUBMIT TICKET' : 'REVIEW &amp; SUBMISSION'}
          </h2>
          <p class="section-hint">${
            isRevise
              ? 'Confirm and resubmit. AI will re-analyze and automatically route the ticket to the responsible department.'
              : 'Ensure the information is accurate. On submit, AI will classify the risk and route the ticket — you do not choose the handling department.'
          }</p>
        </div>

        <form method="post" action="/supervisor/tickets/new/preview/${escapeHtml(ticket.reference)}/submit" class="submit-report-form" id="submitForm" novalidate>
          <div class="review-confirm" id="reviewConfirmBox">
            <label class="confirm-check" id="confirmCheckLabel">
              <input type="checkbox" id="confirmBox" name="confirmBox" value="1" aria-describedby="reviewConfirmHint">
              <span>I confirm that the information provided is accurate${isRevise ? ' and ready to resubmit' : ''}.</span>
            </label>
            <p class="review-confirm-hint" id="reviewConfirmHint">Required — check this box to enable ${isRevise ? 'Resubmit ticket' : 'Submit ticket'}.</p>
            <div class="review-note text-muted">Ticket: <span class="mono">${escapeHtml(ticket.reference)}</span></div>
          </div>

          <div class="enterprise-actions enterprise-actions--split review-submission-actions">
            <div class="enterprise-actions__group">
              <a href="/supervisor/tickets/${escapeHtml(ticket.reference)}/edit" class="btn-enterprise-outline">${isRevise ? 'Back to edit' : 'Edit Draft'}</a>
              ${isRevise ? '' : `<button type="submit" formaction="/supervisor/tickets/new/preview/${escapeHtml(ticket.reference)}/save" formmethod="post" class="btn-enterprise-outline">Save Draft</button>`}
            </div>
            <button type="button" class="btn-enterprise-primary btn-enterprise-submit btn-enterprise-primary--inactive" id="submitBtn">
              ${isRevise ? 'Resubmit ticket' : 'Submit ticket'}
            </button>
            <button type="submit" id="submitBtnNative" class="visually-hidden" tabindex="-1" aria-hidden="true">Submit</button>
          </div>
        </form>
      </section>
    </div>

    <script>
      (function () {
        const revisionBlocked = ${revisionBlocked ? 'true' : 'false'};
        const submitVerb = ${isRevise ? "'Resubmit ticket'" : "'Submit ticket'"};
        const confirmBox = document.getElementById('confirmBox');
        const confirmLabel = document.getElementById('confirmCheckLabel');
        const submitBtn = document.getElementById('submitBtn');
        const submitBtnNative = document.getElementById('submitBtnNative');
        const submitForm = document.getElementById('submitForm');
        const reviewSection = document.getElementById('reviewSubmissionSection');
        const reviewConfirmBox = document.getElementById('reviewConfirmBox');
        const reviewHint = document.getElementById('reviewConfirmHint');

        function triggerPulse() {
          [reviewSection, reviewConfirmBox, confirmLabel].forEach((el) => {
            if (!el) return;
            el.classList.remove('review-submission-section--pulse');
            void el.offsetWidth;
            el.classList.add('review-submission-section--pulse');
          });
          if (reviewHint) {
            reviewHint.textContent = 'Please check the confirmation box before submitting.';
            reviewHint.classList.add('review-confirm-hint--error');
          }
          try {
            confirmBox.focus({ preventScroll: true });
          } catch (_) {
            confirmBox.focus();
          }
          reviewConfirmBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          window.setTimeout(() => {
            [reviewSection, reviewConfirmBox, confirmLabel].forEach((el) => {
              el?.classList.remove('review-submission-section--pulse');
            });
            update();
          }, 1600);
        }

        function update() {
          const checked = confirmBox.checked && !revisionBlocked;
          submitBtn.classList.toggle('btn-enterprise-primary--inactive', !checked);
          submitBtn.setAttribute('aria-disabled', checked ? 'false' : 'true');
          submitBtn.disabled = revisionBlocked;
          if (reviewSection) {
            reviewSection.classList.toggle('review-submission-section--pending', !checked);
            reviewSection.classList.toggle('review-submission-section--confirmed', checked);
          }
          if (reviewConfirmBox) {
            reviewConfirmBox.classList.toggle('review-confirm--pending', !checked);
            reviewConfirmBox.classList.toggle('review-confirm--done', checked);
          }
          if (reviewHint) {
            reviewHint.classList.remove('review-confirm-hint--error');
            reviewHint.textContent = revisionBlocked
              ? 'Update the returned report before submitting.'
              : checked
                ? 'Confirmed — click "' + submitVerb + '" to send it now.'
                : 'Required — check this box to enable ' + submitVerb + '.';
          }
        }

        submitBtn.addEventListener('click', function () {
          if (revisionBlocked) {
            if (window.showAppToast) {
              window.showAppToast('Update the returned report before submitting.', 'error');
            }
            return;
          }
          if (!confirmBox.checked) {
            triggerPulse();
            return;
          }
          submitBtnNative.click();
        });

        submitForm.addEventListener('submit', function (e) {
          const submitter = e.submitter;
          if (revisionBlocked) {
            e.preventDefault();
            return;
          }
          if (submitter && submitter.id === 'submitBtnNative' && !confirmBox.checked) {
            e.preventDefault();
            triggerPulse();
          }
        });

        confirmBox.addEventListener('change', update);
        update();
      })();
    </script>
    ${
      showUploadToast && flash
        ? `<script>
      document.addEventListener('DOMContentLoaded', function () {
        if (window.showAppToast) window.showAppToast(${JSON.stringify(flash)}, 'success');
      });
    </script>`
        : ''
    }
  `;

  return supervisorPage('AI Summary Preview', user, 'new', body, stats);
}

function actionsPage(user, tickets, flash, stats = {}) {
  const rows = ticketTableRows(tickets, { scoreColumn: true });
  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Action required</h1>
      <p class="page-desc">Tickets awaiting implementation, revision, or accomplishment submission.</p>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Score</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No tickets require action right now.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return supervisorPage('Action required', user, 'actions', body, stats);
}

function accomplishmentsPage(user, accomplishments, flash, stats = {}) {
  const rows = accomplishments
    .map(
      (a) => `<tr>
        <td class="mono nowrap"><a href="/supervisor/tickets/${escapeHtml(a.ticketRef)}">${escapeHtml(a.ticketRef)}</a></td>
        <td>${escapeHtml(a.ticketTitle)}</td>
        <td class="sup-truncate" title="${escapeHtml(a.summary)}">${escapeHtml(a.summary.length > 80 ? `${a.summary.slice(0, 80)}…` : a.summary)}</td>
        <td class="nowrap">${escapeHtml(formatDate(a.submittedAt))}</td>
      </tr>`,
    )
    .join('');

  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Accomplishment history</h1>
      <p class="page-desc">Reports submitted after implementing approved mitigations.</p>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Title</th>
              <th>Summary</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" class="empty">No accomplishment reports yet.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return supervisorPage('Accomplishment reports', user, 'accomplishments', body, stats);
}

function overdueTicketsPage(user, tickets, flash, stats = {}) {
  const overdueTickets = tickets.filter((t) => t.isOverdue);
  const rows = ticketTableRows(overdueTickets, { showDueColumn: true });
  const body = `
    ${flashMessage(flash)}
    <div class="sup-page-head">
      <div>
        <h1>Overdue tickets</h1>
        <p class="sup-page-desc">Tickets past the department target date. Each row shows the due date and an Overdue label — only overdue items appear here.</p>
      </div>
      <a href="/supervisor/tickets/new" class="sup-btn-primary">+ Create new ticket</a>
    </div>
    ${overdueTickets.length ? `<div class="overdue-page-banner" role="note">
      <strong>${overdueTickets.length}</strong> ticket${overdueTickets.length === 1 ? '' : 's'} past the department target date.
      Open a ticket to review due date, department handling, and the action plan.
    </div>` : ''}
    <div class="ticket-filters console-quick-actions">
      <a href="/supervisor/tickets" class="filter-pill">All tickets <span class="filter-pill__count">${tickets.length}</span></a>
      <a href="/supervisor/overdue" class="filter-pill filter-pill--warn active">Overdue <span class="filter-pill__count">${overdueTickets.length}</span></a>
    </div>
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table tickets-table tickets-table--crud">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Due date</th>
              <th>Files</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" class="empty">No overdue tickets. All active tickets are within their target dates.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  return supervisorPage('Overdue tickets', user, 'overdue', body, stats);
}

function filteredTicketsPage(user, tickets, flash, { filter, title, desc, activeNav, stats = {} } = {}) {
  const isClosedStatus = (t) => ['closed', 'resolved'].includes(t.status);
  const filtered =
    filter === 'draft'
      ? tickets.filter((t) => t.status === 'draft')
      : filter === 'returned'
        ? tickets.filter((t) => REPORTER_REVISION_STATUSES.includes(t.status))
        : filter === 'overdue'
          ? tickets.filter((t) => t.isOverdue)
          : filter === 'submitted'
            ? tickets.filter((t) => t.status !== 'draft')
            : filter === 'closed'
              ? tickets.filter(isClosedStatus)
              : tickets;
  const showDueColumn = filter === 'overdue';
  const dueHeader = showDueColumn ? '<th>Due date</th>' : '';
  const actionColspan = filter === 'draft' || filter === 'returned' ? 1 : 0;
  const tableColspan = 5 + (showDueColumn ? 1 : 0) + 1 + actionColspan;
  const rows = ticketTableRows(filtered, {
    showActions: filter === 'draft' || filter === 'returned',
    showDueColumn,
  });
  const body = `
    ${flashMessage(flash)}
    <div class="sup-page-head">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p class="sup-page-desc">${escapeHtml(desc)}</p>
      </div>
      <a href="/supervisor/tickets/new" class="sup-btn-primary">+ Create new ticket</a>
    </div>
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table tickets-table tickets-table--crud">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              ${dueHeader}
              <th>Files</th>
              <th>Updated</th>
              ${filter === 'draft' || filter === 'returned' ? '<th>Actions</th>' : ''}
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="${tableColspan}" class="empty">${filter === 'overdue' ? 'No overdue tickets.' : 'No tickets in this view.'}</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;
  return supervisorPage(title, user, activeNav, body, stats);
}

function reporterProfilePage(user, flash, stats = {}) {
  const body = `
    ${flashMessage(flash)}
    <div class="sup-page-head">
      <div>
        <h1>Profile</h1>
        <p class="sup-page-desc">Your Ticket Reporter account details.</p>
      </div>
    </div>
    <section class="sup-card">
      <dl class="detail-dl detail-dl--profile">
        <dt>Display name</dt><dd>${escapeHtml(user.displayName || '—')}</dd>
        <dt>Username</dt><dd class="mono">${escapeHtml(user.username)}</dd>
        <dt>Email</dt><dd>${escapeHtml(user.email || '—')}</dd>
        <dt>Employee ID</dt><dd>${escapeHtml(user.employeeId || '—')}</dd>
        <dt>Department</dt><dd>${escapeHtml(user.department || '—')}</dd>
        <dt>Position</dt><dd>${escapeHtml(user.position || '—')}</dd>
        <dt>Role</dt><dd>${escapeHtml(user.roleLabel || 'Ticket Reporter')}</dd>
      </dl>
      <p class="text-muted section-hint">Contact your system administrator to update profile details or reset your password.</p>
    </section>`;
  return supervisorPage('Profile', user, 'profile', body, stats);
}

function reporterNotificationsPage(user, notifications, flash, stats = {}) {
  const items = notifications.length
    ? notifications
        .map((n) => {
          const unreadCls = n.read ? '' : ' notif-page-item--unread';
          return `<li class="notif-page-item${unreadCls}">
            <a href="${escapeHtml(n.href || '#')}" class="notif-page-item__link">
              <span class="notif-page-item__title">${escapeHtml(n.title || 'Notification')}</span>
              <span class="notif-page-item__message">${escapeHtml(n.message || '')}</span>
              <span class="notif-page-item__time">${escapeHtml(formatDate(n.at))}</span>
            </a>
          </li>`;
        })
        .join('')
    : '<li class="notif-page-item notif-page-item--empty">No notifications yet. Status updates on your tickets will appear here.</li>';

  const body = `
    ${flashMessage(flash)}
    <div class="sup-page-head">
      <div>
        <h1>Notifications</h1>
        <p class="sup-page-desc">Ticket status updates, routing confirmations, and return notices.</p>
      </div>
      ${
        notifications.some((n) => !n.read)
          ? `<form method="post" action="/supervisor/notifications/read-all"><button type="submit" class="btn-outline">Mark all read</button></form>`
          : ''
      }
    </div>
    <section class="sup-card">
      <ul class="notif-page-list">${items}</ul>
    </section>`;
  return supervisorPage('Notifications', user, 'notifications', body, stats);
}

module.exports = {
  supervisorOverviewPage,
  ticketsListPage,
  ticketFormPage,
  newRiskReportStep1Page,
  newRiskReportPreviewPage,
  actionsPage,
  accomplishmentsPage,
  filteredTicketsPage,
  overdueTicketsPage,
  reporterProfilePage,
  reporterNotificationsPage,
};
