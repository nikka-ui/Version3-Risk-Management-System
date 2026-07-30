#!/usr/bin/env node
/**
 * Reset ticket/operational report data only.
 * Preserves: users, departments, positions, systemSettings, credentialLogs, auditLogs.
 * Clears: tickets, accomplishments, report logs, notifications, deleted-ticket logs,
 *         attachment metadata (Postgres), and uploaded files (MinIO/S3).
 *
 * Usage (inside rms-web container):
 *   node scripts/reset-ticket-data.js
 */
const fs = require('fs');
const path = require('path');
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

function resetStore() {
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error(`Store not found: ${STORE_PATH}`);
  }

  const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));

  const before = {
    users: store.users?.length ?? 0,
    departments: store.departments?.length ?? 0,
    positions: store.positions?.length ?? 0,
    riskTickets: store.riskTickets?.length ?? 0,
    accomplishments: store.accomplishments?.length ?? 0,
    notifications: store.notifications?.length ?? 0,
    reportLogs: store.reportLogs?.length ?? 0,
    deletedTicketLogs: store.deletedTicketLogs?.length ?? 0,
    auditLogs: store.auditLogs?.length ?? 0,
    credentialLogs: store.credentialLogs?.length ?? 0,
  };

  store.riskTickets = [];
  store.accomplishments = [];
  store.reportLogs = [];
  store.notifications = [];
  store.deletedTicketLogs = [];

  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');

  return {
    before,
    after: {
      users: store.users?.length ?? 0,
      departments: store.departments?.length ?? 0,
      positions: store.positions?.length ?? 0,
      riskTickets: 0,
      accomplishments: 0,
      notifications: 0,
      reportLogs: 0,
      deletedTicketLogs: 0,
      auditLogs: store.auditLogs?.length ?? 0,
      credentialLogs: store.credentialLogs?.length ?? 0,
    },
    keptUsers: (store.users || []).map((u) => u.username),
  };
}

async function clearAttachments() {
  const { getPool } = require('../lib/db');
  const pool = getPool();
  const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM risk_attachments');
  const before = countResult.rows[0]?.count ?? 0;
  await pool.query('TRUNCATE TABLE risk_attachments');
  return { before, after: 0 };
}

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3/MinIO credentials not configured.');
  }
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.S3_USE_PATH_STYLE_ENDPOINT !== 'false',
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function clearObjectStorage() {
  const bucket = process.env.S3_BUCKET || 'rms-uploads';
  const s3 = getS3Client();
  let deleted = 0;
  let continuationToken;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );
    const keys = (list.Contents || []).map((o) => o.Key).filter(Boolean);
    if (keys.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      deleted += keys.length;
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return { bucket, deleted };
}

async function main() {
  console.log('=== RMS Ticket Data Reset ===\n');
  console.log('Preserving: users, departments, positions, settings, audit/credential logs\n');

  const storeResult = resetStore();
  console.log('Store reset:');
  console.log(`  Users kept (${storeResult.after.users}): ${storeResult.keptUsers.join(', ') || '(none)'}`);
  console.log(`  departments: ${storeResult.before.departments} (unchanged)`);
  console.log(`  positions: ${storeResult.before.positions} (unchanged)`);
  console.log(`  riskTickets: ${storeResult.before.riskTickets} → ${storeResult.after.riskTickets}`);
  console.log(`  accomplishments: ${storeResult.before.accomplishments} → ${storeResult.after.accomplishments}`);
  console.log(`  notifications: ${storeResult.before.notifications} → ${storeResult.after.notifications}`);
  console.log(`  reportLogs: ${storeResult.before.reportLogs} → ${storeResult.after.reportLogs}`);
  console.log(`  deletedTicketLogs: ${storeResult.before.deletedTicketLogs} → ${storeResult.after.deletedTicketLogs}`);
  console.log(`  auditLogs: ${storeResult.before.auditLogs} (unchanged)`);
  console.log(`  credentialLogs: ${storeResult.before.credentialLogs} (unchanged)`);

  const attachments = await clearAttachments();
  console.log(`\nPostgreSQL risk_attachments: ${attachments.before} → ${attachments.after}`);

  const storage = await clearObjectStorage();
  console.log(`MinIO bucket "${storage.bucket}": ${storage.deleted} object(s) removed`);

  console.log('\n=== Reset complete ===');
  console.log('Next ticket reference will be RISK-' + new Date().getFullYear() + '-00001');
  console.log('Restart rms-web so the in-memory store reloads.');
}

main().catch((err) => {
  console.error('Reset failed:', err.message || err);
  process.exit(1);
});
