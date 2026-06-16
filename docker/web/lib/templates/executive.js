const { getCategoryLabel, getStatusLabel, RISK_CATEGORIES } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { appLayout, flashMessage, executiveCommentsSection } = require('./layout');

function riskLevelBadge(riskLevelId, label) {
  const id = riskLevelId || 'low';
  const text = label || 'Low';
  return `<span class="risk-badge risk-badge--${escapeHtml(id)}">${escapeHtml(text)}</span>`;
}

function statusPill(status) {
  return `<span class="pill">${escapeHtml(getStatusLabel(status))}</span>`;
}

function ticketTableRows(tickets, { linkPrefix = '/executive/tickets/', highlightCritical = false } = {}) {
  return tickets
    .map((t) => {
      const rowCls = highlightCritical && t.riskLevel === 'critical' ? ' class="row--critical"' : '';
      return `<tr${rowCls}>
        <td class="mono nowrap"><a href="${linkPrefix}${escapeHtml(t.reference)}">${escapeHtml(t.reference)}</a></td>
        <td>${escapeHtml(t.title)}</td>
        <td class="nowrap">${riskLevelBadge(t.riskLevel, t.riskLevelLabel)}</td>
        <td class="nowrap">${escapeHtml(t.categoryLabel)}</td>
        <td class="nowrap">${escapeHtml(t.department)}</td>
        <td>${statusPill(t.status)}</td>
        <td class="nowrap">${escapeHtml(formatDate(t.updatedAt))}</td>
      </tr>`;
    })
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
  const riskLevel = t.ai?.riskLevel || { id: t.riskLevel, label: t.riskLevelLabel };
  const aiBlock = t.ai
    ? `<section class="card card--ai">
        <h2>AI classification</h2>
        <p class="text-muted">${escapeHtml(t.ai.summary)}</p>
        <dl class="detail-dl">
          <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel.id, riskLevel.label)}</dd>
          <dt>Likelihood</dt><dd>${t.ai.likelihood || t.likelihood}/5</dd>
          <dt>Impact</dt><dd>${t.ai.impact || t.impact}/5</dd>
          <dt>Confidence</dt><dd>${Math.round((t.ai.confidence || 0) * 100)}%</dd>
        </dl>
      </section>`
    : '';

  const evidenceList = (t.evidence || [])
    .map((e) => {
      const label = e.id
        ? `<a href="/executive/attachments/${escapeHtml(e.id)}" target="_blank" rel="noopener">${escapeHtml(e.name || e.originalName)}</a>`
        : escapeHtml(e.name || '—');
      return `<li>${label} <span class="text-muted">(${escapeHtml(formatDate(e.uploadedAt))})</span></li>`;
    })
    .join('');

  const solutionBlock = t.officerNotes
    ? `<section class="card card--accent">
        <h2>RMO mitigation solution</h2>
        <p>${escapeHtml(t.officerNotes)}</p>
        ${t.mitigationDueAt ? `<p class="text-muted">Implementation due: ${escapeHtml(formatDate(t.mitigationDueAt))}</p>` : ''}
      </section>`
    : '';

  return `
    <section class="card">
      <h2>Risk details</h2>
      <dl class="detail-dl">
        <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
        <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
        <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
        <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel?.id || t.riskLevel, riskLevel?.label || t.riskLevelLabel)}</dd>
        <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
        <dt>Status</dt><dd>${statusPill(t.status)}</dd>
        <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
      </dl>
      <p style="margin-top:1rem">${escapeHtml(t.description || '—')}</p>
    </section>
    <section class="card">
      <h2>5W1H</h2>
      ${fiveW1HReadonly(t)}
    </section>
    ${aiBlock}
    <section class="card">
      <h2>Evidence</h2>
      <ul class="evidence-list">${evidenceList || '<li class="text-muted">No evidence uploaded.</li>'}</ul>
    </section>
    ${solutionBlock}`;
}

