const { getCategoryLabel, getStatusLabel, getStatusTone, RISK_CATEGORIES } = require('../../config/tickets');
const { escapeHtml, formatDate } = require('../html');
const { matrixCellTier } = require('../tickets');
const { flashMessage, executiveCommentsSection } = require('./layout');
const { executiveAppLayout } = require('./executive-layout');
const { layoutNotifications } = require('../notifications');
const { evidenceSection } = require('./evidence');
const { supPageHead, supTicketHead, supQuickActions, supDetailCard } = require('./console-ui');

const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];
const LIKELIHOOD_LABELS = ['Almost certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];

function riskMatrixGrid(matrix) {
  const header = `<div class="rm-matrix__corner"></div>
    ${IMPACT_LABELS.map((l) => `<div class="rm-matrix__col-head">${escapeHtml(l)}</div>`).join('')}`;

  const rows = matrix
    .map((row, rowIdx) => {
      const likelihood = 5 - rowIdx;
      const rowHead = `<div class="rm-matrix__row-head">${escapeHtml(LIKELIHOOD_LABELS[rowIdx])}</div>`;
      const cells = row
        .map((count, colIdx) => {
          const impact = colIdx + 1;
          const tier = matrixCellTier(likelihood, impact);
          return `<div class="rm-matrix__cell rm-matrix__cell--${tier}" title="Likelihood ${likelihood} × Impact ${impact}">
            <span class="rm-matrix__count">${count || ''}</span>
          </div>`;
        })
        .join('');
      return rowHead + cells;
    })
    .join('');

  return `<div class="rm-matrix" role="img" aria-label="Risk heatmap by likelihood and impact">
    <div class="rm-matrix__axis rm-matrix__axis--x">Impact →</div>
    <div class="rm-matrix__axis rm-matrix__axis--y">Likelihood →</div>
    <div class="rm-matrix__grid">${header}${rows}</div>
    <div class="rm-matrix__legend">
      <span class="rm-matrix__legend-item rm-matrix__legend-item--low">Low</span>
      <span class="rm-matrix__legend-item rm-matrix__legend-item--moderate">Moderate</span>
      <span class="rm-matrix__legend-item rm-matrix__legend-item--high">High</span>
      <span class="rm-matrix__legend-item rm-matrix__legend-item--critical">Critical</span>
    </div>
  </div>`;
}

function trendChart(trends) {
  const max = Math.max(1, ...trends.map((m) => m.count));
  const bars = trends
    .map((m) => {
      const height = Math.round((m.count / max) * 100);
      const hcHeight = m.count ? Math.round((m.highCritical / m.count) * height) : 0;
      return `<div class="exec-trend-bar" title="${escapeHtml(m.label)}: ${m.count} total, ${m.highCritical} high/critical">
        <div class="exec-trend-bar__stack" style="height:${height}%">
          <span class="exec-trend-bar__segment exec-trend-bar__segment--hc" style="height:${hcHeight}%"></span>
          <span class="exec-trend-bar__segment exec-trend-bar__segment--other" style="height:${height - hcHeight}%"></span>
        </div>
        <span class="exec-trend-bar__label">${escapeHtml(m.label)}</span>
        <span class="exec-trend-bar__value">${m.count}</span>
      </div>`;
    })
    .join('');

  return `<div class="exec-trend-chart" role="img" aria-label="Monthly risk report trends">
    <div class="exec-trend-chart__bars">${bars}</div>
    <div class="exec-trend-chart__legend">
      <span class="exec-trend-chart__legend-item exec-trend-chart__legend-item--hc">High / Critical</span>
      <span class="exec-trend-chart__legend-item exec-trend-chart__legend-item--other">Other levels</span>
    </div>
  </div>`;
}

function departmentTableRows(departments) {
  return departments
    .map(
      (d) => `<tr>
        <td>${escapeHtml(d.name)}</td>
        <td class="mono">${d.total}</td>
        <td class="mono">${d.open}</td>
        <td class="mono">${d.closed}</td>
        <td class="mono">${d.high}</td>
        <td class="mono">${d.critical}</td>
        <td class="mono">${d.overdue}</td>
      </tr>`,
    )
    .join('');
}

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
  return `<a href="/executive/register?level=${id}" class="sup-kpi sup-kpi--risk sup-kpi--risk-${id}${variant ? ` ${variant}` : ''}">
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

function executivePage({ title, user, activeNav, body, stats = {}, notifications }) {
  return executiveAppLayout({
    title,
    user,
    activeNav,
    body,
    stats,
    notifications: notifications || layoutNotifications(user),
  });
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
      const href = l.id ? `/executive/register?level=${l.id}` : '/executive/register';
      const tone = l.id ? `filter-pill--level filter-pill--level-${l.id}` : 'filter-pill--all';
      const active = activeLevel === l.id ? ' active' : '';
      const dot = l.id ? '<span class="filter-pill__dot" aria-hidden="true"></span>' : '';
      return `<a href="${href}" class="filter-pill ${tone}${active}">${dot}${escapeHtml(l.label)}</a>`;
    })
    .join('');
}

function categoryFilterPills(activeCategory, activeLevel) {
  const levelParam = activeLevel ? `&level=${encodeURIComponent(activeLevel)}` : '';
  const chips = [{ id: '', label: 'All categories' }, ...RISK_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];
  return chips
    .map((c) => {
      const href = c.id
        ? `/executive/register?category=${c.id}${levelParam}`
        : `/executive/register${activeLevel ? `?level=${activeLevel}` : ''}`;
      const cls = activeCategory === c.id ? 'filter-pill active' : 'filter-pill';
      return `<a href="${href}" class="${cls}">${escapeHtml(c.label)}</a>`;
    })
    .join('');
}

function executiveOverviewPage(user, dashboard, flash) {
  const { stats } = dashboard;
  const categoryRows = RISK_CATEGORIES.map((c) => {
    const count = stats.byCategory[c.id] || 0;
    return `<tr>
      <td>${escapeHtml(c.label)}</td>
      <td class="mono">${count}</td>
      <td><a href="/executive/register?category=${c.id}" class="sup-link">View in register</a></td>
    </tr>`;
  }).join('');

  const highCriticalRows = ticketTableRows(stats.highCriticalTickets.slice(0, 8), { highlightCritical: true });
  const highCriticalSection = stats.highCriticalCount
    ? execTableCard({
        title: 'High & Critical risks',
        linkHref: '/executive/register?level=high',
        linkLabel: 'View all high/critical',
        rows: highCriticalRows,
        emptyMessage: 'No high or critical risk reports.',
      })
    : '';

  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Dashboard',
      desc: 'View-only oversight of organization-wide risks. You may comment on High and Critical reports only — you cannot approve, reject, transfer, or close tickets.',
      actionHtml: '<a href="/executive/register" class="sup-btn-primary">Open risk register</a>',
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
      { href: '/executive/heatmap', label: 'Heatmap', count: stats.total },
      { href: '/executive/register', label: 'Risk register', count: stats.total },
      { href: '/executive/reports', label: 'Reports', count: stats.highCriticalCount },
      { href: '/executive/trends', label: 'Trends', count: null },
      { href: '/executive/statistics', label: 'Statistics', count: stats.open },
      { href: '/executive/departments', label: 'Dept performance', count: dashboard.departments.length },
    ])}
    ${highCriticalSection}
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
    title: 'Dashboard',
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
    title: 'Risk Register',
    desc: 'Organization-wide risk register (view only). Sorted from Low to Critical — use filters to narrow by level or category.',
    tickets,
    flash,
    activeNav: 'register',
    emptyMessage: 'No risk reports match your filters.',
    filters,
    stats,
  });
}

function criticalTicketsPage(user, tickets, flash, stats = {}) {
  return ticketsListPage(user, {
    title: 'Critical risks',
    desc: 'Extreme/Critical risk reports. You may post oversight comments on High and Critical reports.',
    tickets,
    flash,
    activeNav: 'register',
    emptyMessage: 'No critical risk reports at this time.',
    filters: { level: 'critical' },
    stats,
  });
}

function heatmapPage(user, dashboard, flash) {
  const { stats, matrix } = dashboard;
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Heatmap',
      desc: 'Likelihood × impact matrix showing the concentration of reported risks across the organization.',
    })}
    <section class="sup-card">
      <div class="sup-card__head"><h2>Organization risk heatmap</h2></div>
      <div class="sup-card__body">${riskMatrixGrid(matrix)}</div>
    </section>`;

  return executivePage({ title: 'Heatmap', user, activeNav: 'heatmap', body, stats });
}

