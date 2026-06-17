/**
 * Evidence file storage (filesystem) — separate from store.json ticket metadata.
 * Metadata (id, storageKey, name, size, mimeType) lives on each ticket.evidence[] entry.
 */
const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES_PER_TICKET = 10;
const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg']);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

function ensureUploadsRoot() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
}

function ticketDir(ticketRef) {
  const safe = String(ticketRef || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(UPLOADS_ROOT, safe);
}

function sanitizeFilename(name) {
  const base = path.basename(String(name || 'file'));
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

function extFromName(name) {
  const parts = String(name || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function validateUpload(file) {
  if (!file || !file.buffer) {
    return { ok: false, error: 'Invalid upload.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File exceeds 20MB: ${file.originalname}` };
  }
  const ext = extFromName(file.originalname);
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, error: `Unsupported file type: ${ext || 'unknown'}` };
  }
  if (file.mimetype && !ALLOWED_MIME.has(file.mimetype)) {
    return { ok: false, error: `Unsupported MIME type: ${file.mimetype}` };
  }
  return { ok: true };
}

function saveUploadedFiles(ticketRef, files) {
  ensureUploadsRoot();
  const dir = ticketDir(ticketRef);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const saved = [];
  const list = Array.isArray(files) ? files : [];
  for (const file of list.slice(0, MAX_FILES_PER_TICKET)) {
    const check = validateUpload(file);
    if (!check.ok) {
      return { error: check.error };
    }
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeName = sanitizeFilename(file.originalname);
    const storedName = `${id}-${safeName}`;
    const storageKey = `${path.basename(dir)}/${storedName}`;
    const fullPath = path.join(dir, storedName);
    fs.writeFileSync(fullPath, file.buffer);

    saved.push({
      id,
      name: file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      storageKey,
      uploadedAt: new Date().toISOString(),
    });
  }
  return { attachments: saved };
}

function resolveStoragePath(storageKey) {
  if (!storageKey) return null;
  const normalized = String(storageKey).replace(/\\/g, '/');
  if (normalized.includes('..')) return null;
  const full = path.join(UPLOADS_ROOT, normalized);
  const root = path.resolve(UPLOADS_ROOT);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null;
  }
  return resolved;
}

function deleteStoredFile(storageKey) {
  const p = resolveStoragePath(storageKey);
  if (!p || !fs.existsSync(p)) return;
  try {
    fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

function deleteTicketUploads(ticketRef) {
  const dir = ticketDir(ticketRef);
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function removeAttachmentsFromTicket(ticket, attachmentIds) {
  const ids = new Set(Array.isArray(attachmentIds) ? attachmentIds : []);
  if (!ids.size) return [];
  const removed = [];
  ticket.evidence = (ticket.evidence || []).filter((a) => {
    if (ids.has(a.id)) {
      removed.push(a);
      if (a.storageKey) deleteStoredFile(a.storageKey);
      return false;
    }
    return true;
  });
  return removed;
}

function readFileStream(storageKey) {
  const p = resolveStoragePath(storageKey);
  if (!p || !fs.existsSync(p)) return null;
  return { path: p, stream: fs.createReadStream(p) };
}

/** Resolve storage key from metadata or on-disk layout (e.g. after container restore). */
function resolveAttachmentStorageKey(found) {
  const att = found?.attachment;
  const ticket = found?.ticket;
  if (!att || !ticket) return null;
  if (att.storageKey) return att.storageKey;

  const rawName = att.originalName || att.name;
  if (!rawName) return null;

  const safeRef = String(ticket.reference || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeName = path.basename(String(rawName)).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safeRef || !safeName) return null;

  const directKey = `${safeRef}/${safeName}`;
  const directPath = resolveStoragePath(directKey);
  if (directPath && fs.existsSync(directPath)) return directKey;

  const dir = ticketDir(ticket.reference);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const matched =
    files.find((f) => f === safeName || f.endsWith(`-${safeName}`))
    || (att.id ? files.find((f) => f.startsWith(`${att.id}-`)) : null);

  return matched ? `${safeRef}/${matched}` : null;
}

function backfillTicketEvidenceKeys(ticket) {
  let changed = false;
  for (const att of ticket.evidence || []) {
    if (att.storageKey || att.legacy) continue;
    const key = resolveAttachmentStorageKey({ ticket, attachment: att });
    if (key) {
      att.storageKey = key;
      changed = true;
    }
  }
  return changed;
}

function streamAttachmentToResponse(res, found) {
  const storageKey = resolveAttachmentStorageKey(found);
  if (!storageKey || !found?.attachment) {
    res.status(404).send('Attachment not found.');
    return false;
  }
  const file = readFileStream(storageKey);
  if (!file) {
    res.status(404).send('File not found on disk.');
    return false;
  }
  res.setHeader('Content-Type', found.attachment.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(found.attachment.originalName || found.attachment.name)}"`,
  );
  file.stream.pipe(res);
  return true;
}

module.exports = {
  UPLOADS_ROOT,
  MAX_FILES_PER_TICKET,
  saveUploadedFiles,
  deleteStoredFile,
  deleteTicketUploads,
  removeAttachmentsFromTicket,
  readFileStream,
  resolveStoragePath,
  resolveAttachmentStorageKey,
  backfillTicketEvidenceKeys,
  streamAttachmentToResponse,
};
