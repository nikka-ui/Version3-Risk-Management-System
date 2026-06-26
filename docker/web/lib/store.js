const fs = require('fs');
const path = require('path');
const { SEED_USERS } = require('../config/users');
const { getRoleLabel } = require('../config/roles');
const {
  SEED_DEPARTMENTS,
  SEED_POSITIONS,
  DEFAULT_SYSTEM_SETTINGS,
} = require('../config/admin');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const SEED_REPORT_IDS = new Set(['rpt-001', 'rpt-002', 'rpt-003']);

let cache = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function seedUserRecord(u, now) {
  return {
    ...u,
    employeeId: u.employeeId || `EMP-${String(u.username).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`,
    email: u.email || `${u.username}@rms.local`,
    department: u.department || 'Administration',
    position: u.position || getRoleLabel(u.role),
    roleLabel: getRoleLabel(u.role),
    canManageUsers: u.role === 'admin',
    createdAt: now,
    updatedAt: now,
    active: true,
    status: 'active',
  };
}

function seedDepartments(now) {
  return SEED_DEPARTMENTS.map((d, i) => ({
    id: `dept-${i + 1}`,
    ...d,
    head: d.head || null,
    createdAt: now,
    updatedAt: now,
    active: true,
  }));
}

function defaultStore() {
  const now = new Date().toISOString();
  return {
    users: SEED_USERS.map((u) => seedUserRecord(u, now)),
    departments: seedDepartments(now),
    positions: SEED_POSITIONS.map((name, i) => ({
      id: `pos-${i + 1}`,
      name,
      createdAt: now,
      updatedAt: now,
      active: true,
    })),
    auditLogs: [
      {
        id: 'alog-seed-1',
        at: now,
        username: 'system',
        role: 'system',
        roleLabel: 'System',
        action: 'system_init',
        module: 'System',
        description: 'Store initialized with seed data',
        ip: '—',
        device: 'Server',
        browser: '—',
      },
    ],
    notifications: [],
    deletedTicketLogs: [],
    systemSettings: { ...DEFAULT_SYSTEM_SETTINGS },
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
    const now = new Date().toISOString();
    let migrated = false;
    if (!cache.departments?.length) {
      cache.departments = seedDepartments(now);
      migrated = true;
    }
    if (!cache.positions?.length) {
      cache.positions = SEED_POSITIONS.map((name, i) => ({
        id: `pos-${i + 1}`,
        name,
        createdAt: now,
        updatedAt: now,
        active: true,
      }));
      migrated = true;
    }
    if (!cache.auditLogs) {
      cache.auditLogs = [];
      migrated = true;
    }
    if (!cache.notifications) {
      cache.notifications = [];
      migrated = true;
    }
    if (!cache.deletedTicketLogs) {
      cache.deletedTicketLogs = [];
      migrated = true;
    }
    if (!cache.systemSettings) {
      cache.systemSettings = { ...DEFAULT_SYSTEM_SETTINGS };
      migrated = true;
    }
    for (const u of cache.users || []) {
      if (!u.employeeId) {
        u.employeeId = `EMP-${String(u.username).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`;
        migrated = true;
      }
      if (!u.email) {
        u.email = `${u.username}@rms.local`;
        migrated = true;
      }
      if (!u.department) {
        u.department = 'Administration';
        migrated = true;
      }
      if (!u.position) {
        u.position = u.roleLabel || getRoleLabel(u.role);
        migrated = true;
      }
      if (!u.status) {
        u.status = u.active === false ? 'inactive' : 'active';
        migrated = true;
      }
    }
    const existingUsernames = new Set((cache.users || []).map((u) => u.username));
    for (const seed of SEED_USERS) {
      if (!existingUsernames.has(seed.username)) {
        cache.users.push(seedUserRecord(seed, now));
        migrated = true;
      }
    }
    // Migrate legacy shared comments to private RMO/Audit thread
    for (const t of cache.riskTickets || []) {
      if (t.comments?.length && !t.privateComments?.length) {
        t.privateComments = t.comments.map((c) => ({ ...c, private: true }));
        delete t.comments;
        migrated = true;
      }
      if (!t.privateComments) {
        t.privateComments = [];
        migrated = true;
      }
      if (!t.executiveComments) {
        t.executiveComments = [];
        migrated = true;
      }
      if (!t.mitigationPlanHistory) {
        t.mitigationPlanHistory = [];
        migrated = true;
      }
      if (!t.mitigationPlanVersion && t.officerNotes && t.status !== 'returned') {
        t.mitigationPlanVersion = 1;
        migrated = true;
      }
    }
    if (migrated || (cache.reportLogs?.length ?? 0) !== lenBefore) {
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
  for (const ticket of cache.riskTickets || []) {
    if (Array.isArray(ticket.evidence)) {
      ticket.evidenceCount = ticket.evidence.length;
      delete ticket.evidence;
    }
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

function reloadStore() {
  cache = null;
  return loadStore();
}

function listUsers({ includeInactive = false } = {}) {
  const store = loadStore();
  return store.users
    .filter((u) => !u.deleted)
    .filter((u) => includeInactive || u.active !== false)
    .map((u) => publicUser(u))
    .sort((a, b) => a.username.localeCompare(b.username));
}

function publicUser(user) {
  return {
    username: user.username,
    employeeId: user.employeeId || '',
    email: user.email || '',
    department: user.department || '',
    position: user.position || '',
    role: user.role,
    roleLabel: user.roleLabel || getRoleLabel(user.role),
    displayName: user.displayName,
    status: user.status || (user.active === false ? 'inactive' : 'active'),
    canManageUsers: Boolean(user.canManageUsers),
    builtIn: Boolean(user.builtIn),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    active: user.active !== false,
  };
}

function findUserRecord(username, { includeInactive = false } = {}) {
  const normalized = String(username || '').trim().toLowerCase();
  const store = loadStore();
  return (
    store.users.find(
      (u) => u.username === normalized && !u.deleted && (includeInactive || u.active !== false),
    ) || null
  );
}

function findUserWithPassword(username, password) {
  const user = findUserRecord(username);
  if (!user || user.password !== password) return null;
  return user;
}

function createUser({
  username,
  password,
  displayName,
  role,
  employeeId,
  email,
  department,
  position,
  confirmPassword,
}) {
  const store = loadStore();
  const normalized = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) {
    return { error: 'Username must be 3–32 characters (letters, numbers, . _ -).' };
  }
  const existing = store.users.find((u) => u.username === normalized);
  if (existing && existing.active !== false && !existing.deleted) {
    return { error: 'Username already exists.' };
  }
  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }
  const now = new Date().toISOString();
  const base = {
    employeeId: String(employeeId || `EMP-${normalized.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`).trim(),
    email: String(email || `${normalized}@rms.local`).trim().toLowerCase(),
    department: String(department || 'Administration').trim(),
    position: String(position || getRoleLabel(role)).trim(),
    status: 'active',
  };
  if (existing && (existing.active === false || existing.deleted)) {
    Object.assign(existing, base, {
      password,
      displayName: String(displayName || normalized).trim(),
      role,
      roleLabel: getRoleLabel(role),
      canManageUsers: role === 'admin',
      active: true,
      deleted: false,
      deletedAt: null,
      updatedAt: now,
    });
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
    ...base,
  };
  store.users.push(record);
  saveStore();
  return { user: publicUser(record) };
}

function updateUser(username, fields) {
  const store = loadStore();
  const normalized = String(username || '').trim().toLowerCase();
  const user = store.users.find((u) => u.username === normalized);
  if (!user) return { error: 'User not found.' };
  const now = new Date().toISOString();
  if (fields.displayName !== undefined) user.displayName = String(fields.displayName).trim();
  if (fields.email !== undefined) user.email = String(fields.email).trim().toLowerCase();
  if (fields.employeeId !== undefined) user.employeeId = String(fields.employeeId).trim();
  if (fields.department !== undefined) user.department = String(fields.department).trim();
  if (fields.position !== undefined) user.position = String(fields.position).trim();
  if (fields.role !== undefined && ROLES_SAFE(fields.role)) {
    if (user.builtIn && user.username === 'admin' && fields.role !== 'admin') {
      return { error: 'Cannot change role of the primary admin account.' };
    }
    user.role = fields.role;
    user.roleLabel = getRoleLabel(fields.role);
    user.canManageUsers = fields.role === 'admin';
  }
  user.updatedAt = now;
  saveStore();
  return { user: publicUser(user), previous: { ...user } };
}

function ROLES_SAFE(role) {
  const { ROLES } = require('../config/roles');
  return Boolean(ROLES[role]);
}

function setUserStatus(username, active) {
  const store = loadStore();
  const normalized = String(username || '').trim().toLowerCase();
  const user = store.users.find((u) => u.username === normalized && !u.deleted);
  if (!user) return { error: 'User not found.' };
  if (user.builtIn && user.username === 'admin' && !active) {
    return { error: 'The primary administrator account cannot be deactivated.' };
  }
  user.active = active;
  user.status = active ? 'active' : 'inactive';
  user.updatedAt = new Date().toISOString();
  saveStore();
  return { user: publicUser(user) };
}

function resetUserPassword(username, password, confirmPassword) {
  const store = loadStore();
  const normalized = String(username || '').trim().toLowerCase();
  const user = store.users.find((u) => u.username === normalized);
  if (!user) return { error: 'User not found.' };
  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters.' };
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }
  user.password = password;
  user.updatedAt = new Date().toISOString();
  saveStore();
  return { user: publicUser(user) };
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
  const user = store.users.find((u) => u.username === normalized && !u.deleted);
  if (!user) return { error: 'User not found.' };
  if (user.builtIn) {
    return { error: 'Built-in accounts cannot be deleted.' };
  }
  if (user.username === 'admin') {
    return { error: 'The administrator account cannot be deleted.' };
  }
  const now = new Date().toISOString();
  user.deleted = true;
  user.deletedAt = now;
  user.active = false;
  user.status = 'deleted';
  user.updatedAt = now;
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

function listDepartments() {
  const store = loadStore();
  return (store.departments || [])
    .filter((d) => d.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function findDepartment(id) {
  const store = loadStore();
  return (store.departments || []).find((d) => d.id === id && d.active !== false) || null;
}

function createDepartment({ name, code, description, head, status }) {
  const store = loadStore();
  const deptName = String(name || '').trim();
  const deptCode = String(code || '').trim().toUpperCase();
  if (!deptName || !deptCode) return { error: 'Department name and code are required.' };
  const dup = (store.departments || []).find(
    (d) => d.active !== false && (d.code === deptCode || d.name.toLowerCase() === deptName.toLowerCase()),
  );
  if (dup) return { error: 'A department with that name or code already exists.' };
  const now = new Date().toISOString();
  const record = {
    id: `dept-${Date.now()}`,
    name: deptName,
    code: deptCode,
    description: String(description || '').trim(),
    head: head ? String(head).trim() : null,
    status: status === 'inactive' ? 'inactive' : 'active',
    active: status !== 'inactive',
    createdAt: now,
    updatedAt: now,
  };
  if (!store.departments) store.departments = [];
  store.departments.push(record);
  saveStore();
  return { department: record };
}

function updateDepartment(id, fields) {
  const store = loadStore();
  const dept = (store.departments || []).find((d) => d.id === id);
  if (!dept || dept.active === false) return { error: 'Department not found.' };
  if (fields.name !== undefined) dept.name = String(fields.name).trim();
  if (fields.code !== undefined) dept.code = String(fields.code).trim().toUpperCase();
  if (fields.description !== undefined) dept.description = String(fields.description).trim();
  if (fields.head !== undefined) dept.head = fields.head ? String(fields.head).trim() : null;
  if (fields.status !== undefined) {
    dept.status = fields.status === 'inactive' ? 'inactive' : 'active';
    dept.active = fields.status !== 'inactive';
  }
  dept.updatedAt = new Date().toISOString();
  saveStore();
  return { department: dept };
}

function deleteDepartment(id) {
  const store = loadStore();
  const dept = (store.departments || []).find((d) => d.id === id && d.active !== false);
  if (!dept) return { error: 'Department not found.' };
  dept.active = false;
  dept.status = 'inactive';
  dept.updatedAt = new Date().toISOString();
  saveStore();
  return { department: dept };
}

function listPositions() {
  const store = loadStore();
  return (store.positions || [])
    .filter((p) => p.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createPosition(name) {
  const store = loadStore();
  const posName = String(name || '').trim();
  if (!posName) return { error: 'Position name is required.' };
  const dup = (store.positions || []).find(
    (p) => p.active !== false && p.name.toLowerCase() === posName.toLowerCase(),
  );
  if (dup) return { error: 'Position already exists.' };
  const now = new Date().toISOString();
  const record = { id: `pos-${Date.now()}`, name: posName, createdAt: now, updatedAt: now, active: true };
  if (!store.positions) store.positions = [];
  store.positions.push(record);
  saveStore();
  return { position: record };
}

function updatePosition(id, name) {
  const store = loadStore();
  const pos = (store.positions || []).find((p) => p.id === id && p.active !== false);
  if (!pos) return { error: 'Position not found.' };
  const posName = String(name || '').trim();
  if (!posName) return { error: 'Position name is required.' };
  pos.name = posName;
  pos.updatedAt = new Date().toISOString();
  saveStore();
  return { position: pos };
}

function deletePosition(id) {
  const store = loadStore();
  const pos = (store.positions || []).find((p) => p.id === id && p.active !== false);
  if (!pos) return { error: 'Position not found.' };
  pos.active = false;
  pos.updatedAt = new Date().toISOString();
  saveStore();
  return { position: pos };
}

function appendAuditLog(entry) {
  const store = loadStore();
  if (!store.auditLogs) store.auditLogs = [];
  store.auditLogs.push({
    id: `alog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.auditLogs.length > 1000) {
    store.auditLogs = store.auditLogs.slice(-1000);
  }
  saveStore();
}

function getAuditLogs({ limit = 200, filters = {} } = {}) {
  const store = loadStore();
  let logs = [...(store.auditLogs || [])];
  if (filters.user) {
    const q = String(filters.user).toLowerCase();
    logs = logs.filter((l) => l.username?.toLowerCase().includes(q));
  }
  if (filters.action) {
    const q = String(filters.action).toLowerCase();
    logs = logs.filter((l) => l.action?.toLowerCase().includes(q));
  }
  if (filters.module) {
    const q = String(filters.module).toLowerCase();
    logs = logs.filter((l) => l.module?.toLowerCase().includes(q));
  }
  if (filters.date) {
    const day = String(filters.date).slice(0, 10);
    logs = logs.filter((l) => String(l.at).slice(0, 10) === day);
  }
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    logs = logs.filter(
      (l) =>
        l.description?.toLowerCase().includes(q)
        || l.username?.toLowerCase().includes(q)
        || l.action?.toLowerCase().includes(q),
    );
  }
  return logs.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

function getAuditLogsTodayCount() {
  const today = new Date().toISOString().slice(0, 10);
  const store = loadStore();
  return (store.auditLogs || []).filter((l) => String(l.at).slice(0, 10) === today).length;
}

function appendNotification(entry) {
  const store = loadStore();
  if (!store.notifications) store.notifications = [];
  store.notifications.unshift({
    id: `notif-${Date.now()}`,
    at: new Date().toISOString(),
    read: false,
    ...entry,
  });
  if (store.notifications.length > 100) {
    store.notifications = store.notifications.slice(0, 100);
  }
  saveStore();
}

function getNotifications(limit = 20) {
  const store = loadStore();
  return (store.notifications || []).slice(0, limit);
}

function appendDeletedTicketLog(entry) {
  const store = loadStore();
  if (!store.deletedTicketLogs) store.deletedTicketLogs = [];
  store.deletedTicketLogs.unshift({
    id: `dtl-${Date.now()}`,
    at: new Date().toISOString(),
    ...entry,
  });
  if (store.deletedTicketLogs.length > 200) {
    store.deletedTicketLogs = store.deletedTicketLogs.slice(0, 200);
  }
  saveStore();
}

function getDeletedTicketLogs(limit = 20) {
  const store = loadStore();
  return (store.deletedTicketLogs || []).slice(0, limit);
}

function getSystemSettings() {
  const store = loadStore();
  return { ...DEFAULT_SYSTEM_SETTINGS, ...(store.systemSettings || {}) };
}

function updateSystemSettings(fields) {
  const store = loadStore();
  if (!store.systemSettings) store.systemSettings = { ...DEFAULT_SYSTEM_SETTINGS };
  Object.assign(store.systemSettings, fields);
  saveStore();
  return { settings: getSystemSettings() };
}

function getRecentlyCreatedUsers(limit = 5) {
  const store = loadStore();
  return store.users
    .filter((u) => u.active !== false)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map((u) => publicUser(u));
}

module.exports = {
  loadStore,
  saveStore,
  reloadStore,
  listUsers,
  findUserRecord,
  findUserWithPassword,
  createUser,
  updateUser,
  updateUserRole,
  deleteUser,
  setUserStatus,
  resetUserPassword,
  getCredentialLogs,
  getReportLogs,
  appendCredentialLog,
  appendReportLog,
  publicUser,
  listDepartments,
  findDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  appendAuditLog,
  getAuditLogs,
  getAuditLogsTodayCount,
  appendNotification,
  getNotifications,
  appendDeletedTicketLog,
  getDeletedTicketLogs,
  getSystemSettings,
  updateSystemSettings,
  getRecentlyCreatedUsers,
};
