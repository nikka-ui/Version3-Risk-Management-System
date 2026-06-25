const { getCategoryLabel, getStatusLabel, getStatusTone, RISK_CATEGORIES } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { flashMessage, executiveCommentsSection } = require('./layout');
const { executiveAppLayout } = require('./executive-layout');
const { evidenceSection } = require('./evidence');
const { supPageHead, supTicketHead, supQuickActions, supDetailCard } = require('./console-ui');

const EXEC_TABLE_HEAD = `<tr>
  <th>Reference</th>
  <th>Title</th>
  <th>Level</th>
  <th>Category</th>
  <th>Department</th>
  <th>Status</th>
  <th>Updated</th>
</tr>`;

function riskLevelBadge(riskLevelId, label) {
  const id = riskLevelId || 'low';
  const text = label || 'Low';
  return `<span class="risk-badge risk-badge--${escapeHtml(id)}">${escapeHtml(text)}</span>`;
}

function statusPill(status, overdue) {
  const tone = overdue ? 'bad' : getStatusTone(status);
  return `<span class="pill pill--${tone}">${escapeHtml(getStatusLabel(status))}</span>`;
}

function ticketTableRows(tickets, { linkPrefix = '/executive/tickets/', highlightCritical = false } = {}) {
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

function execTableCard({ title, linkHref, linkLabel, rows, emptyMessage, showHead = true }) {
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
        <thead>${EXEC_TABLE_HEAD}</thead>
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

function ticketReadonlySections(ticket) {
  const t = ticket;
  const riskLevel = t.ai?.riskLevel || { id: t.riskLevel, label: t.riskLevelLabel };

  const aiInner = t.ai
    ? `<p class="sup-muted-block">${escapeHtml(t.ai.summary)}</p>
        <dl class="detail-dl detail-dl--console">
          <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel.id, riskLevel.label)}</dd>
          <dt>Likelihood</dt><dd>${t.ai.likelihood || t.likelihood}/5</dd>
          <dt>Impact</dt><dd>${t.ai.impact || t.impact}/5</dd>
          <dt>Confidence</dt><dd>${Math.round((t.ai.confidence || 0) * 100)}%</dd>
        </dl>`
    : '<p class="sup-muted-block">No AI classification available.</p>';

  const solutionInner = t.officerNotes
    ? `<p>${escapeHtml(t.officerNotes)}</p>
        ${t.mitigationDueAt ? `<p class="sup-muted-block">Implementation due: ${escapeHtml(formatDate(t.mitigationDueAt))}</p>` : ''}`
    : '';

  const detailInner = `<dl class="detail-dl detail-dl--console">
      <dt>Submitted by</dt><dd>${escapeHtml(t.submittedByName || t.submittedBy)} (${escapeHtml(t.department)})</dd>
      <dt>Location</dt><dd>${escapeHtml(t.location || '—')}</dd>
      <dt>Category</dt><dd>${escapeHtml(getCategoryLabel(t.category))}</dd>
      <dt>Risk level</dt><dd>${riskLevelBadge(riskLevel?.id || t.riskLevel, riskLevel?.label || t.riskLevelLabel)}</dd>
      <dt>Likelihood × Impact</dt><dd>${t.likelihood} × ${t.impact} (${t.riskScore || t.likelihood * t.impact})</dd>
      <dt>Status</dt><dd>${statusPill(t.status, t.isOverdue)}</dd>
      <dt>Submitted</dt><dd>${escapeHtml(formatDate(t.submittedAt || t.createdAt))}</dd>
    </dl>
    <p class="sup-detail-desc">${escapeHtml(t.description || '—')}</p>`;

  return `<div class="sup-detail-stack">
    ${supDetailCard('Risk details', detailInner)}
    ${supDetailCard('5W1H report', fiveW1HReadonly(t))}
    ${evidenceSection(t, { attachmentBasePath: '/executive/attachments', theme: 'console', interactive: true })}
    ${supDetailCard('AI classification', aiInner, { compact: true })}
    ${t.officerNotes ? supDetailCard('RMO mitigation solution', solutionInner, { accent: true }) : ''}
  </div>`;
}

const KPI_ICONS = {
  /* Low — calm / within tolerance */
  low: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>`,
  /* Moderate — middle of the scale */
  moderate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none"/></svg>`,
  /* High — elevated / rising */
  high: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16l4-4 3 2 5-7"/><path d="M15 7h4v4"/></svg>`,
  /* Critical — requires immediate attention */
  critical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none"/></svg>`,
  total: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  closed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7l-9 9-4-4"/></svg>`,
};

function levelKpiCard(id, label, count, variant = '') {
  return `<a href="/executive/tickets?level=${id}" class="sup-kpi sup-kpi--risk sup-kpi--risk-${id}${variant ? ` ${variant}` : ''}">
    <span class="sup-kpi__icon">${KPI_ICONS[id] || KPI_ICONS.low}</span>
    <span class="sup-kpi__body">
      <span class="sup-kpi__value">${count}</span>
      <span class="sup-kpi__label">${escapeHtml(label)}</span>
    </span>
  </a>`;
}

function statKpi(icon, value, label) {
  return `<div class="sup-kpi">
    <span class="sup-kpi__icon">${icon}</span>
    <span class="sup-kpi__body">
      <span class="sup-kpi__value">${value}</span>
      <span class="sup-kpi__label">${escapeHtml(label)}</span>
    </span>
  </div>`;
}

function executivePage({ title, user, activeNav, body, stats = {} }) {
  return executiveAppLayout({ title, user, activeNav, body, stats });
}

function levelFilterPills(activeLevel) {
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
      const cls = activeLevel === l.id ? 'filter-pill active' : 'filter-pill';
      return `<a href="${href}" class="${cls}">${escapeHtml(l.label)}</a>`;
    })
    .join('');
}

