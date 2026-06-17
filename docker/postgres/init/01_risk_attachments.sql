-- Evidence attachment metadata (file bytes live in MinIO / S3 object storage).
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
);

CREATE INDEX IF NOT EXISTS idx_risk_attachments_ticket_ref ON risk_attachments (ticket_ref);
