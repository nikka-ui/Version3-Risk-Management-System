#!/usr/bin/env node
/**
 * Reset operational data for production deployment.
 * Preserves: schema, system settings, departments, positions, built-in admin accounts.
 * Clears: tickets, accomplishments, logs, notifications, attachments, uploaded files.
 *
 * Usage (inside rms-web container):
 *   node scripts/reset-production-data.js
 *   node scripts/reset-production-data.js --keep-demo-accounts
 */
const fs = require('fs');
const path = require('path');
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');
const keepDemoAccounts = process.argv.includes('--keep-demo-accounts');

function systemInitLogs(now) {
  return {
    auditLogs: [
      {
        id: 'alog-production-reset',
        at: now,
        username: 'system',
        role: 'system',
        roleLabel: 'System',
        action: 'system_init',
        module: 'System',
        description: 'Operational data reset for production deployment',
        ip: '—',
        device: 'Server',
        browser: '—',
      },
    ],
    credentialLogs: [
      {
        id: 'log-production-reset',
        at: now,
        action: 'system_init',
        username: 'system',
        actor: 'system',
        detail: 'Operational data reset for production deployment',
        success: true,
      },
    ],
  };
}

function filterUsers(users) {
  if (keepDemoAccounts) {
    return users.filter((u) => u.builtIn === true);
  }
  return users.filter((u) => u.builtIn === true && u.role === 'admin');
}

function resetStore() {
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error(`Store not found: ${STORE_PATH}`);
  }

  const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  const now = new Date().toISOString();
  const init = systemInitLogs(now);

  const before = {
    users: store.users?.length ?? 0,
    riskTickets: store.riskTickets?.length ?? 0,
    accomplishments: store.accomplishments?.length ?? 0,
    notifications: store.notifications?.length ?? 0,
    auditLogs: store.auditLogs?.length ?? 0,
    reportLogs: store.reportLogs?.length ?? 0,
    credentialLogs: store.credentialLogs?.length ?? 0,
    deletedTicketLogs: store.deletedTicketLogs?.length ?? 0,
  };

  store.users = filterUsers(store.users || []);
  store.riskTickets = [];
  store.accomplishments = [];
  store.reportLogs = [];
  store.notifications = [];
  store.deletedTicketLogs = [];
  store.auditLogs = init.auditLogs;
  store.credentialLogs = init.credentialLogs;

  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');

  return {
    before,
    after: {
      users: store.users.length,
      riskTickets: 0,
      accomplishments: 0,
      notifications: 0,
      auditLogs: store.auditLogs.length,
      reportLogs: 0,
      credentialLogs: store.credentialLogs.length,
      deletedTicketLogs: 0,
    },
    keptUsers: store.users.map((u) => u.username),
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
  console.log('=== RMS Production Data Reset ===\n');
  console.log(`Mode: ${keepDemoAccounts ? 'keep all built-in accounts' : 'admin accounts only'}\n`);

  const storeResult = resetStore();
  console.log('Store reset:');
  console.log(`  Users kept: ${storeResult.keptUsers.join(', ')}`);
  console.log(`  riskTickets: ${storeResult.before.riskTickets} → ${storeResult.after.riskTickets}`);
  console.log(`  accomplishments: ${storeResult.before.accomplishments} → ${storeResult.after.accomplishments}`);
  console.log(`  notifications: ${storeResult.before.notifications} → ${storeResult.after.notifications}`);
  console.log(`  auditLogs: ${storeResult.before.auditLogs} → ${storeResult.after.auditLogs}`);
  console.log(`  reportLogs: ${storeResult.before.reportLogs} → ${storeResult.after.reportLogs}`);
  console.log(`  credentialLogs: ${storeResult.before.credentialLogs} → ${storeResult.after.credentialLogs}`);
  console.log(`  deletedTicketLogs: ${storeResult.before.deletedTicketLogs} → ${storeResult.after.deletedTicketLogs}`);

  const attachments = await clearAttachments();
  console.log(`\nPostgreSQL risk_attachments: ${attachments.before} → ${attachments.after}`);

  const storage = await clearObjectStorage();
  console.log(`MinIO bucket "${storage.bucket}": ${storage.deleted} object(s) removed`);

  console.log('\n=== Reset complete ===');
  console.log('Next ticket reference will be RISK-' + new Date().getFullYear() + '-00001');
  if (!keepDemoAccounts) {
    console.log('\nNote: Built-in demo role accounts (personnel, rm-officer, etc.) are removed.');
    console.log('They will be re-added on web service restart unless seed config is updated.');
  }
}

main().catch((err) => {
  console.error('Reset failed:', err.message || err);
  process.exit(1);
});