function reportsPage(user, dashboard, flash) {
  const { stats } = dashboard;
  const levelRows = ['low', 'moderate', 'high', 'critical']
    .map(
      (id) => `<tr>
        <td>${riskLevelBadge(id, id === 'critical' ? 'Extreme/Critical' : id.charAt(0).toUpperCase() + id.slice(1))}</td>
        <td class="mono">${stats.byLevel[id] || 0}</td>
        <td><a href="/executive/register?level=${id}" class="sup-link">View</a></td>
      </tr>`,
    )
    .join('');

  const categoryRows = RISK_CATEGORIES.map((c) => {
    const count = stats.byCategory[c.id] || 0;
    return `<tr>
      <td>${escapeHtml(c.label)}</td>
      <td class="mono">${count}</td>
      <td><a href="/executive/register?category=${c.id}" class="sup-link">View</a></td>
    </tr>`;
  }).join('');

  const recentRows = ticketTableRows(stats.highCriticalTickets.slice(0, 15), { highlightCritical: true });

  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Reports',
      desc: 'Summary reports by risk level and category. High and Critical items are prioritized for executive oversight.',
    })}
    <div class="sup-detail-stack">
      <section class="sup-card sup-card--table">
        <div class="sup-card__head"><h2>By risk level</h2></div>
        <div class="table-wrap">
          <table class="data-table data-table--compact sup-table">
            <thead><tr><th>Level</th><th>Count</th><th></th></tr></thead>
            <tbody>${levelRows}</tbody>
          </table>
        </div>
      </section>
      <section class="sup-card sup-card--table">
        <div class="sup-card__head"><h2>By category</h2></div>
        <div class="table-wrap">
          <table class="data-table data-table--compact sup-table">
            <thead><tr><th>Category</th><th>Count</th><th></th></tr></thead>
            <tbody>${categoryRows}</tbody>
          </table>
        </div>
      </section>
    </div>
    ${execTableCard({
      title: 'Recent High & Critical reports',
      linkHref: '/executive/register?level=high',
      linkLabel: 'View all',
      rows: recentRows,
      emptyMessage: 'No high or critical risk reports.',
    })}`;

  return executivePage({ title: 'Reports', user, activeNav: 'reports', body, stats });
}

function trendsPage(user, dashboard, flash) {
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

  return executivePage({ title: 'Trends', user, activeNav: 'trends', body, stats });
}

function statisticsPage(user, dashboard, flash) {
  const { stats, byStatus } = dashboard;
  const statusRows = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([status, count]) => `<tr>
        <td>${statusPill(status, false)}</td>
        <td class="mono">${count}</td>
      </tr>`,
    )
    .join('');

  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Statistics',
      desc: 'Organization-wide risk statistics. This view is read-only.',
    })}
    <div class="sup-kpi-grid sup-kpi-grid--levels">
      ${levelKpiCard('low', 'Low', stats.byLevel.low)}
      ${levelKpiCard('moderate', 'Moderate', stats.byLevel.moderate)}
      ${levelKpiCard('high', 'High', stats.byLevel.high)}
      ${levelKpiCard('critical', 'Critical', stats.byLevel.critical)}
    </div>
    <div class="sup-kpi-grid sup-kpi-grid--stats">
      ${statKpi(KPI_ICONS.total, stats.total, 'Total reports')}
      ${statKpi(KPI_ICONS.open, stats.open, 'Open')}
      ${statKpi(KPI_ICONS.closed, stats.closed, 'Closed')}
      ${statKpi(KPI_ICONS.high, stats.highCriticalCount, 'High / Critical')}
    </div>
    <section class="sup-card sup-card--table">
      <div class="sup-card__head"><h2>By workflow status</h2></div>
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table">
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>${statusRows || '<tr><td colspan="2" class="empty">No data.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return executivePage({ title: 'Statistics', user, activeNav: 'statistics', body, stats });
}

function departmentPerformancePage(user, dashboard, flash) {
  const { stats, departments } = dashboard;
  const rows = departmentTableRows(departments);
  const body = `
    ${flashMessage(flash)}
    ${supPageHead({
      title: 'Department Performance',
      desc: 'Risk report volume and outcomes by responsible department. View only — no transfer or closure actions.',
    })}
    <section class="sup-card sup-card--table">
      <div class="table-wrap">
        <table class="data-table data-table--compact sup-table">
          <thead><tr>
            <th>Department</th>
            <th>Total</th>
            <th>Open</th>
            <th>Closed</th>
            <th>High</th>
            <th>Critical</th>
            <th>Overdue</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="empty">No department data yet.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  return executivePage({ title: 'Department Performance', user, activeNav: 'departments', body, stats });
}

