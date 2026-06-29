const { escapeHtml, formatDate } = require('../html');

function notificationPanelHtml(notifications = [], { markAllReadAction } = {}) {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const badge =
    unreadCount > 0
      ? `<span class="notif-badge" aria-label="${unreadCount} unread">${unreadCount > 9 ? '9+' : unreadCount}</span>`
      : '';

  const items = notifications.length
    ? notifications
        .map((n) => {
          const unreadCls = n.read ? '' : ' notif-item--unread';
          const href = escapeHtml(n.href || '#');
          return `<li class="notif-item${unreadCls}">
            <a href="${href}" class="notif-item__link">
              <span class="notif-item__title">${escapeHtml(n.title || 'Notification')}</span>
              <span class="notif-item__message">${escapeHtml(n.message || '')}</span>
              <span class="notif-item__time">${escapeHtml(formatDate(n.at))}</span>
            </a>
          </li>`;
        })
        .join('')
    : '<li class="notif-item notif-item--empty">No notifications yet.</li>';

  const markAllForm =
    unreadCount > 0 && markAllReadAction
      ? `<form method="post" action="${escapeHtml(markAllReadAction)}" class="notif-panel__mark-all">
          <button type="submit" class="btn-text">Mark all read</button>
        </form>`
      : '';

  return `<div class="notif-wrap" data-notif-panel>
    <button type="button" class="notif-btn" aria-label="Notifications" aria-expanded="false" data-notif-toggle>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M18 8C18 5.23858 15.7614 3 13 3H11C8.23858 3 6 5.23858 6 8V11.3824C6 12.0366 5.73661 12.6643 5.27114 13.1297L4.58579 13.8149C4.21623 14.1844 4.47577 14.8 5 14.8H19C19.5242 14.8 19.7838 14.1844 19.4142 13.8149L18.7289 13.1297C18.2634 12.6643 18 12.0366 18 11.3824V8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 18C10.5 19 11.5 20 12 20C12.5 20 13.5 19 14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      ${badge}
    </button>
    <div class="notif-panel" hidden data-notif-dropdown>
      <div class="notif-panel__head">
        <span class="notif-panel__title">Notifications</span>
        ${markAllForm}
      </div>
      <ul class="notif-list">${items}</ul>
    </div>
  </div>`;
}

const NOTIFICATION_PANEL_SCRIPT = `<script>
(function () {
  document.querySelectorAll('[data-notif-panel]').forEach(function (wrap) {
    var btn = wrap.querySelector('[data-notif-toggle]');
    var panel = wrap.querySelector('[data-notif-dropdown]');
    if (!btn || !panel) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !panel.hidden;
      document.querySelectorAll('[data-notif-dropdown]').forEach(function (p) { p.hidden = true; });
      document.querySelectorAll('[data-notif-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (!open) {
        panel.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
  document.addEventListener('click', function () {
    document.querySelectorAll('[data-notif-dropdown]').forEach(function (p) { p.hidden = true; });
    document.querySelectorAll('[data-notif-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  });
})();
</script>`;

module.exports = { notificationPanelHtml, NOTIFICATION_PANEL_SCRIPT };
