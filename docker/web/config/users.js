/**
 * Seed accounts loaded into the store on first run.
 */
const SEED_USERS = [
  {
    username: 'personnel',
    password: 'a3c2026',
    role: 'supervisor',
    displayName: 'Department Supervisor',
    builtIn: true,
  },
  {
    username: 'rm-officer',
    password: 'a3c2026',
    role: 'rm_officer',
    displayName: 'Risk Management Officer',
    builtIn: true,
  },
  {
    username: 'audit-officer',
    password: 'a3c2026',
    role: 'audit_officer',
    displayName: 'Audit Officer',
    builtIn: true,
  },
  {
    username: 'executive',
    password: 'a3c2026',
    role: 'executive',
    displayName: 'Executive',
    builtIn: true,
  },
  {
    username: 'admin',
    password: 'a3c1993',
    role: 'admin',
    displayName: 'System Administrator',
    employeeId: 'EMP-ADMIN001',
    email: 'admin@rms.local',
    department: 'Information Technology',
    position: 'System Administrator',
    builtIn: true,
    canManageUsers: true,
  },
  {
    username: 'sys-admin',
    password: 'a3c2026',
    role: 'admin',
    displayName: 'IT Systems Administrator',
    employeeId: 'EMP-SYSADM01',
    email: 'sysadmin@rms.local',
    department: 'Information Technology',
    position: 'System Administrator',
    builtIn: true,
    canManageUsers: true,
  },
];

module.exports = { SEED_USERS };
