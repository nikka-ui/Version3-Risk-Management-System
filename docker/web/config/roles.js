const ROLES = {
  supervisor: {
    id: 'supervisor',
    label: 'Ticket Reporter',
    description: 'Report organizational risks, track tickets, and submit accomplishments',
  },
  dept_head: {
    id: 'dept_head',
    label: 'Department Head / Vice President',
    description: 'Owns tickets routed to their department: accept, reject, reassign, plan, and resolve',
  },
  rm_officer: {
    id: 'rm_officer',
    label: 'Risk Governance Office (RMU)',
    description:
      'Governance oversight: monitor risks, SLA, and compliance; review AI analysis and department action plans; recommend, comment, and escalate — does not own or close tickets',
  },
  audit_officer: {
    id: 'audit_officer',
    label: 'Compliance Officer',
    description:
      'Validate compliance of department action plans and accomplishments: review supporting documents, approve compliance or request revisions, comment, and generate compliance notes — does not own the ticket',
  },
  executive: {
    id: 'executive',
    label: 'Executive Committee',
    description:
      'View-only oversight: dashboard, heatmap, risk register, reports, trends, statistics, and department performance. May comment on High and Critical risks only.',
  },
  president: {
    id: 'president',
    label: 'President',
    description:
      'Final approving authority for High and Critical risks: review department resolutions, RMU recommendations, and compliance findings; approve, reject, return, or close tickets',
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

const ASSIGNABLE_ROLES = ['supervisor', 'dept_head', 'rm_officer', 'audit_officer', 'executive', 'president', 'employee'];

function getRoleLabel(roleId) {
  return ROLES[roleId]?.label || roleId;
}

module.exports = { ROLES, ASSIGNABLE_ROLES, getRoleLabel };
