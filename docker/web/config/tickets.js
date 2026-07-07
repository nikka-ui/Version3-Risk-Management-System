/** Risk ticket constants aligned to V2 specification. */

const DEFAULT_DEPARTMENT = 'Operations';

// Organizational departments — AI assigns the responsible department on ticket submission.
const DEPARTMENTS = [
  'Admin',
  'Administration',
  'Corp Plan',
  'Corp Sec',
  'Finance/Accounting',
  'HRMS',
  'Internal Audit',
  'IT',
  'MMCD',
  'Operations',
  'RMO',
  'Treasury',
];

const RISK_CATEGORIES = [
  { id: 'operational', label: 'Operational' },
  { id: 'financial', label: 'Financial' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'strategic', label: 'Strategic' },
  { id: 'reputational', label: 'Reputational' },
  { id: 'environmental', label: 'Environmental Risk' },
];

const TICKET_PRIORITIES = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

const TICKET_STATUSES = {
  draft: { label: 'Draft', supervisorCanEdit: true },
  submitted: { label: 'Submitted', supervisorCanEdit: false },
  // —— Department ownership lifecycle (President's revised model) ——
  assigned: { label: 'Assigned to Department', supervisorCanEdit: false },
  ownership_rejected: { label: 'Returned by Department', supervisorCanEdit: true },
  in_progress: { label: 'In Progress (Department)', supervisorCanEdit: false },
  pending_president: { label: 'Awaiting President Approval', supervisorCanEdit: false },
  pending_president_final: { label: 'Awaiting President Final Decision', supervisorCanEdit: false },
  // —— Legacy Risk Management Unit / Audit workflow ——
  under_review: { label: 'Under RMO Review', supervisorCanEdit: false },
  returned: { label: 'Returned for Revision', supervisorCanEdit: true },
  under_audit: { label: 'Under Audit Review', supervisorCanEdit: false },
  audit_returned: { label: 'Returned by Audit', supervisorCanEdit: false },
  in_mitigation: { label: 'Implementation Required', supervisorCanEdit: false },
  pending_audit: { label: 'Accomplishment Submitted', supervisorCanEdit: false },
  resolved: { label: 'Resolved', supervisorCanEdit: false },
  closed: { label: 'Closed', supervisorCanEdit: false },
  reopened: { label: 'Reopened', supervisorCanEdit: true },
};

const SUPERVISOR_ACTION_STATUSES = ['in_mitigation', 'returned', 'reopened', 'ownership_rejected'];

/** Ticket statuses where the reporter must revise and resubmit. */
const REPORTER_REVISION_STATUSES = ['returned', 'ownership_rejected'];

/** Supervisor may submit an accomplishment after RMO or department mitigation assignment. */
const SUPERVISOR_ACCOMPLISHMENT_STATUSES = ['in_mitigation', 'in_progress', 'reopened'];

/**
 * Tickets awaiting RMU AI classification review (governance oversight — no ownership).
 */
const RMU_AI_REVIEW_STATUSES = ['submitted', 'assigned', 'in_progress', 'ownership_rejected'];

/** Active tickets the RMU monitors for SLA and lifecycle compliance. */
const RMU_MONITORING_STATUSES = [
  'assigned',
  'in_progress',
  'ownership_rejected',
  'pending_president',
  'pending_president_final',
  'under_review',
  'returned',
  'under_audit',
  'audit_returned',
  'in_mitigation',
  'reopened',
  'pending_audit',
];

/** Tickets with department action plans for RMU review. */
const RMU_ACTION_PLAN_STATUSES = ['in_progress', 'pending_president', 'reopened'];

/** Open compliance-category risks for RMU monitoring. */
const RMU_COMPLIANCE_CATEGORY = 'compliance';

/** Legacy RMO workflow queues — disabled; RMU does not own tickets or close them. */
const OFFICER_REVIEW_STATUSES = [];
const OFFICER_FINAL_VALIDATION_STATUSES = [];
const OFFICER_MITIGATION_EDIT_STATUSES = [];
const OFFICER_MONITORING_STATUSES = RMU_MONITORING_STATUSES;

/** Tickets awaiting Compliance Officer review of mitigation solutions. */
const AUDIT_REVIEW_STATUSES = ['under_audit'];

/** Accomplishment reports awaiting Compliance Officer final review (supervisor submitted). */
const AUDIT_FINAL_VALIDATION_STATUSES = ['pending_audit'];

/** Supervisor may view the approved mitigation plan (not draft / audit-in-progress versions). */
const SUPERVISOR_MITIGATION_VISIBLE_STATUSES = [
  'in_mitigation',
  'reopened',
  'pending_audit',
  'closed',
  'resolved',
];

const GRACE_PERIOD_MS = 30 * 60 * 1000;

/* —— Department Head / Vice President ownership lifecycle —— */

/** Tickets routed to the department, awaiting the Department Head's acceptance decision. */
const DEPT_HEAD_INBOX_STATUSES = ['assigned'];

/** Tickets the Department Head owns and is actively working (accepted). */
const DEPT_HEAD_ACTIVE_STATUSES = ['in_progress'];

/** Statuses in which the Department Head may still open/act on the ticket at all. */
const DEPT_HEAD_VISIBLE_STATUSES = [
  'assigned',
  'in_progress',
  'ownership_rejected',
  'under_audit',
  'audit_returned',
  'pending_president',
  'in_mitigation',
  'pending_audit',
  'pending_president_final',
  'resolved',
  'closed',
  'reopened',
];

