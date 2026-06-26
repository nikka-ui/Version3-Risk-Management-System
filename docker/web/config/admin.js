/** Seed data and defaults for System Administrator modules. */

const SEED_DEPARTMENTS = [
  { code: 'ADMIN', name: 'Administration', description: 'Corporate administration and governance', status: 'active' },
  { code: 'FIN', name: 'Finance', description: 'Finance and accounting operations', status: 'active' },
  { code: 'OPS', name: 'Operations', description: 'Core business operations', status: 'active' },
  { code: 'IT', name: 'Information Technology', description: 'IT infrastructure and systems', status: 'active' },
  { code: 'HR', name: 'Human Resources', description: 'Human resources and talent management', status: 'active' },
  { code: 'BD', name: 'Business Development', description: 'Business development and partnerships', status: 'active' },
  { code: 'CC', name: 'Credit and Collection', description: 'Credit and collections', status: 'active' },
  { code: 'IA', name: 'Internal Audit', description: 'Internal audit and assurance', status: 'active' },
];

const SEED_POSITIONS = [
  'Department Supervisor',
  'Risk Management Officer',
  'Audit Officer',
  'Executive Director',
  'Finance Supervisor',
  'Operations Supervisor',
  'System Administrator',
];

const DEFAULT_SYSTEM_SETTINGS = {
  systemName: 'AI-Assisted ISO 31000 Risk Management System',
  organizationName: 'Risk Management Office',
  themeColor: '#2563eb',
  defaultRiskLevels: ['low', 'moderate', 'high', 'critical'],
  ticketNumberFormat: 'RISK-{YEAR}-{SEQ}',
  emailNotifications: true,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: false,
  maxUploadSizeMb: 25,
  allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'],
  maintenanceMode: false,
  backupEnabled: true,
  backupFrequency: 'daily',
  sessionTimeoutMinutes: 480,
  mfaEnabled: false,
};

const ADMIN_ASSIGNABLE_ROLES = ['supervisor', 'rm_officer', 'audit_officer', 'executive', 'admin'];

module.exports = {
  SEED_DEPARTMENTS,
  SEED_POSITIONS,
  DEFAULT_SYSTEM_SETTINGS,
  ADMIN_ASSIGNABLE_ROLES,
};
