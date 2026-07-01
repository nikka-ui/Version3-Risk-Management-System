/**
 * Seed accounts loaded into the store on first run.
 * Production: administrator accounts only (development/demo role accounts removed).
 */
const SEED_USERS = [
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
