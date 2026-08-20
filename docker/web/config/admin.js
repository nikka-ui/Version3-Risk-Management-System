/** Seed data and defaults for System Administrator modules. */

const { ASSIGNABLE_ROLES } = require('./roles');

const SEED_DEPARTMENTS = [
  { code: 'ADMIN', name: 'Administration', description: 'Corporate administration and governance', status: 'active' },
  { code: 'FIN', name: 'Finance', description: 'Finance and accounting operations', status: 'active' },
  { code: 'OPS', name: 'Operations', description: 'Core business operations', status: 'active' },
  { code: 'IT', name: 'Information Technology', description: 'IT infrastructure and systems', status: 'active' },
  { code: 'HR', name: 'Human Resources', description: 'Human resources and talent management', status: 'active' },
  { code: 'HRMS', name: 'HRMS', description: 'Human resource management services', status: 'active' },
  { code: 'MMCD', name: 'MMCD', description: 'Maintenance, materials, and facilities', status: 'active' },
  { code: 'NBO', name: 'New Business Operations', description: 'New business operations', status: 'active' },
  { code: 'BD', name: 'Business Development', description: 'Business development and partnerships', status: 'active' },
  { code: 'RMO', name: 'RMO', description: 'Risk Management Officer (RMO)', status: 'active' },
  { code: 'PCEO', name: 'PCEO', description: 'President and Chief Executive Office', status: 'active' },
  { code: 'IA', name: 'Internal Audit', description: 'Internal audit and assurance', status: 'active' },
];

const SEED_POSITIONS = [
  'Risk Reporter',
  'Department Head / Vice President',
  'Risk Management Officer',
  'Audit & Compliance Officer',
  'Executive Committee Member',
  'President / CEO',
  'System Administrator',
];

const DEFAULT_SYSTEM_SETTINGS = {
  landingTagline: 'Identify. Assess. Mitigate.',
  landingHeadline: 'ACCC Risk\nManagement\nSystem',
  organizationName: 'ACCC',
  systemName: 'AI-Assisted ISO 31000 Risk Management System',
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

// Roles an administrator may assign in User Management. Derived from the
// canonical role registry so it always matches the modules that exist.
const ADMIN_ASSIGNABLE_ROLES = ASSIGNABLE_ROLES;

module.exports = {
  SEED_DEPARTMENTS,
  SEED_POSITIONS,
  DEFAULT_SYSTEM_SETTINGS,
  ADMIN_ASSIGNABLE_ROLES,
};
