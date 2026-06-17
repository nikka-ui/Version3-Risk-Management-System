const { getPool } = require('./db');

function rowToAttachment(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketRef: row.ticket_ref,
    name: row.original_name,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: Number(row.size_bytes),
    storageKey: row.storage_key,
    uploadedBy: row.uploaded_by || null,
    uploadedAt: row.uploaded_at instanceof Date
      ? row.uploaded_at.toISOString()
      : String(row.uploaded_at),
    legacy: Boolean(row.legacy),
  };
}

async function listByTicketRef(ticketRef) {
  const { rows } = await getPool().query(
    `SELECT id, ticket_ref, original_name, mime_type, size_bytes, storage_key,
            uploaded_by, legacy, uploaded_at
     FROM risk_attachments
     WHERE ticket_ref = $1
     ORDER BY uploaded_at ASC`,
    [ticketRef],
  );
  return rows.map(rowToAttachment);
}

async function findById(id) {
  const { rows } = await getPool().query(
    `SELECT id, ticket_ref, original_name, mime_type, size_bytes, storage_key,
            uploaded_by, legacy, uploaded_at
     FROM risk_attachments
     WHERE id = $1`,
    [id],
  );
  return rowToAttachment(rows[0]);
}

async function countByTicketRef(ticketRef) {
  const { rows } = await getPool().query(
    'SELECT COUNT(*)::int AS count FROM risk_attachments WHERE ticket_ref = $1',
    [ticketRef],
  );
  return rows[0]?.count || 0;
}

async function insertAttachment(record) {
  await getPool().query(
    `INSERT INTO risk_attachments
      (id, ticket_ref, original_name, mime_type, size_bytes, storage_key, uploaded_by, legacy, uploaded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))`,
    [
      record.id,
      record.ticketRef,
      record.originalName,
      record.mimeType,
      record.size,
      record.storageKey,
      record.uploadedBy || null,
      Boolean(record.legacy),
      record.uploadedAt || null,
    ],
  );
  return rowToAttachment({
    id: record.id,
    ticket_ref: record.ticketRef,
    original_name: record.originalName,
    mime_type: record.mimeType,
    size_bytes: record.size,
    storage_key: record.storageKey,
    uploaded_by: record.uploadedBy,
    legacy: record.legacy,
    uploaded_at: record.uploadedAt ? new Date(record.uploadedAt) : new Date(),
  });
}

async function deleteByIds(ids) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return [];
  const { rows } = await getPool().query(
    `DELETE FROM risk_attachments
     WHERE id = ANY($1::varchar[])
     RETURNING id, storage_key`,
    [list],
  );
  return rows;
}

async function deleteByTicketRef(ticketRef) {
  const { rows } = await getPool().query(
    `DELETE FROM risk_attachments
     WHERE ticket_ref = $1
     RETURNING storage_key`,
    [ticketRef],
  );
  return rows.map((r) => r.storage_key);
}

async function migrateLegacyEvidenceFromStore(tickets) {
  let migrated = 0;
  for (const ticket of tickets || []) {
    const legacyItems = (ticket.evidence || []).filter((e) => e?.id);
    if (!legacyItems.length) continue;

    for (const item of legacyItems) {
      const existing = await findById(item.id);
      if (existing) continue;
      await insertAttachment({
        id: item.id,
        ticketRef: ticket.reference,
        originalName: item.originalName || item.name || 'file',
        mimeType: item.mimeType || 'application/octet-stream',
        size: item.size || 0,
        storageKey: item.storageKey || `legacy/${ticket.reference}/${item.id}`,
        uploadedBy: ticket.submittedBy || null,
        legacy: Boolean(item.legacy || !item.storageKey),
        uploadedAt: item.uploadedAt || null,
      });
      migrated += 1;
    }
    delete ticket.evidence;
  }
  return migrated;
}

module.exports = {
  listByTicketRef,
  findById,
  countByTicketRef,
  insertAttachment,
  deleteByIds,
  deleteByTicketRef,
  migrateLegacyEvidenceFromStore,
};
