const { escapeHtml, formatDate } = require('../html');

const FILE_ICON = `<svg class="attachment-item__icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>`;

const CHEVRON_ICON = `<svg class="attachment-item__chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;

const MENU_ICON = `<svg class="attachment-item__menu-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="12" cy="19" r="1.75"/></svg>`;

function formatFileSize(bytes) {
  if (!bytes) return '—';
  const mb = bytes / 1024 / 1024;
  if (mb < 0.1) return '< 0.1 MB';
  return `${mb.toFixed(1)} MB`;
}

function fileTypeLabel(mimeType, name) {
  const mimeMap = {
    'application/pdf': 'PDF',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/jpg': 'JPEG',
  };
  if (mimeType && mimeMap[mimeType]) return mimeMap[mimeType];
  if (mimeType && mimeType.includes('/')) {
    const sub = mimeType.split('/')[1];
    if (sub) return sub.replace('vnd.', '').toUpperCase();
  }
  const fileName = name || '';
  const dot = fileName.lastIndexOf('.');
  if (dot > -1 && dot < fileName.length - 1) return fileName.slice(dot + 1).toUpperCase();
  return 'File';
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

function interactiveAttachmentRows(items, attachmentBasePath) {
  return items
    .map((e) => {
      const rawName = e.name || e.originalName || 'File';
      const name = escapeHtml(rawName);
      const sizeLabel = formatFileSize(e.size);
      const uploaded = escapeHtml(formatDate(e.uploadedAt));
      const fileType = escapeHtml(fileTypeLabel(e.mimeType, rawName));
      const viewable = Boolean(e.id && (e.storageKey || !e.legacy));

      if (!viewable) {
        return `<li class="attachment-item attachment-item--static">
          <div class="attachment-item__row">
            <span class="attachment-item__icon">${FILE_ICON}</span>
            <span class="attachment-item__name">${name}</span>
            <span class="attachment-item__meta">Reference only</span>
          </div>
        </li>`;
      }

      const href = `${attachmentBasePath}/${escapeHtml(e.id)}`;
      const mimeType = escapeHtml(e.mimeType || '');
      return `<li class="attachment-item attachment-item--interactive"
        data-name="${escapeHtml(rawName)}"
        data-size="${escapeHtml(sizeLabel)}"
        data-uploaded="${uploaded}"
        data-type="${fileType}"
        data-mime="${mimeType}"
        data-download="${href}">
        <div class="attachment-item__row">
          <span class="attachment-item__icon">${FILE_ICON}</span>
          <span class="attachment-item__name" title="${name}">${name}</span>
          <div class="attachment-item__actions">
            <button type="button" class="attachment-item__view-btn" data-action="preview">View</button>
            <div class="attachment-item__menu">
              <button type="button" class="attachment-item__menu-btn" aria-label="Options for ${name}" aria-expanded="false" aria-haspopup="true">${MENU_ICON}</button>
              <div class="attachment-item__dropdown" role="menu" hidden>
                <button type="button" class="attachment-item__dropdown-item" role="menuitem" data-action="details">View Details</button>
                <a href="${href}" class="attachment-item__dropdown-item" role="menuitem" download="${name}">Download File</a>
              </div>
            </div>
          </div>
        </div>
      </li>`;
    })
    .join('');
}

function attachmentInteractiveDrawer(drawerId) {
  return `<div class="attachment-drawer" id="${drawerId}" hidden aria-hidden="true">
    <div class="attachment-drawer__backdrop" data-close-drawer></div>
    <aside class="attachment-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="${drawerId}-title">
      <div class="attachment-drawer__head">
        <div class="attachment-drawer__head-main">
          <p class="attachment-drawer__eyebrow">File preview</p>
          <h3 class="attachment-drawer__title" id="${drawerId}-title">—</h3>
        </div>
        <button type="button" class="attachment-drawer__close" aria-label="Close preview" data-close-drawer>&times;</button>
      </div>
      <dl class="attachment-drawer__meta">
        <div class="attachment-drawer__meta-row">
          <dt>File size</dt><dd data-field="size">—</dd>
        </div>
        <div class="attachment-drawer__meta-row">
          <dt>Uploaded</dt><dd data-field="uploaded">—</dd>
        </div>
        <div class="attachment-drawer__meta-row">
          <dt>File type</dt><dd data-field="type">—</dd>
        </div>
      </dl>
      <div class="attachment-drawer__preview" data-preview-host>
        <p class="attachment-drawer__preview-empty">Select a file to preview.</p>
      </div>
      <div class="attachment-drawer__foot">
        <a href="#" class="btn-accept--outline attachment-drawer__download" download>Download File</a>
      </div>
    </aside>
  </div>`;
}

function attachmentInteractiveModal(modalId) {
  return `<div class="attachment-modal" id="${modalId}" hidden aria-hidden="true">
    <div class="attachment-modal__backdrop" data-close-modal></div>
    <div class="attachment-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="${modalId}-title">
      <div class="attachment-modal__head">
        <h3 class="attachment-modal__title" id="${modalId}-title">File details</h3>
        <button type="button" class="attachment-modal__close" aria-label="Close" data-close-modal>&times;</button>
      </div>
      <dl class="attachment-modal__dl">
        <dt>File name</dt><dd data-field="name">—</dd>
        <dt>File size</dt><dd data-field="size">—</dd>
        <dt>Upload date and time</dt><dd data-field="uploaded">—</dd>
        <dt>File type</dt><dd data-field="type">—</dd>
      </dl>
      <div class="attachment-modal__actions">
        <a href="#" class="btn-accept--outline attachment-modal__download" download>Download File</a>
      </div>
    </div>
  </div>`;
}

function attachmentInteractiveScript(panelId, modalId, drawerId) {
  return `<script>
(function () {
  var panel = document.getElementById(${JSON.stringify(panelId)});
  if (!panel || panel.dataset.bound) return;
  panel.dataset.bound = '1';
  var modal = document.getElementById(${JSON.stringify(modalId)});
  var drawer = document.getElementById(${JSON.stringify(drawerId)});
  if (!modal || !drawer) return;

  function closeDropdowns(except) {
    panel.querySelectorAll('.attachment-item__dropdown:not([hidden])').forEach(function (menu) {
      if (except && menu === except) return;
      menu.hidden = true;
      var btn = menu.parentElement && menu.parentElement.querySelector('.attachment-item__menu-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function openModal(item) {
    if (!drawer.hidden) closeDrawer();
    modal.querySelector('[data-field="name"]').textContent = item.dataset.name || '—';
    modal.querySelector('[data-field="size"]').textContent = item.dataset.size || '—';
    modal.querySelector('[data-field="uploaded"]').textContent = item.dataset.uploaded || '—';
    modal.querySelector('[data-field="type"]').textContent = item.dataset.type || '—';
    var dl = modal.querySelector('.attachment-modal__download');
    if (dl) {
      dl.href = item.dataset.download || '#';
      dl.setAttribute('download', item.dataset.name || 'file');
    }
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('attachment-modal-open');
    modal.querySelector('.attachment-modal__close').focus();
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (drawer.hidden) document.body.classList.remove('attachment-modal-open');
  }

  function previewMarkup(url, mime, type, name) {
    var safeName = name || 'File';
    if (mime === 'application/pdf' || type === 'PDF') {
      return '<iframe class="attachment-drawer__frame" src="' + url + '" title="' + safeName + '"></iframe>';
    }
    if (mime.indexOf('image/') === 0) {
      return '<img class="attachment-drawer__image" src="' + url + '" alt="' + safeName + '">';
    }
    return '<div class="attachment-drawer__fallback"><p>Inline preview is not available for this file type.</p><a href="' + url + '" class="btn-accept--outline" download="' + safeName + '">Download to view</a></div>';
  }

  function openDrawer(item) {
    if (!modal.hidden) closeModal();
    var url = item.dataset.download || '#';
    var mime = item.dataset.mime || '';
    var type = item.dataset.type || '';
    var name = item.dataset.name || 'File';
    drawer.querySelector('.attachment-drawer__title').textContent = name;
    drawer.querySelector('[data-field="size"]').textContent = item.dataset.size || '—';
    drawer.querySelector('[data-field="uploaded"]').textContent = item.dataset.uploaded || '—';
    drawer.querySelector('[data-field="type"]').textContent = type || '—';
    var dl = drawer.querySelector('.attachment-drawer__download');
    if (dl) {
      dl.href = url;
      dl.setAttribute('download', name);
    }
    var host = drawer.querySelector('[data-preview-host]');
    if (host) host.innerHTML = previewMarkup(url, mime, type, name);
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('attachment-drawer-open');
    drawer.querySelector('.attachment-drawer__close').focus();
  }

  function closeDrawer() {
    var host = drawer.querySelector('[data-preview-host]');
    if (host) host.innerHTML = '<p class="attachment-drawer__preview-empty">Select a file to preview.</p>';
    drawer.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    if (modal.hidden) document.body.classList.remove('attachment-drawer-open');
  }

  panel.addEventListener('click', function (ev) {
    var previewBtn = ev.target.closest('[data-action="preview"]');
    if (previewBtn) {
      ev.preventDefault();
      var item = previewBtn.closest('.attachment-item--interactive');
      closeDropdowns();
      if (item) openDrawer(item);
      return;
    }

    var menuBtn = ev.target.closest('.attachment-item__menu-btn');
    if (menuBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      var dropdown = menuBtn.parentElement.querySelector('.attachment-item__dropdown');
      var isOpen = dropdown && !dropdown.hidden;
      closeDropdowns();
      if (dropdown && !isOpen) {
        dropdown.hidden = false;
        menuBtn.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    var detailsBtn = ev.target.closest('[data-action="details"]');
    if (detailsBtn) {
      ev.preventDefault();
      var detailsItem = detailsBtn.closest('.attachment-item--interactive');
      closeDropdowns();
      if (detailsItem) openModal(detailsItem);
      return;
    }

    if (ev.target.closest('[data-close-modal]')) {
      ev.preventDefault();
      closeModal();
    }
  });

  drawer.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-close-drawer]')) {
      ev.preventDefault();
      closeDrawer();
    }
  });

  document.addEventListener('click', function (ev) {
    if (!ev.target.closest('.attachment-item__menu')) closeDropdowns();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      closeDropdowns();
      if (!drawer.hidden) closeDrawer();
      if (!modal.hidden) closeModal();
    }
  });
})();
</script>`;
}

/**
 * Shared evidence attachment list for ticket detail pages (all roles).
 * @param {object} ticket
 * @param {{ attachmentBasePath: string, compact?: boolean, theme?: 'default' | 'console', interactive?: boolean }} opts
 */
function evidenceSection(ticket, { attachmentBasePath, compact = false, theme = 'default', interactive = false } = {}) {
  const isConsole = theme === 'console';
  const cardClass = isConsole
    ? `sup-card${compact ? ' sup-card--compact' : ''}`
    : `card${compact ? ' card--compact' : ''}`;
  const title = isConsole ? 'Attachments' : 'Evidence';
  const items = ticket?.evidence || [];
  const panelId = `attachment-panel-${(ticket?.reference || 'ticket').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const modalId = `${panelId}-modal`;
  const drawerId = `${panelId}-drawer`;

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

  const useInteractive = interactive && isConsole;
  const listClass = useInteractive ? 'attachment-list attachment-list--interactive' : 'attachment-list';
  const rowsHtml = useInteractive
    ? interactiveAttachmentRows(items, attachmentBasePath)
    : attachmentRows(items, attachmentBasePath);
  const listHtml = `<div class="attachment-panel" id="${panelId}">
    <ul class="${listClass}">${rowsHtml}</ul>
    ${useInteractive ? attachmentInteractiveModal(modalId) : ''}
    ${useInteractive ? attachmentInteractiveDrawer(drawerId) : ''}
  </div>`;
  const scriptHtml = useInteractive ? attachmentInteractiveScript(panelId, modalId, drawerId) : '';

  if (isConsole) {
    return `<section class="${cardClass}">
      <div class="sup-card__head"><h2>${title} <span class="text-muted">(${items.length})</span></h2></div>
      <div class="sup-card__body">${listHtml}${scriptHtml}</div>
    </section>`;
  }

  return `<section class="${cardClass}">
    <h2>${title} <span class="text-muted">(${items.length})</span></h2>
    ${listHtml}${scriptHtml}
  </section>`;
}

module.exports = { evidenceSection };
