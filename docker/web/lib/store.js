const fs = require('fs');
const path = require('path');
const { SEED_USERS } = require('../config/users');
const { getRoleLabel } = require('../config/roles');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const SEED_REPORT_IDS = new Set(['rpt-001', 'rpt-002', 'rpt-003']);

let cache = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function defaultStore() {
  const now = new Date().toISOString();
  return {
    users: SEED_USERS.map((u) => ({
      ...u,
      roleLabel: getRoleLabel(u.role),
      canManageUsers: u.role === 'admin',
      createdAt: now,
      updatedAt: now,
      active: true,
    })),
    credentialLogs: [
      {
        id: 'log-seed-1',
        at: now,
        action: 'system_init',
        username: 'system',
        actor: 'system',
        detail: 'Store initialized with seed accounts',
        success: true,
      },
    ],
    reportLogs: [],
    riskTickets: [],
    accomplishments: [],
  };
}

/** Remove demo report rows from earlier builds (no supervisor module yet). */
function migrateStore(store) {
  if (!store.reportLogs?.length) return store;
  const onlySamples = store.reportLogs.every((r) => SEED_REPORT_IDS.has(r.id));
  if (onlySamples) {
    store.reportLogs = [];
  }
  return store;
}

function loadStore() {
  if (cache) return cache;
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    cache = defaultStore();
    saveStore();
    return cache;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    cache = JSON.parse(raw);
    const lenBefore = cache.reportLogs?.length ?? 0;
    cache = migrateStore(cache);
    if (!cache.riskTickets) cache.riskTickets = [];
    if (!cache.accomplishments) cache.accomplishments = [];
    if ((cache.reportLogs?.length ?? 0) !== lenBefore) {
      saveStore();
    }
    return cache;
  } catch {
    cache = defaultStore();
    saveStore();
    return cache;
  }
}

function saveStore() {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function reloadStore() {
  cache = null;
  return loadStore();
}

function listUsers() {
  const store = loadStore();
  return store.users
    .filter((u) => u.active !== false)
    .map((u) => publicUser(u))
    .sort((a, b) => a.username.localeCompare(b.username));
}

function publicUser(user) {
  return {
    username: user.username,
    role: user.role,
    roleLabel: user.roleLabel || getRoleLabel(user.role),
    displayName: user.displayName,
    canManageUsers: Boolean(user.canManageUsers),
    builtIn: Boolean(user.builtIn),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function findUserRecord(username) {
  const normalized = String(username || '').trim().toLowerCase();
  const store = loadStore();
  return store.users.find((u) => u.username === normalized && u.active !== false) || null;
}

function findUserWithPassword(username, password) {
  const user = findUserRecord(username);
  if (!user || user.password !== password) return null;
  return user;
}

function createUser({ username, password, displayName, role }) {
  const store = loadStore();
  const normalized = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) {
    return { error: 'Username must be 3–32 characters (letters, numbers, . _ -).' };
  }
  const existing = store.users.find((u) => u.username === normalized);
  if (existing && existing.active !== false) {
    return { error: 'Username already exists.' };
  }
  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }
  const now = new Date().toISOString();
  if (existing && existing.active === false) {
    existing.password = password;
    existing.displayName = String(displayName || normalized).trim();
    existing.role = role;
    existing.roleLabel = getRoleLabel(role);
    existing.canManageUsers = role === 'admin';
    existing.active = true;
    existing.updatedAt = now;
    saveStore();
    return { user: publicUser(existing), reactivated: true };
  }
  const record = {
    username: normalized,
    password,
    displayName: String(displayName || normalized).trim(),
    role,
    roleLabel: getRoleLabel(role),
    canManageUsers: role === 'admin',
    builtIn: false,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  store.users.push(record);
  saveStore();
  return { user: publicUser(record) };
}

function updateUserRole(username, role, actor) {
  const store = loadStore();
  const user = store.users.find((u) => u.username === username && u.active !== false);
  if (!user) return { error: 'User not found.' };
  if (user.builtIn && user.username === 'admin' && role !== 'admin') {
    return { error: 'Cannot change role of the primary admin account.' };
  }
  const previous = user.role;
  user.role = role;
  user.roleLabel = getRoleLabel(role);
  user.canManageUsers = role === 'admin';
  user.updatedAt = new Date().toISOString();
  saveStore();
  return { user: publicUser(user), previous, actor };
}

function deleteUser(username) {
  const store = loadStore();
  const normalized = String(username || '').trim().toLowerCase();
  const user = store.users.find((u) => u.username === normalized && u.active !== false);
  if (!user) return { error: 'User not found.' };
  if (user.builtIn) {
    return { error: 'Built-in accounts cannot be deleted.' };
  }
  if (user.username === 'admin') {
    return { error: 'The administrator account cannot be deleted.' };
  }
  user.active = false;
  user.updatedAt = new Date().toISOString();
  saveStore();
  return { user: publicUser(user) };
}

function getCredentialLogs(limit = 200) {
  const store = loadStore();
  return [...store.credentialLogs]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}

function getReportLogs(limit = 200) {
  const store = loadStore();
  return [...store.reportLogs]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}

function appendCredentialLog(entry) {
  const store = loadStore();
  store.credentialLogs.push({
    id: `clog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.credentialLogs.length > 500) {
    store.credentialLogs = store.credentialLogs.slice(-500);
  }
  saveStore();
}

function appendReportLog(entry) {
  const store = loadStore();
  store.reportLogs.push({
    id: `rpt-${Date.now()}`,
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.reportLogs.length > 500) {
    store.reportLogs = store.reportLogs.slice(-500);
  }
  saveStore();
}

module.exports = {
  loadStore,
  saveStore,
  listUsers,
  findUserRecord,
  findUserWithPassword,
  createUser,
  updateUserRole,
  deleteUser,
  getCredentialLogs,
  getReportLogs,
  appendCredentialLog,
  appendReportLog,
  publicUser,
};