function levelFilterLinks(activeLevel) {
  const levels = [
    { id: '', label: 'All levels' },
    { id: 'low', label: 'Low' },
    { id: 'moderate', label: 'Moderate' },
    { id: 'high', label: 'High' },
    { id: 'critical', label: 'Critical' },
  ];
  return levels
    .map((l) => {
      const href = l.id ? `/executive/tickets?level=${l.id}` : '/executive/tickets';
      const cls = activeLevel === l.id ? 'filter-chip filter-chip--active' : 'filter-chip';
      return `<a href="${href}" class="${cls}">${escapeHtml(l.label)}</a>`;
    })
    .join('');
}

function categoryFilterLinks(activeCategory, activeLevel) {
  const levelParam = activeLevel ? `&level=${encodeURIComponent(activeLevel)}` : '';
  const chips = [
    { id: '', label: 'All categories' },
    ...RISK_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];
  return chips
    .map((c) => {
      const href = c.id
        ? `/executive/tickets?category=${c.id}${levelParam}`
        : `/executive/tickets${activeLevel ? `?level=${activeLevel}` : ''}`;
      const cls = activeCategory === c.id ? 'filter-chip filter-chip--active' : 'filter-chip';
      return `<a href="${href}" class="${cls}">${escapeHtml(c.label)}</a>`;
    })
    .join('');
}

function executiveOverviewPage(user, stats, flash) {
  const levelCards = [
    { id: 'low', label: 'Low', count: stats.byLevel.low },
    { id: 'moderate', label: 'Moderate', count: stats.byLevel.moderate },
    { id: 'high', label: 'High', count: stats.byLevel.high },
    { id: 'critical', label: 'Critical', count: stats.byLevel.critical, highlight: true },
  ]
    .map(
      (l) => `<a href="/executive/tickets?level=${l.id}" class="stat-card stat-card--level stat-card--${l.id}${l.highlight ? ' stat-card--highlight' : ''}">
        <span class="stat-value">${l.count}</span>
        <span class="stat-label">${escapeHtml(l.label)}</span>
      </a>`,
    )
    .join('');

  const categoryRows = RISK_CATEGORIES.map((c) => {
    const count = stats.byCategory[c.id] || 0;
    return `<tr>
      <td>${escapeHtml(c.label)}</td>
      <td class="mono">${count}</td>
      <td><a href="/executive/tickets?category=${c.id}" class="btn-text">View reports</a></td>
    </tr>`;
  }).join('');

  const criticalRows = ticketTableRows(stats.criticalTickets, { highlightCritical: true });
  const criticalSection = stats.criticalCount
    ? `<section class="card card--critical-highlight" style="margin-top:1.5rem">
        <h2>Critical risks requiring attention</h2>
        <p class="text-muted">Extreme/Critical risk reports are highlighted for executive oversight.</p>
        <div class="table-wrap" style="margin-top:1rem">
          <table class="data-table data-table--compact tickets-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Level</th>
                <th>Category</th>
                <th>Department</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>${criticalRows}</tbody>
          </table>
        </div>
        <div class="action-row" style="margin-top:1rem">
          <a href="/executive/critical" class="btn-outline">View all critical risks</a>
        </div>
      </section>`
    : `<section class="card card--critical-highlight card--empty-critical" style="margin-top:1.5rem">
        <h2>Critical risks</h2>
        <p class="text-muted">No Extreme/Critical risk reports at this time.</p>
      </section>`;

  const body = `
    ${flashMessage(flash)}
    <div class="page-head">
      <h1>Executive dashboard</h1>
      <p class="page-desc">Monitor organization-wide risk reports by level and category. Critical risks are highlighted for immediate attention.</p>
    </div>
    <div class="stat-grid stat-grid--levels">
      ${levelCards}
    </div>
    <div class="stat-grid" style="margin-top:1rem">
      <div class="stat-card">
        <span class="stat-value">${stats.total}</span>
        <span class="stat-label">Total reports</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.open}</span>
        <span class="stat-label">Open</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${stats.closed}</span>
        <span class="stat-label">Closed</span>
      </div>
    </div>
    ${criticalSection}
    <section class="card" style="margin-top:1.5rem">
      <h2>Reports by category</h2>
      <div class="table-wrap">
        <table class="data-table data-table--compact">
          <thead>
            <tr><th>Category</th><th>Count</th><th></th></tr>
          </thead>
          <tbody>${categoryRows}</tbody>
        </table>
      </div>
    </section>
    <div class="card" style="margin-top:1.5rem">
      <h2>Quick actions</h2>
      <div class="action-row">
        <a href="/executive/tickets" class="btn-outline">All reports (low → critical)</a>
        <a href="/executive/critical" class="btn-outline">Critical risks (${stats.criticalCount})</a>
      </div>
    </div>`;

  return appLayout({
    title: 'Executive dashboard',
    user,
    activeNav: 'overview',
    body,
    wide: true,
    navVariant: 'executive',
  });
}

