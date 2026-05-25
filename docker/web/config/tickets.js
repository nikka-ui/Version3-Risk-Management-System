/** Risk ticket constants aligned to V2 specification. */

const DEFAULT_DEPARTMENT = 'Operations';

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

const GRACE_PERIOD_MS = 30 * 60 * 1000;

function getStatusLabel(status) {
  return TICKET_STATUSES[status]?.label || status;
}

function getCategoryLabel(categoryId) {
  return RISK_CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId;
}

module.exports = {
  DEFAULT_DEPARTMENT,
  RISK_CATEGORIES,
  TICKET_STATUSES,
  SUPERVISOR_ACTION_STATUSES,
  GRACE_PERIOD_MS,
  getStatusLabel,
  getCategoryLabel,
};
