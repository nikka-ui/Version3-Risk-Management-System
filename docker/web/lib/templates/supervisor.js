const { RISK_CATEGORIES, DEPARTMENTS, getCategoryLabel, getStatusLabel, getStatusTone } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { canSupervisorSubmitAccomplishment } = require('../tickets');
const { supervisorAppLayout } = require('./supervisor-layout');
const { flashMessage } = require('./layout');
const { evidenceSection } = require('./evidence');

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
  return `<span class="pill pill--${tone}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function rmoReturnFeedbackBlock(notes, hint) {
  if (!notes?.trim()) return '';
  return `<section class="rmo-feedback-alert" role="alert" aria-live="polite">
    <div class="rmo-feedback-alert__icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 9V13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="12" cy="17" r="1.25" fill="currentColor"/>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="rmo-feedback-alert__body">
      <p class="rmo-feedback-alert__title">RMO feedback</p>
      <p class="rmo-feedback-alert__message">${escapeHtml(notes.trim())}</p>
      ${hint ? `<p class="rmo-feedback-alert__hint">${escapeHtml(hint)}</p>` : ''}
    </div>
  </section>`;
}

const KPI_ICONS = {
  tickets: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>`,
  drafts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  action: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
  overdue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
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

function ticketTableRows(tickets, { linkPrefix = '/supervisor/tickets/', showActions = false, scoreColumn = false } = {}) {
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
      } else if (showActions && t.status === 'returned') {
        actions = `<a href="/supervisor/tickets/${escapeHtml(t.reference)}/edit" class="btn-link">Revise</a>`;
      } else if (showActions && !isDraft) {
        actions = `<a href="${linkPrefix}${escapeHtml(t.reference)}" class="btn-link">View</a>`;
      }
      const metricCell = scoreColumn
        ? `<td class="nowrap mono">${t.riskScore || t.likelihood * t.impact}</td>`
        : `<td class="nowrap">${t.evidenceCount || 0}</td>`;
      return `<tr>
        <td class="mono nowrap"><a href="${linkPrefix}${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel)}</td>
        <td>${statusPill(t.status, t.isOverdue)}</td>
        ${metricCell}
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
        ${showActions ? `<td class="col-actions">${actions}</td>` : ''}
      </tr>`;
    })
    .join('');
}

