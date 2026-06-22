const { escapeHtml } = require('../html');

function supPageHead({ title, desc, actionHtml = '' }) {
  return `<div class="sup-page-head">
    <div>
      <h1>${escapeHtml(title)}</h1>
      ${desc ? `<p class="sup-page-desc">${escapeHtml(desc)}</p>` : ''}
    </div>
    ${actionHtml}
  </div>`;
}

function supTicketHead({ title, ref, statusHtml, backHref, backLabel }) {
  return `<div class="sup-page-head sup-page-head--ticket">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <p class="sup-page-desc"><span class="mono">${escapeHtml(ref)}</span> · ${statusHtml}</p>
    </div>
    <a href="${backHref}" class="sup-btn-outline">${escapeHtml(backLabel)}</a>
  </div>`;
}

function supQuickActions(actions) {
  if (!actions?.length) return '';
  return `<div class="ticket-filters console-quick-actions" aria-label="Quick actions">
    ${actions
      .map(
        (a) =>
          `<a href="${a.href}" class="filter-pill">${escapeHtml(a.label)}${
            a.count != null ? ` <span class="filter-pill__count">${a.count}</span>` : ''
          }</a>`,
      )
      .join('')}
  </div>`;
}

const TICKET_TABLE_HEAD = `<tr>
  <th>Reference</th>
  <th>Title</th>
  <th>Submitter</th>
  <th>Department</th>
  <th>Category</th>
  <th>Status</th>
  <th>Updated</th>
</tr>`;

function supTableCard({ title, linkHref, linkLabel, rows, emptyMessage, showHead = true }) {
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
        <thead>${TICKET_TABLE_HEAD}</thead>
        <tbody>${rows || `<tr><td colspan="7" class="empty">${emptyMessage}</td></tr>`}</tbody>
      </table>
    </div>
  </section>`;
}

function supDetailCard(title, innerHtml, { accent = false, compact = false } = {}) {
  const cls = ['sup-card', accent ? 'sup-card--accent' : '', compact ? 'sup-card--compact' : '']
    .filter(Boolean)
    .join(' ');
  return `<section class="${cls}">
    <div class="sup-card__head"><h2>${title}</h2></div>
    <div class="sup-card__body">${innerHtml}</div>
  </section>`;
}

function supDecisionPanel({ title, desc, bodyHtml }) {
  return `<section class="sup-card sup-card--decision">
    <div class="sup-card__head"><h2>${escapeHtml(title)}</h2></div>
    <div class="sup-card__body">
      ${desc ? `<p class="sup-muted-block">${escapeHtml(desc)}</p>` : ''}
      ${bodyHtml}
    </div>
  </section>`;
}

module.exports = {
  supPageHead,
  supTicketHead,
  supQuickActions,
  supTableCard,
  supDetailCard,
  supDecisionPanel,
  TICKET_TABLE_HEAD,
};