function categoryFilterPills(activeCategory, activeLevel) {
  const levelParam = activeLevel ? `&level=${encodeURIComponent(activeLevel)}` : '';
  const chips = [{ id: '', label: 'All categories' }, ...RISK_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];
  return chips
    .map((c) => {
      const href = c.id
        ? `/executive/tickets?category=${c.id}${levelParam}`
        : `/executive/tickets${activeLevel ? `?level=${activeLevel}` : ''}`;
      const cls = activeCategory === c.id ? 'filter-pill active' : 'filter-pill';
      return `<a href="${href}" class="${cls}">${escapeHtml(c.label)}</a>`;
    })
    .join('');
}

function executiveOverviewPage(user, stats, flash) {
  const categoryRows = RISK_CATEGORIES.map((c) => {
    const count = stats.byCategory[c.id] || 0;
    return `<tr>
      <td>${escapeHtml(c.label)}</td>
      <td class="mono">${count}</td>
      <td><a href="/executive/tickets?category=${c.id}" class="sup-link">View reports</a></td>
    </tr>`;
  }).join('');

  const criticalRows = ticketTableRows(stats.criticalTickets, { highlightCritical: true });
  const criticalSection = stats.criticalCount
    ? execTableCard({
        title: 'Critical risks requiring attention',
        linkHref: '/executive/critical',
        linkLabel: 'View all critical',
        rows: criticalRows,
        emptyMessage: 'No critical risk reports.',
      })
    : `<section class="sup-card sup-card--critical-empty">
        <div class="sup-card__head"><h2>Critical risks</h2></div>
        <div class="sup-card__body">
          <div class="exec-empty-state" role="status" aria-live="polite">
            <span class="exec-empty-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <line x1="12" y1="8" x2="12" y2="13"/>
                <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none"/>
              </svg>
            </span>
            <div class="exec-empty-state__content">
              <p class="exec-empty-state__title">No critical risks right now</p>
              <p class="sup-muted-block">No Extreme/Critical risk reports at this time. Critical items will appear here automatically when identified.</p>
            </div>
          </div>
        </div>
      </section>`;

  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Executive dashboard',
      desc: 'Monitor organization-wide risk reports by level and category. Critical risks are highlighted for immediate attention.',
      actionHtml: '<a href="/executive/tickets" class="sup-btn-primary">View all reports</a>',
    })}
    <div class="sup-kpi-grid sup-kpi-grid--levels">
      ${levelKpiCard('low', 'Low', stats.byLevel.low)}
      ${levelKpiCard('moderate', 'Moderate', stats.byLevel.moderate)}
      ${levelKpiCard('high', 'High', stats.byLevel.high)}
      ${levelKpiCard('critical', 'Critical', stats.byLevel.critical, stats.byLevel.critical ? 'sup-kpi--warn' : '')}
    </div>
    <div class="sup-kpi-grid sup-kpi-grid--stats">
      ${statKpi(KPI_ICONS.total, stats.total, 'Total reports')}
      ${statKpi(KPI_ICONS.open, stats.open, 'Open')}
      ${statKpi(KPI_ICONS.closed, stats.closed, 'Closed')}
    </div>
    ${supQuickActions([
      { href: '/executive/tickets', label: 'All reports', count: stats.total },
      { href: '/executive/critical', label: 'Critical risks', count: stats.criticalCount },
      { href: '/executive/tickets?level=high', label: 'High risks', count: stats.byLevel.high },
    ])}
    ${criticalSection}
    <section class="sup-card sup-card--table" style="margin-top:0.875rem">
      <div class="sup-card__head"><h2>Reports by category</h2></div>
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table">
          <thead><tr><th>Category</th><th>Count</th><th></th></tr></thead>
          <tbody>${categoryRows}</tbody>
        </table>
      </div>
    </section>`;

  return executivePage({
    title: 'Executive dashboard',
    user,
    activeNav: 'overview',
    body,
    stats,
  });
}

function ticketsListPage(user, { title, desc, tickets, flash, error, activeNav, emptyMessage, filters = {}, stats = {} }) {
  const rows = ticketTableRows(tickets, { highlightCritical: true });
  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supPageHead({ title, desc })}
    <div class="console-filter-group">
      <span class="console-filter-label">Risk level</span>
      <div class="ticket-filters console-quick-actions console-quick-actions--inline">${levelFilterPills(filters.level || '')}</div>
    </div>
    <div class="console-filter-group">
      <span class="console-filter-label">Category</span>
      <div class="ticket-filters console-quick-actions console-quick-actions--inline">${categoryFilterPills(filters.category || '', filters.level || '')}</div>
    </div>
    ${execTableCard({ rows, emptyMessage, showHead: false })}`;

  return executivePage({ title, user, activeNav, body, stats });
}