/** Department Head may accept / reject / reassign ownership only before accepting. */
const DEPT_HEAD_OWNERSHIP_DECISION_STATUSES = ['assigned'];

/** Department Head may build the action plan, assign personnel, and report progress. */
const DEPT_HEAD_EXECUTION_STATUSES = ['in_progress', 'reopened'];

/** Reporter accomplishment submitted — department head reviews and closes the ticket. */
const DEPT_HEAD_CLOSURE_STATUSES = ['pending_audit'];

/** Ticket statuses where reporter overdue SLA no longer applies. */
const REPORTER_OVERDUE_EXCLUDED_STATUSES = [
  'pending_audit',
  'pending_president_final',
  'resolved',
  'closed',
];

/**
 * Canonical department aliases so a Department Head account (whose department is
 * stored using the admin department names, e.g. "Information Technology") can be
 * matched to the short department names the AI router assigns to a ticket
 * (e.g. "IT"). Keys are canonical ids; values are lower-cased aliases.
 */
const DEPARTMENT_ALIASES = {
  it: ['it', 'information technology', 'i.t.', 'it department'],
  finance: ['finance', 'finance/accounting', 'accounting', 'finance and accounting', 'fin'],
  hr: ['hr', 'hrms', 'human resources', 'human resource management'],
  operations: ['operations', 'ops', 'operation'],
  admin: ['admin', 'administration', 'administrative'],
  internal_audit: ['internal audit', 'ia', 'audit'],
  treasury: ['treasury'],
  corp_plan: ['corp plan', 'corporate planning', 'planning'],
  corp_sec: ['corp sec', 'corporate secretary', 'governance'],
  mmcd: ['mmcd', 'maintenance', 'facilities'],
  rmo: ['rmo', 'risk management office', 'risk management', 'risk management unit', 'risk governance office', 'rmu'],
  business_dev: ['business development', 'bd', 'business dev'],
  pceo: ['pceo', 'president and chief executive office', 'office of the president'],
};

function canonicalDepartment(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return '';
  for (const [canonical, aliases] of Object.entries(DEPARTMENT_ALIASES)) {
    if (aliases.includes(key)) return canonical;
  }
  return key;
}

/** True when a user department and a ticket department refer to the same office. */
function departmentsMatch(deptA, deptB) {
  const a = canonicalDepartment(deptA);
  const b = canonicalDepartment(deptB);
  return Boolean(a && b && a === b);
}

function getStatusLabel(status) {
  return TICKET_STATUSES[status]?.label || status;
}

/** Maps a ticket status to a pill tone: info | warn | done | muted | rmo | audit | pending. */
function getStatusTone(status) {
  const tones = {
    draft: 'muted',
    submitted: 'info',
    assigned: 'info',
    ownership_rejected: 'warn',
    in_progress: 'rmo',
    pending_president: 'pending',
    pending_president_final: 'pending',
    under_review: 'rmo',
    returned: 'warn',
    under_audit: 'audit',
    audit_returned: 'warn',
    in_mitigation: 'warn',
    pending_audit: 'pending',
    resolved: 'done',
    closed: 'done',
    reopened: 'warn',
  };
  return tones[status] || 'muted';
}

function getCategoryLabel(categoryId) {
  return RISK_CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId;
}

function getPriorityLabel(priorityId) {
  return TICKET_PRIORITIES.find((p) => p.id === priorityId)?.label || priorityId;
}

/** Maps a ticket priority to a pill tone. */
function getPriorityTone(priorityId) {
  const tones = { urgent: 'bad', high: 'warn', medium: 'info', low: 'muted' };
  return tones[priorityId] || 'muted';
}

module.exports = {
  DEFAULT_DEPARTMENT,
  DEPARTMENTS,
  RISK_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  SUPERVISOR_ACTION_STATUSES,
  REPORTER_REVISION_STATUSES,
  SUPERVISOR_ACCOMPLISHMENT_STATUSES,
  OFFICER_REVIEW_STATUSES,
  OFFICER_FINAL_VALIDATION_STATUSES,
  OFFICER_MONITORING_STATUSES,
  RMU_AI_REVIEW_STATUSES,
  RMU_MONITORING_STATUSES,
  RMU_ACTION_PLAN_STATUSES,
  RMU_COMPLIANCE_CATEGORY,
  AUDIT_REVIEW_STATUSES,
  AUDIT_FINAL_VALIDATION_STATUSES,
  OFFICER_MITIGATION_EDIT_STATUSES,
  SUPERVISOR_MITIGATION_VISIBLE_STATUSES,
  DEPT_HEAD_INBOX_STATUSES,
  DEPT_HEAD_ACTIVE_STATUSES,
  DEPT_HEAD_VISIBLE_STATUSES,
  DEPT_HEAD_OWNERSHIP_DECISION_STATUSES,
  DEPT_HEAD_EXECUTION_STATUSES,
  DEPT_HEAD_CLOSURE_STATUSES,
  REPORTER_OVERDUE_EXCLUDED_STATUSES,
  GRACE_PERIOD_MS,
  canonicalDepartment,
  departmentsMatch,
  getStatusLabel,
  getStatusTone,
  getCategoryLabel,
  getPriorityLabel,
  getPriorityTone,
};