function ticketDetailPage(user, ticket, { flash, error, stats = {} } = {}) {
  const t = ticket;
  const ref = t.reference;
  const riskLevel = t.ai?.riskLevel || { id: t.riskLevel, label: t.riskLevelLabel };
  const riskLevelId = riskLevel?.id || t.riskLevel;
  const isHighCritical = riskLevelId === 'high' || riskLevelId === 'critical';
  const isCritical = riskLevelId === 'critical';
  const statusHtml = `${riskLevelBadge(riskLevelId, riskLevel?.label || t.riskLevelLabel)} · ${statusPill(t.status, t.isOverdue)}`;

  const commentBlock = isHighCritical
    ? executiveCommentsSection(t.executiveComments, {
        postAction: `/executive/tickets/${escapeHtml(ref)}/comment`,
        canPost: true,
      })
    : `${executiveCommentsSection(t.executiveComments, { canPost: false })}
       <p class="sup-muted-block exec-view-only-hint">View only — Executive Committee may comment on High and Critical risks only. Approve, reject, transfer, and close actions are not available for this role.</p>`;

  const body = `
    ${flashMessage(flash)}
    ${error ? flashMessage(error, 'error') : ''}
    ${supTicketHead({
      title: t.title,
      ref,
      statusHtml,
      backHref: '/executive/register',
      backLabel: 'Back to risk register',
    })}
    ${isCritical ? '<div class="critical-banner" role="status">Critical risk — you may post an oversight comment on this report</div>' : ''}
    ${isHighCritical && !isCritical ? '<div class="critical-banner critical-banner--high" role="status">High risk — you may post an oversight comment on this report</div>' : ''}
    ${ticketReadonlySections(t)}
    <div class="sup-detail-stack sup-detail-stack--comments">
      ${commentBlock}
    </div>`;

  return executivePage({
    title: ref,
    user,
    activeNav: 'register',
    body,
    stats,
  });
}

module.exports = {
  executiveOverviewPage,
  allTicketsPage,
  criticalTicketsPage,
  ticketDetailPage,
  heatmapPage,
  reportsPage,
  trendsPage,
  statisticsPage,
  departmentPerformancePage,
};