function supervisorPage(title, user, activeNav, body, stats) {
  return supervisorAppLayout({ title, user, activeNav, body, stats });
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
  const recentRows = ticketTableRows(recentTickets.slice(0, 5));
  const body = `
    ${flashMessage(flash)}
    <div class="sup-page-head">
      <div>
        <h1>Overview</h1>
        <p class="sup-page-desc">Track risk reports, pending actions, and accomplishments for your department.</p>
      </div>
      <a href="/supervisor/tickets/new" class="sup-btn-primary">+ New report</a>
    </div>
    <div class="sup-kpi-grid">
      ${kpiCard('/supervisor/tickets', KPI_ICONS.tickets, stats.total, 'My tickets')}
      ${kpiCard('/supervisor/tickets?filter=draft', KPI_ICONS.drafts, stats.drafts, 'Drafts')}
      ${kpiCard('/supervisor/actions', KPI_ICONS.action, stats.actionRequired, 'Action required', 'sup-kpi--accent')}
      ${kpiCard('/supervisor/tickets', KPI_ICONS.overdue, stats.overdue, 'Overdue', stats.overdue > 0 ? 'sup-kpi--warn' : '')}
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
              <th>Files</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${recentRows || '<tr><td colspan="6" class="empty">No tickets yet. <a href="/supervisor/tickets/new">Create your first report</a>.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return supervisorPage('Overview', user, 'overview', body, stats);
}

function ticketsListPage(user, tickets, flash, { filter, error, stats = {} } = {}) {
  const filtered =
    filter === 'draft'
      ? tickets.filter((t) => t.status === 'draft')
      : filter === 'submitted'
        ? tickets.filter((t) => t.status !== 'draft')
        : tickets;
  const rows = ticketTableRows(filtered, { showActions: true });
  const draftCount = tickets.filter((t) => t.status === 'draft').length;
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(decodeURIComponent(error), 'error') : ''}
    <div class="sup-page-head">
      <div>
        <h1>My tickets</h1>
        <p class="sup-page-desc">Manage draft reports (create, edit, delete) before submission. Submitted tickets are read-only.</p>
      </div>
      <a href="/supervisor/tickets/new" class="sup-btn-primary">+ New report</a>
    </div>
    <div class="ticket-filters console-quick-actions">
      <a href="/supervisor/tickets" class="filter-pill ${!filter ? 'active' : ''}">All <span class="filter-pill__count">${tickets.length}</span></a>
      <a href="/supervisor/tickets?filter=draft" class="filter-pill ${filter === 'draft' ? 'active' : ''}">Drafts <span class="filter-pill__count">${draftCount}</span></a>
      <a href="/supervisor/tickets?filter=submitted" class="filter-pill ${filter === 'submitted' ? 'active' : ''}">Submitted <span class="filter-pill__count">${tickets.length - draftCount}</span></a>
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
              <th>Files</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" class="empty">No tickets yet. <a href="/supervisor/tickets/new">Create your first risk report</a>.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return supervisorPage('My tickets', user, 'tickets', body, stats);
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

function ticketFormPage(user, ticket, { mode, flash, error, devMode, stats = {} }) {
  const t = ticket || {};
  const ref = t.reference || '';

  const aiBlock =
    t.ai
      ? `<section class="card card--ai">
          <h2>AI classification</h2>
          <p class="text-muted">${escapeHtml(t.ai.summary)}</p>
          <dl class="detail-dl">
            <dt>Severity</dt><dd>${t.ai.severity}/5</dd>
            <dt>Confidence</dt><dd>${Math.round(t.ai.confidence * 100)}%</dd>
            <dt>Manual review</dt><dd>${t.ai.manualReviewRequired ? 'Required' : 'No'}</dd>
          </dl>
        </section>`
      : '';

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

  const formSection = `<section class="card">
        <h2>Risk details</h2>
        <dl class="detail-dl">
          <dt>Title</dt><dd>${escapeHtml(t.title)}</dd>
          <dt>Department</dt><dd>${escapeHtml(t.department)}</dd>
          <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
          <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
          <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
        </dl>
        <p style="margin-top:1rem">${escapeHtml(t.description || '—')}</p>
      </section>
      <section class="card">
        <h2>5W1H</h2>
        ${fiveW1HFields(t, false)}
      </section>`;

  const evidenceSectionHtml = evidenceSection(t, { attachmentBasePath: '/supervisor/attachments' });

  const showAccomplishment = canSupervisorSubmitAccomplishment(t);
  const existingEvidenceCount = (t.evidence || []).filter((e) => e.storageKey || !e.legacy).length;

  const addEvidenceForm =
    ['under_review', 'in_mitigation', 'returned', 'pending_audit', 'reopened'].includes(t.status)
      ? `<section class="card${showAccomplishment ? ' card--required-evidence' : ''}">
          <h2>Add evidence${showAccomplishment ? ' <span class="req" aria-hidden="true">*</span>' : ''}</h2>
          <p class="text-muted">${
            showAccomplishment
              ? 'Required — upload at least one supporting file (PDF, PNG, or JPG) before submitting your accomplishment report.'
              : 'Upload PDF, PNG, or JPG files (max 20MB each).'
          }</p>
          <form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/evidence" class="stack-form" enctype="multipart/form-data">
            <div class="field${showAccomplishment ? ' field--required' : ''}">
              <label for="addEvidenceFiles">${showAccomplishment ? 'Files *' : 'Files'}</label>
              <input id="addEvidenceFiles" name="attachments" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" required>
            </div>
            <button type="submit" class="btn-sm">Upload files</button>
          </form>
        </section>`
      : '';

  const accomplishmentForm = showAccomplishment
      ? `<section class="card card--accent">
          <h2>Submit accomplishment report</h2>
          <p class="text-muted">Document mitigation implementation and outcomes. Evidence attachment is required.</p>
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

  const devMitigation =
    devMode && t.status === 'under_review'
      ? `<form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/simulate-mitigation" class="dev-banner">
          <p class="text-muted">Development: simulate RMO approval to test implementation workflow.</p>
          <button type="submit" class="btn-outline">Assign mitigation (demo)</button>
        </form>`
      : '';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title || 'Ticket')}</h1>
        <p class="page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}</p>
      </div>
      <a href="/supervisor/tickets" class="btn-outline">Back to tickets</a>
    </div>
    ${formSection}
    ${aiBlock}
    ${officerBlock}
    ${supervisorFeedbackBlock}
    ${evidenceSectionHtml}
    ${addEvidenceForm}
    ${accomplishmentForm}
    ${devMitigation}`;

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
  const isRevise = mode === 'revise' && ticket?.status === 'returned';
  const isEdit = (mode === 'edit' && ticket?.status === 'draft') || isRevise;
  const t = ticket || {};
  const w = t.fiveW1H || {};
  const formAction = isEdit
    ? `/supervisor/tickets/${escapeHtml(t.reference)}/edit`
    : '/supervisor/tickets/new/preview';
  const pageTitle = isRevise ? 'REVISE RISK REPORT' : isEdit ? 'EDIT DRAFT REPORT' : 'NEW RISK REPORT';
  const pageDesc = isRevise
    ? 'Your report was returned by the RMO. Update the details and evidence, then resubmit for review.'
    : isEdit
      ? 'Update your draft report. Only drafts can be edited or deleted before submission.'
      : 'Submit a structured incident report. AI will generate the risk analysis preview.';
  const deptOptions = DEPARTMENTS.map((d) => {
    const selected = (isEdit ? t.department : d === 'Operations') === d ? 'selected' : '';
    return `<option value="${escapeHtml(d)}" ${selected}>${escapeHtml(d)}</option>`;
  }).join('');
  const existingAttachments = isEdit ? renderExistingAttachments(t) : '';
  const rmoFeedbackBlock = isRevise
    ? rmoReturnFeedbackBlock(
        t.officerNotes,
        'Address the feedback below, then continue to the AI preview and resubmit.',
      )
    : '';
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

          <div class="enterprise-grid enterprise-grid--3">
            <div class="field field--required" data-required="title">
              <label for="title">${reqLabel('Risk Title', { required: true })}</label>
              <input id="title" name="title" type="text" required aria-required="true" placeholder="Short, specific risk title" class="enterprise-input" value="${escapeHtml(t.title || '')}">
            </div>
            <div class="field field--required" data-required="department">
              <label for="department">${reqLabel('Department', { required: true })}</label>
              <select id="department" name="department" required aria-required="true" class="enterprise-select">
                ${deptOptions}
              </select>
            </div>
            <div class="field field--required" data-required="location">
              <label for="location">${reqLabel('Location', { required: true })}</label>
              <input id="location" name="location" type="text" required aria-required="true" placeholder="Building / unit / site" class="enterprise-input" value="${escapeHtml(t.location || '')}">
            </div>
          </div>
        </section>

        <section class="enterprise-card">
          <div class="enterprise-section-head">
            <h2>INCIDENT DETAILS</h2>
            <p class="section-hint">Use clear, factual language. AI preview is generated from these narratives.</p>
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

        function updateRequiredIndicators() {
          const title = document.getElementById('title').value.trim();
          const department = document.getElementById('department').value.trim();
          const location = document.getElementById('location').value.trim();
          const what = document.getElementById('what').value.trim();
          const why = document.getElementById('why').value.trim();
          const evCount = selectedFiles.length + countSavedNotRemoved();

          setFieldInvalid('title', !title);
          setFieldInvalid('department', !department);
          setFieldInvalid('location', !location);
          setFieldInvalid('what', !what);
          setFieldInvalid('why', !why);

          const evidenceMissing = evCount === 0;
          const evidenceSection = document.getElementById('evidenceSection');
          if (evidenceSection) evidenceSection.classList.toggle('field--invalid', evidenceMissing);
          dropzone.classList.toggle('upload-zone--invalid', evidenceMissing);

          const ready = title && department && location && what && why && !evidenceMissing;
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
        ['title','department','location','what','why'].forEach(id => {
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
            return;
          }
          syncInputFiles();
          aiLoading.style.display = 'flex';
        });

        updateNextState();
      })();
    </script>
  `;

  return supervisorPage(isRevise ? 'Revise report' : isEdit ? 'Edit draft' : 'New report', user, isRevise ? 'actions' : isEdit ? 'tickets' : 'new', body, stats);
}

