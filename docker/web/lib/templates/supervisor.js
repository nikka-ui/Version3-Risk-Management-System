const { RISK_CATEGORIES, DEPARTMENTS, getCategoryLabel, getStatusLabel } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { canSupervisorEdit } = require('../tickets');
const { appLayout, flashMessage } = require('./layout');

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
  const cls = overdue ? 'pill pill--bad' : 'pill';
  return `<span class="${cls}">${escapeHtml(getStatusLabel(status))}</span>`;
}

/** Red asterisk for required field labels. */
function reqLabel(text, { required = false } = {}) {
  const star = required ? '<span class="req" aria-hidden="true">*</span>' : '';
  return `${escapeHtml(text)}${star}`;
}

function ticketTableRows(tickets, { linkPrefix = '/supervisor/tickets/', showActions = false } = {}) {
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
      } else if (showActions && !isDraft) {
        actions = `<a href="${linkPrefix}${escapeHtml(t.reference)}" class="btn-link">View</a>`;
      }
      return `<tr>
        <td class="mono nowrap"><a href="${linkPrefix}${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel)}</td>
        <td>${statusPill(t.status, t.isOverdue)}</td>
        <td class="nowrap">${t.evidenceCount || 0}</td>
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
        ${showActions ? `<td class="col-actions">${actions}</td>` : ''}
      </tr>`;
    })
    .join('');
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