function ticketsListPage(user, { title, desc, tickets, flash, error, activeNav, emptyMessage, filters = {} }) {
  const rows = ticketTableRows(tickets, { highlightCritical: true });
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head">
      <h1>${escapeHtml(title)}</h1>
      <p class="page-desc">${escapeHtml(desc)}</p>
    </div>
    <div class="filter-bar">
      <span class="filter-bar__label">Risk level</span>
      <div class="filter-chips">${levelFilterLinks(filters.level || '')}</div>
    </div>
    <div class="filter-bar" style="margin-top:0.75rem">
      <span class="filter-bar__label">Category</span>
      <div class="filter-chips">${categoryFilterLinks(filters.category || '', filters.level || '')}</div>
    </div>
    <section class="card card--table" style="margin-top:1.5rem">
      <div class="table-wrap">
        <table class="data-table data-table--compact tickets-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Title</th>
              <th>Level</th>
              <th>Category</th>
              <th>Department</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="7" class="empty">${emptyMessage}</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

  return appLayout({
    title,
    user,
    activeNav,
    body,
    wide: true,
    navVariant: 'executive',
  });
}

function allTicketsPage(user, tickets, flash, filters = {}) {
  return ticketsListPage(user, {
    title: 'All risk reports',
    desc: 'Organization-wide risk reports sorted from Low to Critical. Use filters to narrow by level or category.',
    tickets,
    flash,
    activeNav: 'tickets',
    emptyMessage: 'No risk reports match your filters.',
    filters,
  });
}

function criticalTicketsPage(user, tickets, flash) {
  return ticketsListPage(user, {
    title: 'Critical risks',
    desc: 'Extreme/Critical risk reports requiring executive oversight.',
    tickets,
    flash,
    activeNav: 'critical',
    emptyMessage: 'No critical risk reports at this time.',
    filters: { level: 'critical' },
  });
}

function ticketDetailPage(user, ticket, { flash, error } = {}) {
  const t = ticket;
  const ref = t.reference;
  const riskLevel = t.ai?.riskLevel || { id: t.riskLevel, label: t.riskLevelLabel };
  const isCritical = (riskLevel?.id || t.riskLevel) === 'critical';

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    <div class="page-head page-head--row">
      <div>
        <h1>${escapeHtml(t.title)}</h1>
        <p class="page-desc">
          <span class="mono">${escapeHtml(ref)}</span> ·
          ${riskLevelBadge(riskLevel?.id || t.riskLevel, riskLevel?.label || t.riskLevelLabel)} ·
          ${statusPill(t.status)}
        </p>
      </div>
      <a href="/executive/tickets" class="btn-outline">Back to all reports</a>
    </div>
    ${isCritical ? '<div class="critical-banner" role="status">Critical risk — highlighted for executive oversight</div>' : ''}
    ${ticketReadonlySections(t)}
    ${executiveCommentsSection(t.executiveComments, {
      postAction: `/executive/tickets/${escapeHtml(ref)}/comment`,
      canPost: true,
    })}`;

  return appLayout({
    title: ref,
    user,
    activeNav: 'tickets',
    body,
    wide: true,
    navVariant: 'executive',
  });
}

module.exports = {
  executiveOverviewPage,
  allTicketsPage,
  criticalTicketsPage,
  ticketDetailPage,
};
