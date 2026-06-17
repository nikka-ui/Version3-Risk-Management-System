const fs = require('fs');
const { Pool } = require('pg');

let pool = null;

function readDbPassword() {
  if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;
  const file = process.env.DB_PASSWORD_FILE;
  if (file && fs.existsSync(file)) {
    return fs.readFileSync(file, 'utf8').trim();
  }
  return null;
}

function getPool() {
  if (pool) return pool;
  const password = readDbPassword();
  if (!password) {
    throw new Error('Database password not configured (set DB_PASSWORD or DB_PASSWORD_FILE).');
  }
  pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE || 'rms',
    user: process.env.DB_USERNAME || 'rms',
    password,
    max: 10,
  });
  return pool;
}

async function ensureSchema() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS risk_attachments (
        id VARCHAR(64) PRIMARY KEY,
        ticket_ref VARCHAR(32) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(128) NOT NULL DEFAULT 'application/octet-stream',
        size_bytes BIGINT NOT NULL DEFAULT 0,
        storage_key VARCHAR(512) NOT NULL,
        uploaded_by VARCHAR(64),
        legacy BOOLEAN NOT NULL DEFAULT FALSE,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_risk_attachments_ticket_ref
      ON risk_attachments (ticket_ref)
    `);
  } finally {
    client.release();
  }
}

module.exports = { getPool, ensureSchema };
