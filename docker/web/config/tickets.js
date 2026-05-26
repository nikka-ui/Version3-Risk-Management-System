/** Risk ticket constants aligned to V2 specification. */

const DEFAULT_DEPARTMENT = 'Operations';

// Department dropdown options for the supervisor "New Risk Report" form.
// (Mirrors the V2 spec list shown in the UI requirements.)
const DEPARTMENTS = [
  'Admin',
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
];

const TICKET_STATUSES = {
  draft: { label: 'Draft', supervisorCanEdit: true },
  submitted: { label: 'Submitted', supervisorCanEdit: false },
  under_review: { label: 'Under RMO Review', supervisorCanEdit: false },
  returned: { label: 'Returned for Revision', supervisorCanEdit: true },
  in_mitigation: { label: 'Implementation Required', supervisorCanEdit: false },
  pending_audit: { label: 'Accomplishment Submitted', supervisorCanEdit: false },
  resolved: { label: 'Resolved', supervisorCanEdit: false },
  closed: { label: 'Closed', supervisorCanEdit: false },
  reopened: { label: 'Reopened', supervisorCanEdit: true },
};

const SUPERVISOR_ACTION_STATUSES = ['in_mitigation', 'returned', 'reopened'];

/** Tickets awaiting initial RMO validation (architecture: Under RMO Review). */
const OFFICER_REVIEW_STATUSES = ['under_review'];

/** Tickets awaiting final RMO effectiveness validation (architecture: Accomplishment Submitted). */
const OFFICER_FINAL_VALIDATION_STATUSES = ['pending_audit'];

/** Tickets RMO may monitor after assigning mitigation. */
const OFFICER_MONITORING_STATUSES = ['in_mitigation', 'returned', 'reopened'];

const GRACE_PERIOD_MS = 30 * 60 * 1000;

function getStatusLabel(status) {
  return TICKET_STATUSES[status]?.label || status;
}

function getCategoryLabel(categoryId) {
  return RISK_CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId;
}

module.exports = {
  DEFAULT_DEPARTMENT,
  DEPARTMENTS,
  RISK_CATEGORIES,
  TICKET_STATUSES,
  SUPERVISOR_ACTION_STATUSES,
  OFFICER_REVIEW_STATUSES,
  OFFICER_FINAL_VALIDATION_STATUSES,
  OFFICER_MONITORING_STATUSES,
  GRACE_PERIOD_MS,
  getStatusLabel,
  getCategoryLabel,
};
