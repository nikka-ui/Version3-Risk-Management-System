function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    });
  } catch {
    return iso;
  }
}

function formatDateOnly(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeZone: 'Asia/Manila',
    });
  } catch {
    return String(value);
  }
}

/** Pull a display date from free-text 5W1H "when" answers (not the full narrative). */
function formatIncidentDate(whenText) {
  const raw = String(whenText || '').trim();
  if (!raw) return '';

  const months =
    'January|February|March|April|May|June|July|August|September|October|November|December';

  const monthDayYear = raw.match(new RegExp(`((?:${months})\\.?\\s+\\d{1,2},?\\s*\\d{4})`, 'i'));
  if (monthDayYear) {
    const normalized = monthDayYear[1].replace(/,(\s*\d{4})/, ', $1').replace(/,\s*(\d{4})/, ', $1');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return formatDateOnly(parsed);
    return monthDayYear[1];
  }

  const monthYear = raw.match(new RegExp(`((?:${months})\\.?\\s+\\d{4})`, 'i'));
  if (monthYear) return monthYear[1];

  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return formatDateOnly(iso[1]);

  const slash = raw.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
  if (slash) {
    const parsed = new Date(slash[1]);
    if (!Number.isNaN(parsed.getTime())) return formatDateOnly(parsed);
    return slash[1];
  }

  const firstSegment = raw.split(/[,;]/)[0]?.trim() || '';
  if (firstSegment && /\d{4}/.test(firstSegment) && firstSegment.length <= 48) {
    const parsed = new Date(firstSegment.replace(/^.*?\bon\s+/i, ''));
    if (!Number.isNaN(parsed.getTime())) return formatDateOnly(parsed);
    return firstSegment.replace(/^.*?\bon\s+/i, '').trim();
  }

  return '';
}

function formatRelativeTime(iso) {
  if (!iso) return '—';
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    if (diff < 0) return 'just now';
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const week = Math.floor(day / 7);
    if (week < 5) return `${week}w ago`;
    const month = Math.floor(day / 30);
    if (month < 12) return `${month}mo ago`;
    const year = Math.floor(day / 365);
    return `${year}y ago`;
  } catch {
    return formatDate(iso);
  }
}

module.exports = { escapeHtml, formatDate, formatDateOnly, formatIncidentDate, formatRelativeTime };