function allTicketsPage(user, tickets, flash, filters = {}, stats = {}) {
  return ticketsListPage(user, {
    title: 'All risk reports',
    desc: 'Organization-wide risk reports sorted from Low to Critical. Use filters to narrow by level or category.',
    tickets,
    flash,
    activeNav: 'tickets',
    emptyMessage: 'No risk reports match your filters.',
    filters,
    stats,
  });
}

function criticalTicketsPage(user, tickets, flash, stats = {}) {
  return ticketsListPage(user, {
    title: 'Critical risks',
    desc: 'Extreme/Critical risk reports requiring executive oversight.',
    tickets,
    flash,
    activeNav: 'critical',
    emptyMessage: 'No critical risk reports at this time.',
    filters: { level: 'critical' },
    stats,
  });
}

function ticketDetailPage(user, ticket, { flash, error, stats = {} } = {}) {
  const t = ticket;
  const ref = t.reference;
  const riskLevel = t.ai?.riskLevel || { id: t.riskLevel, label: t.riskLevelLabel };
  const isCritical = (riskLevel?.id || t.riskLevel) === 'critical';
  const statusHtml = `${riskLevelBadge(riskLevel?.id || t.riskLevel, riskLevel?.label || t.riskLevelLabel)} · ${statusPill(t.status, t.isOverdue)}`;

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml,
      backHref: '/executive/tickets',
      backLabel: 'Back to all reports',
    })}
    ${isCritical ? '<div class="critical-banner" role="status">Critical risk — highlighted for executive oversight</div>' : ''}
    ${ticketReadonlySections(t)}
    <div class="sup-detail-stack sup-detail-stack--comments">
      ${executiveCommentsSection(t.executiveComments, {
        postAction: `/executive/tickets/${escapeHtml(ref)}/comment`,
        canPost: true,
      })}
    </div>`;

  return executivePage({
    title: ref,
    user,
    activeNav: 'tickets',
    body,
    stats,
  });
}

module.exports = {
  executiveOverviewPage,
  allTicketsPage,
  criticalTicketsPage,
  ticketDetailPage,
};
