const { escapeHtml, formatDate } = require('../html');

const FILE_ICON = `<svg class="attachment-item__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>`;

const CHEVRON_ICON = `<svg class="attachment-item__chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;

function formatFileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  if (mb < 0.1) return '< 0.1 MB';
  return `${mb.toFixed(1)} MB`;
}

function attachmentRows(items, attachmentBasePath) {
  return items
    .map((e) => {
      const name = escapeHtml(e.name || e.originalName || 'File');
      const sizeLabel = formatFileSize(e.size);
      const uploaded = escapeHtml(formatDate(e.uploadedAt));
      const viewable = Boolean(e.id && (e.storageKey || !e.legacy));
      const meta = [sizeLabel, uploaded].filter(Boolean).join(' · ');

      if (!viewable) {
        return `<li class="attachment-item attachment-item--static">
          <span class="attachment-item__icon">${FILE_ICON}</span>
          <span class="attachment-item__name">${name}</span>
          <span class="attachment-item__meta">Reference only</span>
        </li>`;
      }

      const href = `${attachmentBasePath}/${escapeHtml(e.id)}`;
      return `<li class="attachment-item">
        <a href="${href}" class="attachment-item__link" target="_blank" rel="noopener">
          <span class="attachment-item__icon">${FILE_ICON}</span>
          <span class="attachment-item__name">${name}</span>
          <span class="attachment-item__meta">${escapeHtml(meta)}</span>
          <span class="attachment-item__chevron">${CHEVRON_ICON}</span>
        </a>
      </li>`;
    })
    .join('');
}

/**
 * Shared evidence attachment list for ticket detail pages (all roles).
 * @param {object} ticket
 * @param {{ attachmentBasePath: string, compact?: boolean, theme?: 'default' | 'console' }} opts
 */
function evidenceSection(ticket, { attachmentBasePath, compact = false, theme = 'default' } = {}) {
  const isConsole = theme === 'console';
  const cardClass = isConsole
    ? `sup-card${compact ? ' sup-card--compact' : ''}`
    : `card${compact ? ' card--compact' : ''}`;
  const title = isConsole ? 'Attachments' : 'Evidence';
  const items = ticket?.evidence || [];

  if (!items.length) {
    if (isConsole) {
      return `<section class="${cardClass}">
        <div class="sup-card__head"><h2>${title}</h2></div>
        <div class="sup-card__body"><p class="sup-muted-block">No attachments uploaded.</p></div>
      </section>`;
    }
    return `<section class="${cardClass}">
      <h2>${title}</h2>
      <p class="text-muted">No evidence uploaded.</p>
    </section>`;
  }

  const listHtml = `<ul class="attachment-list">${attachmentRows(items, attachmentBasePath)}</ul>`;

  if (isConsole) {
    return `<section class="${cardClass}">
      <div class="sup-card__head"><h2>${title} <span class="text-muted">(${items.length})</span></h2></div>
      <div class="sup-card__body">${listHtml}</div>
    </section>`;
  }

  return `<section class="${cardClass}">
    <h2>${title} <span class="text-muted">(${items.length})</span></h2>
    ${listHtml}
  </section>`;
}

module.exports = { evidenceSection };
