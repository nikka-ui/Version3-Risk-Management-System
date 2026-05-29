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
  under_audit: { label: 'Under Audit Review', supervisorCanEdit: false },
  audit_returned: { label: 'Returned by Audit', supervisorCanEdit: false },
  in_mitigation: { label: 'Implementation Required', supervisorCanEdit: false },
  pending_audit: { label: 'Accomplishment Submitted', supervisorCanEdit: false },
  resolved: { label: 'Resolved', supervisorCanEdit: false },
  closed: { label: 'Closed', supervisorCanEdit: false },
  reopened: { label: 'Reopened', supervisorCanEdit: true },
};

const SUPERVISOR_ACTION_STATUSES = ['in_mitigation', 'returned', 'reopened'];

/**
 * Tickets awaiting RMO validation. Includes solutions sent back by the Audit
 * Officer (architecture step 4: insufficient → return to RMO), so the RMO can
 * revise the mitigation plan and resubmit it for audit.
 */
const OFFICER_REVIEW_STATUSES = ['under_review', 'audit_returned'];

/** Tickets awaiting final RMO effectiveness validation (architecture: Accomplishment Submitted). */
const OFFICER_FINAL_VALIDATION_STATUSES = ['pending_audit'];

/** Tickets RMO may monitor after audit approval / during implementation. */
const OFFICER_MONITORING_STATUSES = ['under_audit', 'in_mitigation', 'returned', 'reopened'];

/** Tickets awaiting Audit Officer review of the RMO mitigation solution. */
const AUDIT_REVIEW_STATUSES = ['under_audit'];

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
  AUDIT_REVIEW_STATUSES,
  GRACE_PERIOD_MS,
  getStatusLabel,
  getCategoryLabel,
};