function supervisorOverviewPage(user, stats, flash) {
  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Supervisor dashboard</h1>
      <p class="page-desc">Submit risk reports, track tickets, and record accomplishments for your department.</p>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-value">${stats.total}</span>
        <span class="stat-label">My tickets</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.drafts}</span>
        <span class="stat-label">Drafts</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.actionRequired}</span>
        <span class="stat-label">Action required</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.overdue}</span>
        <span class="stat-label">Overdue</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.accomplishments}</span>
        <span class="stat-label">Accomplishments</span>
      </div>
    </div>
    <div class="card" style="margin-top:1.5rem">
      <h2>Quick actions</h2>
      <div class="action-row">
        <a href="/supervisor/tickets/new" class="btn-outline">Submit new risk report</a>
        <a href="/supervisor/tickets" class="btn-outline">View my tickets</a>
        <a href="/supervisor/actions" class="btn-outline">Action required</a>
        <a href="/supervisor/accomplishments" class="btn-outline">Accomplishment history</a>
      </div>
    </div>`;

  return appLayout({
    title: 'Supervisor dashboard',
    user,
    activeNav: 'overview',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

function ticketsListPage(user, tickets, flash, { filter, error } = {}) {
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
    <div class="page-head page-head--row">
      <div>
        <h1>My tickets</h1>
        <p class="page-desc">Manage draft reports (create, edit, delete) before submission. Submitted tickets are read-only.</p>
      </div>
      <a href="/supervisor/tickets/new" class="btn-enterprise-primary btn-primary--auto">+ New report</a>
    </div>
    <div class="ticket-filters">
      <a href="/supervisor/tickets" class="filter-pill ${!filter ? 'active' : ''}">All (${tickets.length})</a>
      <a href="/supervisor/tickets?filter=draft" class="filter-pill ${filter === 'draft' ? 'active' : ''}">Drafts (${draftCount})</a>
      <a href="/supervisor/tickets?filter=submitted" class="filter-pill ${filter === 'submitted' ? 'active' : ''}">Submitted (${tickets.length - draftCount})</a>
    </div>
    <section class="card card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table tickets-table--crud">
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
    </section>
    <p class="text-muted storage-note">Evidence files are stored separately under <code>docker/web/uploads/</code> (Docker volume) and linked to each ticket by reference number.</p>`;

  return appLayout({
    title: 'My tickets',
    user,
    activeNav: 'tickets',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
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

function ticketFormPage(user, ticket, { mode, flash, error, devMode }) {
  const isNew = mode === 'new';
  const editable = isNew || (ticket && canSupervisorEdit(ticket));
  const t = ticket || {};
  const ref = t.reference || '';

  const aiBlock =
    t.ai && !editable
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
      ? `<section class="card">
          <h2>RMO feedback</h2>
          <p>${escapeHtml(t.officerNotes)}</p>
          <p class="text-muted">Your report was returned for revision. Update and resubmit when ready.</p>
        </section>`
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

  const evidenceList = (t.evidence || [])
    .map((e) => {
      const label = e.storageKey
        ? `<a href="/supervisor/attachments/${escapeHtml(e.id)}" target="_blank" rel="noopener">${escapeHtml(e.name || e.originalName)}</a>`
        : escapeHtml(e.name || '—');
      return `<li>${label} <span class="text-muted">(${escapeHtml(formatDate(e.uploadedAt))})</span></li>`;
    })
    .join('');

  const formSection = editable
    ? `<form method="post" action="${isNew ? '/supervisor/tickets' : `/supervisor/tickets/${escapeHtml(ref)}`}" class="stack-form ticket-form">
        <section class="card">
          <h2>Risk details</h2>
          <div class="form-grid">
            <div class="field">
              <label for="title">Risk title *</label>
              <input id="title" name="title" type="text" required value="${escapeHtml(t.title || '')}">
            </div>
            <div class="field">
              <label for="department">Department</label>
              <input id="department" name="department" type="text" value="${escapeHtml(t.department || 'Operations')}">
            </div>
            <div class="field">
              <label for="location">Location</label>
              <input id="location" name="location" type="text" value="${escapeHtml(t.location || '')}" placeholder="Building, floor, area">
            </div>
            <div class="field">
              <label for="category">Category</label>
              <select id="category" name="category">${categoryOptions(t.category || 'operational')}</select>
            </div>
            <div class="field">
              <label for="likelihood">Likelihood (1–5)</label>
              <select id="likelihood" name="likelihood">${likelihoodOptions(t.likelihood || 3)}</select>
            </div>
            <div class="field">
              <label for="impact">Impact (1–5)</label>
              <select id="impact" name="impact">${likelihoodOptions(t.impact || 3)}</select>
            </div>
          </div>
          <div class="field">
            <label for="description">Detailed description</label>
            <textarea id="description" name="description" rows="4">${escapeHtml(t.description || '')}</textarea>
          </div>
          <div class="field">
            <label for="mitigationApproach">Preferred mitigation (optional)</label>
            <input id="mitigationApproach" name="mitigationApproach" type="text" value="${escapeHtml(t.mitigationApproach || '')}">
          </div>
        </section>
        <section class="card">
          <h2>5W1H</h2>
          ${fiveW1HFields(t, true)}
        </section>
        <section class="card">
          <h2>Evidence references</h2>
          <p class="text-muted">Enter one file name or reference per line (full upload via API in production).</p>
          <div class="field">
            <label for="evidenceFiles">Attachments</label>
            <textarea id="evidenceFiles" name="evidenceFiles" rows="3" placeholder="e.g. incident-photo.jpg"></textarea>
          </div>
        </section>
        <div class="form-actions">
          ${isNew ? '' : `<button type="submit" name="intent" value="save" class="btn-outline">Save draft</button>`}
          <button type="submit" name="intent" value="submit" class="btn-primary btn-primary--auto">${isNew ? 'Save &amp; submit' : 'Save &amp; resubmit'}</button>
        </div>
      </form>`
    : `<section class="card">
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

  const evidenceSection =
    !editable && evidenceList
      ? `<section class="card"><h2>Evidence</h2><ul class="evidence-list">${evidenceList}</ul></section>`
      : '';

  const addEvidenceForm =
    !editable && ['under_review', 'in_mitigation', 'returned', 'pending_audit', 'reopened'].includes(t.status)
      ? `<section class="card">
          <h2>Add evidence</h2>
          <form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/evidence" class="stack-form">
            <div class="field">
              <label for="evidenceFiles">New references (one per line)</label>
              <textarea id="evidenceFiles" name="evidenceFiles" rows="2" required></textarea>
            </div>
            <button type="submit" class="btn-sm">Upload reference</button>
          </form>
        </section>`
      : '';

  const accomplishmentForm =
    ['in_mitigation', 'returned', 'reopened'].includes(t.status)
      ? `<section class="card card--accent">
          <h2>Submit accomplishment report</h2>
          <p class="text-muted">Document mitigation implementation and outcomes.</p>
          <form method="post" action="/supervisor/tickets/${escapeHtml(ref)}/accomplishment" class="stack-form">
            <div class="field">
              <label for="summary">Implementation summary *</label>
              <textarea id="summary" name="summary" rows="3" required></textarea>
            </div>
            <div class="field">
              <label for="outcomes">Outcomes and results *</label>
              <textarea id="outcomes" name="outcomes" rows="3" required></textarea>
            </div>
            <div class="field">
              <label for="acc_evidence">Resolution evidence (one per line)</label>
              <textarea id="acc_evidence" name="evidenceFiles" rows="2"></textarea>
            </div>
            <button type="submit" class="btn-primary btn-primary--auto">Submit accomplishment</button>
          </form>
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
        <h1>${isNew ? 'New risk report' : escapeHtml(t.title || 'Ticket')}</h1>
        <p class="page-desc">${isNew ? 'Structured 5W1H report with evidence references.' : `<span class="mono">${escapeHtml(ref)}</span> · ${statusPill(t.status, t.isOverdue)}`}</p>
      </div>
      ${isNew ? '<a href="/supervisor/tickets" class="btn-outline">Back to tickets</a>' : ''}
    </div>
    ${formSection}
    ${aiBlock}
    ${officerBlock}
    ${supervisorFeedbackBlock}
    ${evidenceSection}
    ${addEvidenceForm}
    ${accomplishmentForm}
    ${devMitigation}`;

  return appLayout({
    title: isNew ? 'New risk report' : ref,
    user,
    activeNav: isNew ? 'new' : 'tickets',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
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

function newRiskReportStep1Page(user, ticketRef, { flash, error, ticket = null, mode = 'new' } = {}) {
  const isEdit = mode === 'edit' && ticket;
  const t = ticket || {};
  const w = t.fiveW1H || {};
  const formAction = isEdit
    ? `/supervisor/tickets/${escapeHtml(t.reference)}/edit`
    : '/supervisor/tickets/new/preview';
  const pageTitle = isEdit ? 'EDIT DRAFT REPORT' : 'NEW RISK REPORT';
  const pageDesc = isEdit
    ? 'Update your draft report. Only drafts can be edited or deleted before submission.'
    : 'Submit a structured incident report. AI will generate the risk analysis preview.';
  const deptOptions = DEPARTMENTS.map((d) => {
    const selected = (isEdit ? t.department : d === 'Operations') === d ? 'selected' : '';
    return `<option value="${escapeHtml(d)}" ${selected}>${escapeHtml(d)}</option>`;
  }).join('');
  const existingAttachments = isEdit ? renderExistingAttachments(t) : '';
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
          <ul class="upload-preview" id="filePreview"></ul>
          <div class="upload-message" id="uploadMessage" role="status"></div>
        </section>

        <div class="enterprise-actions enterprise-actions--split">
          ${isEdit ? '<a href="/supervisor/tickets" class="btn-enterprise-outline">Back to My Tickets</a>' : ''}
          <button type="submit" id="nextBtn" class="btn-enterprise-primary btn-enterprise-next" disabled>
            ${isEdit ? 'UPDATE &amp; PREVIEW' : 'NEXT: SUMMARY PREVIEW'}
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
          if (!selectedFiles.length) return;
          selectedFiles.forEach((f) => {
            const li = document.createElement('li');
            li.className = 'upload-preview-item';
            li.innerHTML = '<span class="upload-name"></span><span class="upload-meta"></span>';
            li.querySelector('.upload-name').textContent = f.name;
            li.querySelector('.upload-meta').textContent = (f.size / 1024 / 1024).toFixed(2) + ' MB';
            filePreview.appendChild(li);
          });
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
          const next = [...selectedFiles];
          for (const f of arr) {
            const v = validateFile(f);
            if (!v.ok) {
              setMessage(v.reason, 'error');
              continue;
            }
            next.push(f);
          }
          selectedFiles = next.slice(0, 10);
          syncInputFiles();
          renderPreview();
          setMessage(selectedFiles.length ? ('Attached ' + selectedFiles.length + ' file(s).') : '', selectedFiles.length ? 'ok' : null);
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

  return appLayout({
    title: 'New Risk Report',
    user,
    activeNav: 'new',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

function newRiskReportPreviewPage(user, ticket, { flash, error }) {
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
          <p class="section-hint">Files are stored in secure upload storage and linked to this ticket.</p>
        </div>
        ${renderExistingAttachments(ticket) || '<p class="text-muted">No attachments on file.</p>'}
      </section>

      <section class="enterprise-card">
        <div class="enterprise-section-head">
          <h2>REVIEW & SUBMISSION</h2>
          <p class="section-hint">Ensure the information is accurate. You will submit this report for Risk Management Officer review.</p>
        </div>

        <form method="post" action="/supervisor/tickets/new/preview/${escapeHtml(ticket.reference)}/submit" class="submit-report-form" id="submitForm">
          <div class="review-confirm">
            <label class="confirm-check">
              <input type="checkbox" id="confirmBox" name="confirmBox" value="1" required>
              <span>I confirm that the information provided is accurate.</span>
            </label>
            <div class="review-note text-muted">Ticket: <span class="mono">${escapeHtml(ticket.reference)}</span></div>
          </div>

          <div class="enterprise-actions enterprise-actions--split">
            <a href="/supervisor/tickets/${escapeHtml(ticket.reference)}/edit" class="btn-enterprise-outline">Edit draft</a>
            <button type="submit" class="btn-enterprise-primary btn-enterprise-submit" id="submitBtn" disabled>
              Submit Report
            </button>
          </div>
        </form>

        <div class="enterprise-actions enterprise-actions--draft-save">
          <form method="post" action="/supervisor/tickets/new/preview/${escapeHtml(ticket.reference)}/save" class="inline-form">
            <button type="submit" class="btn-enterprise-outline">Save Draft</button>
          </form>
        </div>
      </section>
    </div>

    <script>
      (function () {
        const confirmBox = document.getElementById('confirmBox');
        const submitBtn = document.getElementById('submitBtn');
        const submitForm = document.getElementById('submitForm');

        function update() {
          submitBtn.disabled = !confirmBox.checked;
        }
        confirmBox.addEventListener('change', update);
        update();
      })();
    </script>
  `;

  return appLayout({
    title: 'AI Summary Preview',
    user,
    activeNav: 'new',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

function actionsPage(user, tickets, flash) {
  const rows = ticketTableRows(tickets);
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

  return appLayout({
    title: 'Action required',
    user,
    activeNav: 'actions',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
}

function accomplishmentsPage(user, accomplishments, flash) {
  const rows = accomplishments
    .map(
      (a) => `<tr>
        <td class="mono nowrap">${escapeHtml(a.ticketRef)}</td>
        <td>${escapeHtml(a.ticketTitle)}</td>
        <td>${escapeHtml(a.summary)}</td>
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

  return appLayout({
    title: 'Accomplishments',
    user,
    activeNav: 'accomplishments',
    body,
    wide: true,
    navVariant: 'supervisor',
  });
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
