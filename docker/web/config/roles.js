/**
 * Canonical role registry — single source of truth for the whole system.
 *
 * Every workflow role maps to the console module it unlocks (`path`) and whether
 * an administrator may assign it in User Management (`assignable`). Adding or
 * renaming a role here automatically updates the User Management dropdown,
 * create/edit validation, and login routing.
 */

const ROLES = {
  supervisor: {
    id: 'supervisor',
    label: 'Ticket Reporter',
    description: 'Report organizational risks, track tickets, and submit accomplishments',
    path: '/supervisor',
    assignable: true,
  },
  dept_head: {
    id: 'dept_head',
    label: 'Department Head / Vice President',
    description: 'Owns tickets routed to their department: accept, reject, reassign, plan, and resolve',
    path: '/dept',
    assignable: true,
  },
  rm_officer: {
    id: 'rm_officer',
    label: 'Risk Governance Office (RMU)',
    description:
      'Governance oversight: view organizational risks, monitor SLA and compliance, and participate in ticket discussion threads — does not own, edit, or close tickets',
    path: '/officer',
    assignable: true,
  },
  audit_officer: {
    id: 'audit_officer',
    label: 'Compliance Officer',
    description:
      'Validate compliance of department action plans and accomplishments: review supporting documents, approve compliance or request revisions, comment, and generate compliance notes — does not own the ticket',
    path: '/audit',
    assignable: true,
  },
  executive: {
    id: 'executive',
    label: 'Executive Committee',
    description:
      'View-only oversight: dashboard, heatmap, risk register, reports, trends, statistics, and department performance. May comment on High and Critical risks only.',
    path: '/executive',
    assignable: true,
  },
  president: {
    id: 'president',
    label: 'President',
    description:
      'Final approving authority for High and Critical risks: review department resolutions, RMU recommendations, and compliance findings; approve, reject, return, or close tickets',
    path: '/president',
    assignable: true,
  },
  admin: {
    id: 'admin',
    label: 'System Administrator',
    description: 'Manage accounts, roles, and system logs',
    path: '/admin',
    assignable: true,
  },
  employee: {
    id: 'employee',
    label: 'Employee',
    description: 'General staff access to assigned risk workflows',
    path: '/dashboard',
    assignable: false,
  },
};

/**
 * Canonical display/assignment order. Only roles listed here (and marked
 * `assignable`) appear in the User Management role dropdown.
 */
const ROLE_ORDER = ['supervisor', 'dept_head', 'rm_officer', 'audit_officer', 'executive', 'president', 'admin'];

const ASSIGNABLE_ROLES = ROLE_ORDER.filter((id) => ROLES[id]?.assignable);

function getRoleLabel(roleId) {
  return ROLES[roleId]?.label || roleId;
}

function isAssignableRole(roleId) {
  return Boolean(ROLES[roleId]?.assignable);
}

/** Landing/console path for a role, used for login + dashboard redirects. */
function roleDashboardPath(roleId) {
  return ROLES[roleId]?.path || '/dashboard';
}

module.exports = {
  ROLES,
  ROLE_ORDER,
  ASSIGNABLE_ROLES,
  getRoleLabel,
  isAssignableRole,
  roleDashboardPath,
};