function newRiskReportPreviewPage(user, ticket, { flash, error, stats = {}, showUploadToast = false } = {}) {
  const ai = ticket?.ai || {};
  const riskCategoryLabel = getCategoryLabel(ai.riskCategory || ticket?.category);
  const riskLevel = ai.riskLevel || riskLevelFromSeverityLocal(ticket?.likelihood && ticket?.impact ? Math.round((ticket.likelihood + ticket.impact) / 2) : 2);

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="enterprise-module">
      <div class="enterprise-top">
        ${progressSteps(2)}
        <div class="enterprise-title">
          <h1>NEW RISK REPORT</h1>
          <p class="page-desc">AI preview generated from your incident details. Review and submit when ready.</p>
        </div>
      </div>

      <section class="enterprise-card enterprise-card--ai ai-panel">
        <div class="enterprise-section-head enterprise-section-head--tight">
          <h2>AI PREVIEW</h2>
          <div class="ai-badge">
            <span class="ai-badge__dot" aria-hidden="true"></span>
            <span>AI Preview</span>
          </div>
        </div>

        <div class="ai-preview-grid">
          <div class="ai-summary">
            <div class="ai-summary-head">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="ai-icon">
                <path d="M12 2C8 2 5 5 5 9C5 13 8 16 12 16C16 16 19 13 19 9C19 5 16 2 12 2Z" stroke="#476C9B" stroke-width="2"/>
                <path d="M4 22C6.5 19.5 9.5 18 12 18C14.5 18 17.5 19.5 20 22" stroke="#476C9B" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <strong>Automatic summary</strong>
            </div>
            <p>${escapeHtml(ai.summary || '—')}</p>
          </div>

          <div class="ai-analysis">
            <div class="ai-analysis-card">
              <div class="ai-analysis-row">
                <span class="ai-analysis-label">Likelihood</span>
                <span class="ai-analysis-value">${escapeHtml(ai.likelihood ?? '—')}/5</span>
              </div>
              <div class="ai-analysis-row">
                <span class="ai-analysis-label">Impact</span>
                <span class="ai-analysis-value">${escapeHtml(ai.impact ?? '—')}/5</span>
              </div>
              <div class="ai-analysis-row">
                <span class="ai-analysis-label">Risk Category</span>
                <span class="ai-analysis-value">${escapeHtml(riskCategoryLabel)}</span>
              </div>
              <div class="ai-analysis-row">
                <span class="ai-analysis-label">Risk Level</span>
                <span>${riskLevelBadge(riskLevel)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

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
            REVIEW &amp; SUBMISSION
          </h2>
          <p class="section-hint">Ensure the information is accurate. You will submit this report for Risk Management Officer review.</p>
        </div>

        <form method="post" action="/supervisor/tickets/new/preview/${escapeHtml(ticket.reference)}/submit" class="submit-report-form" id="submitForm" novalidate>
          <div class="review-confirm" id="reviewConfirmBox">
            <label class="confirm-check" id="confirmCheckLabel">
              <input type="checkbox" id="confirmBox" name="confirmBox" value="1" aria-describedby="reviewConfirmHint">
              <span>I confirm that the information provided is accurate.</span>
            </label>
            <p class="review-confirm-hint" id="reviewConfirmHint">Required — check this box to enable Submit Report.</p>
            <div class="review-note text-muted">Ticket: <span class="mono">${escapeHtml(ticket.reference)}</span></div>
          </div>

          <div class="enterprise-actions enterprise-actions--split review-submission-actions">
            <div class="enterprise-actions__group">
              <a href="/supervisor/tickets/${escapeHtml(ticket.reference)}/edit" class="btn-enterprise-outline">Edit Draft</a>
              <button type="submit" formaction="/supervisor/tickets/new/preview/${escapeHtml(ticket.reference)}/save" formmethod="post" class="btn-enterprise-outline">Save Draft</button>
            </div>
            <button type="button" class="btn-enterprise-primary btn-enterprise-submit btn-enterprise-primary--inactive" id="submitBtn">
              Submit Report
            </button>
            <button type="submit" id="submitBtnNative" class="visually-hidden" tabindex="-1" aria-hidden="true">Submit</button>
          </div>
        </form>
      </section>
    </div>

    <script>
      (function () {
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
          const checked = confirmBox.checked;
          submitBtn.classList.toggle('btn-enterprise-primary--inactive', !checked);
          submitBtn.setAttribute('aria-disabled', checked ? 'false' : 'true');
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
            reviewHint.textContent = checked
              ? 'Confirmed — you may submit this report.'
              : 'Required — check this box to enable Submit Report.';
          }
        }

        submitBtn.addEventListener('click', function () {
          if (!confirmBox.checked) {
            triggerPulse();
            return;
          }
          submitBtnNative.click();
        });

        submitForm.addEventListener('submit', function (e) {
          const submitter = e.submitter;
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

  return supervisorPage('Accomplishments', user, 'accomplishments', body, stats);
}

module.exports = {
  supervisorOverviewPage,
  ticketsListPage,
  ticketFormPage,
  newRiskReportStep1Page,
  newRiskReportPreviewPage,
  actionsPage,
  accomplishmentsPage,
};
