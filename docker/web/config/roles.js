const ROLES = {
  supervisor: {
    id: 'supervisor',
    label: 'Department Supervisor',
    description: 'Submit risk reports and accomplishments',
  },
  rm_officer: {
    id: 'rm_officer',
    label: 'Risk Management Officer',
    description: 'Validate reports and mitigation plans',
  },
  audit_officer: {
    id: 'audit_officer',
    label: 'Audit Officer',
    description: 'Review and approve solutions',
  },
  executive: {
    id: 'executive',
    label: 'Executive',
    description: 'Monitor risks by level and category; comment on all reports',
  },
  employee: {
    id: 'employee',
    label: 'Employee',
    description: 'General staff access to assigned risk workflows',
  },
  admin: {
    id: 'admin',
    label: 'System Administrator',
    description: 'Manage accounts, roles, and system logs',
  },
};

const ASSIGNABLE_ROLES = ['supervisor', 'rm_officer', 'audit_officer', 'executive', 'employee'];

function getRoleLabel(roleId) {
  return ROLES[roleId]?.label || roleId;
}

module.exports = { ROLES, ASSIGNABLE_ROLES, getRoleLabel };
