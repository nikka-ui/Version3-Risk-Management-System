const { escapeHtml, formatDate } = require('../html');

/**
 * Shared evidence attachment list for ticket detail pages (all roles).
 * @param {object} ticket
 * @param {{ attachmentBasePath: string, compact?: boolean }} opts
 */
function evidenceSection(ticket, { attachmentBasePath, compact = false, theme = 'default' } = {}) {
  const isConsole = theme === 'console';
  const cardClass = isConsole
    ? `sup-card${compact ? ' sup-card--compact' : ''}`
    : `card${compact ? ' card--compact' : ''}`;
  const headClass = isConsole ? 'sup-card__head' : '';
  const bodyClass = isConsole ? 'sup-card__body' : '';
  const items = ticket?.evidence || [];
  if (!items.length) {
    return `<section class="${cardClass}">
      ${isConsole ? '<div class="sup-card__head"><h2>Evidence</h2></div><div class="sup-card__body">' : '<h2>Evidence</h2>'}
      <p class="text-muted">No evidence uploaded.</p>
      ${isConsole ? '</div>' : ''}
    </section>`;
  }

  const rows = items
    .map((e) => {
      const name = escapeHtml(e.name || e.originalName || 'File');
      const sizeMb = e.size ? `${(e.size / 1024 / 1024).toFixed(1)} MB` : '—';
      const uploaded = escapeHtml(formatDate(e.uploadedAt));
      const viewable = Boolean(e.id && (e.storageKey || !e.legacy));
      const viewBtn = viewable
        ? `<a href="${attachmentBasePath}/${escapeHtml(e.id)}" target="_blank" rel="noopener" class="sup-btn-outline sup-btn-outline--sm">View</a>`
        : '<span class="text-muted" title="Reference only — no file stored">—</span>';
      const fileCell = viewable
        ? `<a href="${attachmentBasePath}/${escapeHtml(e.id)}" target="_blank" rel="noopener">${name}</a>`
        : name;

      if (compact) {
        return `<tr>
          <td class="evidence-name" title="${name}">${fileCell}</td>
          <td class="nowrap text-muted">${uploaded}</td>
          <td class="nowrap text-muted">${sizeMb}</td>
          <td class="col-actions">${viewBtn}</td>
        </tr>`;
      }

      return `<li>${fileCell} <span class="text-muted">(${uploaded}${e.size ? ` · ${sizeMb}` : ''})</span></li>`;
    })
    .join('');

  if (compact || isConsole) {
    return `<section class="${cardClass}">
      <div class="${headClass || 'sup-card__head'}"><h2>Evidence <span class="text-muted">(${items.length})</span></h2></div>
      <div class="${bodyClass || 'sup-card__body'}">
        <div class="table-wrap">
          <table class="data-table data-table--compact evidence-table sup-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Uploaded</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
  }

  return `<section class="${cardClass}">
    <h2>Evidence <span class="text-muted">(${items.length})</span></h2>
    <ul class="evidence-list">${rows}</ul>
  </section>`;
}

module.exports = { evidenceSection };
