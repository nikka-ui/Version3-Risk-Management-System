const crypto = require('crypto');

const {
  DEFAULT_DEPARTMENT,
  DEPARTMENTS,
  TICKET_STATUSES,
  SUPERVISOR_ACTION_STATUSES,
  SUPERVISOR_ACCOMPLISHMENT_STATUSES,
  OFFICER_REVIEW_STATUSES,
  OFFICER_FINAL_VALIDATION_STATUSES,
  OFFICER_MONITORING_STATUSES,
  RMU_AI_REVIEW_STATUSES,
  RMU_MONITORING_STATUSES,
  RMU_ACTION_PLAN_STATUSES,
  RMU_COMPLIANCE_CATEGORY,
  RISK_CATEGORIES,
  AUDIT_REVIEW_STATUSES,
  AUDIT_FINAL_VALIDATION_STATUSES,
  OFFICER_MITIGATION_EDIT_STATUSES,
  SUPERVISOR_MITIGATION_VISIBLE_STATUSES,
  DEPT_HEAD_INBOX_STATUSES,
  DEPT_HEAD_ACTIVE_STATUSES,
  DEPT_HEAD_VISIBLE_STATUSES,
  DEPT_HEAD_OWNERSHIP_DECISION_STATUSES,
  DEPT_HEAD_EXECUTION_STATUSES,
  GRACE_PERIOD_MS,
  departmentsMatch,
  getStatusLabel,
  getCategoryLabel,
  getPriorityLabel,
} = require('../config/tickets');
const {
  saveUploadedFiles,
  saveLegacyEvidenceReferences,
  deleteTicketUploads,
  removeAttachmentsFromTicket,
  hydrateTicketEvidence,
} = require('./attachments');
const attachmentRepo = require('./attachmentRepository');
const {
  notifyExecutiveComment,
  notifyExecutiveReply,
  notifyPrivateComment,
  notifyReporterTicketUpdate,
  notifyRmoTicketSubmitted,
  notifyRoles,
  notifyUser,
  notifyDeptHeadsForDepartment,
  notifyWorkflowStakeholders,
  formatDepartmentLabel,
} = require('./notifications');
const { getRoleLabel } = require('../config/roles');

function getStore() {
  const { loadStore, saveStore } = require('./store');
  return { store: loadStore(), saveStore };
}

function isVisibleTicket(ticket) {
  return ticket && !ticket.deleted;
}

function nextTicketRef(store) {
  const year = new Date().getFullYear();
  const prefix = `RISK-${year}-`;
  const nums = (store.riskTickets || [])
    .map((t) => t.reference)
    .filter((r) => r && r.startsWith(prefix))
    .map((r) => parseInt(r.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

function peekNextTicketRef() {
  const { loadStore } = require('./store');
  const store = loadStore();
  return nextTicketRef(store);
}

function computeTicketOverdue(ticket) {
  if (['closed', 'resolved', 'draft'].includes(ticket.status)) return false;
  const dueRaw = ticket.actionPlan?.targetDate || ticket.mitigationDueAt;
  if (!dueRaw) return false;
  return new Date(dueRaw) < new Date();
}

function publicTicket(ticket) {
  return {
    id: ticket.id,
    reference: ticket.reference,
    title: ticket.title,
    status: ticket.status,
    statusLabel: getStatusLabel(ticket.status),
    category: ticket.category,
    categoryLabel: getCategoryLabel(ticket.category),
    department: ticket.department,
    responsibleDepartment: ticket.department || ticket.ai?.responsibleDepartment || null,
    reporterDepartment: ticket.reporterDepartment || null,
    priority: ticket.priority || ticket.ai?.priority || null,
    priorityLabel: ticket.priority ? getPriorityLabel(ticket.priority) : null,
    location: ticket.location,
    likelihood: ticket.likelihood,
    impact: ticket.impact,
    riskScore: ticket.riskScore,
    submittedBy: ticket.submittedBy,
    submittedByName: ticket.submittedByName,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    submittedAt: ticket.submittedAt,
    ai: ticket.ai || null,
    routedAt: ticket.routedAt || null,
    finalDecision: ticket.finalDecision || null,
    ownership: ticket.ownership || null,
    ownerUsername: ticket.ownership?.ownerUsername || null,
    ownerName: ticket.ownership?.ownerName || null,
    ownershipState: ticket.ownership?.state || (ticket.department ? 'pending' : 'unassigned'),
    hasActionPlan: Boolean(ticket.actionPlan && ticket.actionPlan.summary),
    actionPlanVersion: ticket.actionPlan?.version || 0,
    personnelCount: (ticket.personnel || []).length,
    progressUpdateCount: (ticket.progressUpdates || []).length,
    latestProgressPercent: (ticket.progressUpdates || []).length
      ? ticket.progressUpdates[ticket.progressUpdates.length - 1].percent ?? null
      : null,
    hasFinalResolution: Boolean(ticket.finalResolution && ticket.finalResolution.summary),
    presidentDecision: ticket.presidentDecision || null,
    presidentPlanDecision: ticket.presidentPlanDecision || null,
    presidentFinalDecision: ticket.presidentFinalDecision || null,
    presidentReviewPhase: ticket.presidentReviewPhase || null,
    fiveW1H: ticket.fiveW1H,
    evidenceCount: ticket.evidenceCount ?? (ticket.evidence || []).length,
    hasAccomplishment: Boolean(ticket.accomplishmentId),
    officerNotes: ticket.officerNotes || null,
    auditNotes: ticket.auditNotes || null,
    mitigationDueAt: ticket.mitigationDueAt || null,
    mitigationPlanVersion: ticket.mitigationPlanVersion || 0,
    hasMitigationPlan: Boolean(ticket.officerNotes && ticket.mitigationPlanVersion),
    isOverdue: computeTicketOverdue(ticket),
    hasRmuRecommendation: Boolean((ticket.rmuRecommendations || []).length),
    isEscalated: Boolean((ticket.escalations || []).length),
    aiOverrideApplied: Boolean(ticket.ai?.overrideHistory?.length),
  };
}

function clampInt(n, min, max) {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function riskLevelFromSeverity(severity1to5) {
  const sev = clampInt(severity1to5, 1, 5);
  if (sev <= 2) return { id: 'low', label: 'Low' };
  if (sev === 3) return { id: 'moderate', label: 'Moderate' };
  if (sev === 4) return { id: 'high', label: 'High' };
  return { id: 'critical', label: 'Extreme/Critical' };
}

function detectRiskCategory(text) {
  const s = String(text || '').toLowerCase();
  const environmental = [
    'environment',
    'environmental',
    'pollution',
    'spill',
    'emission',
    'waste',
    'hazardous',
    'contamination',
    'ecosystem',
    'climate',
  ];
  const compliance = [
    'audit',
    'compliance',
    'regulation',
    'policy',
    'noncompliance',
    'penalt',
    'sanction',
    'regulatory',
    'iso',
    'iso 31000',
  ];
  const financial = ['finance', 'financial', 'account', 'invoice', 'payment', 'budget', 'tax', 'revenue', 'cost', 'fraud'];
  const reputational = ['reputation', 'brand', 'public', 'media', 'customer', 'customer trust', 'lawsuit', 'scandal'];
  const strategic = ['strategy', 'strategic', 'market', 'competitor', 'competitors', 'growth', 'roadmap'];

  const any = (arr) => arr.some((k) => s.includes(k));
  if (any(environmental)) return 'environmental';
  if (any(compliance)) return 'compliance';
  if (any(financial)) return 'financial';
  if (any(reputational)) return 'reputational';
  if (any(strategic)) return 'strategic';
  return 'operational';
}

const DEPARTMENT_KEYWORDS = {
  IT: ['server', 'network', 'cyber', 'software', 'database', 'system', 'hack', 'malware', 'phishing', 'it ', 'data breach', 'outage'],
  'Finance/Accounting': ['finance', 'financial', 'invoice', 'payment', 'budget', 'accounting', 'tax', 'revenue', 'fraud', 'ledger'],
  HRMS: ['employee', 'hr ', 'hiring', 'payroll', 'workforce', 'staff', 'personnel', 'labor'],
  'Internal Audit': ['audit finding', 'control deficiency', 'internal control'],
  MMCD: ['maintenance', 'facility', 'building', 'equipment', 'machinery', 'infrastructure'],
  Operations: ['operational', 'production', 'process', 'supply', 'logistics', 'manufacturing'],
  Treasury: ['treasury', 'cash', 'liquidity', 'investment'],
  Admin: ['administration', 'administrative', 'office management', 'records', 'general services'],
  'Corp Plan': ['corporate planning', 'strategic plan', 'planning office'],
  'Corp Sec': ['corporate secretary', 'governance', 'board'],
  RMO: ['risk management', 'enterprise risk', 'risk register'],
};

function detectResponsibleDepartment(text, riskCategory) {
  const s = String(text || '').toLowerCase();
  let bestDept = null;
  let bestScore = 0;

  for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    const score = keywords.reduce((acc, k) => (s.includes(k) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestDept = dept;
    }
  }

  if (bestDept && DEPARTMENTS.includes(bestDept)) return bestDept;

  const categoryDefaults = {
    environmental: 'Admin',
    financial: 'Finance/Accounting',
    compliance: 'Internal Audit',
    reputational: 'Corp Sec',
    strategic: 'Corp Plan',
    operational: 'Operations',
  };
  const fallback = categoryDefaults[riskCategory] || DEFAULT_DEPARTMENT;
  return DEPARTMENTS.includes(fallback) ? fallback : DEFAULT_DEPARTMENT;
}

function determinePriority(riskLevel, severity) {
  const level = riskLevel?.id || 'low';
  const sev = clampInt(severity, 1, 5);
  if (level === 'critical' || sev >= 5) return 'urgent';
  if (level === 'high' || sev >= 4) return 'high';
  if (level === 'moderate' || sev >= 3) return 'medium';
  return 'low';
}

function suggestInitialMitigation(riskCategory, riskLevel, fiveW1H) {
  const categoryLabel = getCategoryLabel(riskCategory);
  const levelLabel = riskLevel?.label || 'Moderate';
  const what = String(fiveW1H?.what || 'the reported incident').trim();

  const templates = {
    environmental: `Contain and assess environmental impact from ${what}. Notify relevant authorities if required, document the incident site, and implement immediate containment measures.`,
    financial: `Secure affected financial records and transactions related to ${what}. Initiate reconciliation review and escalate to Finance leadership for control assessment.`,
    compliance: `Document the compliance gap identified in ${what}. Review applicable policies/regulations and prepare a corrective action plan with accountable owners.`,
    reputational: `Prepare a stakeholder communication plan regarding ${what}. Coordinate with Corporate Secretary and limit further reputational exposure.`,
    strategic: `Assess strategic implications of ${what} on organizational objectives. Convene planning stakeholders to evaluate impact and response options.`,
    operational: `Stabilize operations affected by ${what}. Implement interim controls, assign an incident owner, and monitor until permanent corrective actions are in place.`,
  };

  const base = templates[riskCategory] || templates.operational;
  return `${base} Given the ${levelLabel} risk level, prioritize actions within 48–72 hours and report progress to the Risk Management Unit.`;
}

function generateAiAnalysisFromReport({ title, location, fiveW1H, evidenceFiles, reporterDepartment }) {
  const joined = [
    title,
    location,
    fiveW1H?.what,
    fiveW1H?.why,
    fiveW1H?.where,
    fiveW1H?.when,
    fiveW1H?.who,
    fiveW1H?.how,
    reporterDepartment,
  ]
    .filter(Boolean)
    .join(' ');

  const s = String(joined || '').toLowerCase();

  const impactKeywords = ['breach', 'fraud', 'shutdown', 'injury', 'penalt', 'sanction', 'lawsuit', 'leak', 'outage', 'major', 'spill', 'contamination'];
  const likelihoodKeywords = ['often', 'frequent', 'recurr', 'pattern', 'may', 'could', 'lack of', 'weak', 'previous', 'history'];

  const countHits = (arr) => arr.reduce((acc, k) => (s.includes(k) ? acc + 1 : acc), 0);
  const impactHits = countHits(impactKeywords);
  const likelihoodHits = countHits(likelihoodKeywords);

  const lenBoost = Math.floor((s.length || 0) / 450);
  const base = 2;

  const likelihood = clampInt(base + lenBoost + likelihoodHits * 1.2, 1, 5);
  const impact = clampInt(base + lenBoost + impactHits * 1.3, 1, 5);

  const severity = clampInt(Math.round((likelihood + impact) / 2), 1, 5);
  const riskLevel = riskLevelFromSeverity(severity);

  const riskCategory = detectRiskCategory(s);
  const responsibleDepartment = detectResponsibleDepartment(s, riskCategory);
  const priority = determinePriority(riskLevel, severity);
  const suggestedMitigation = suggestInitialMitigation(riskCategory, riskLevel, fiveW1H);

  const evidenceCount = Array.isArray(evidenceFiles) ? evidenceFiles.length : 0;
  const confidenceBase = 0.72;
  const evidenceBoost = evidenceCount >= 1 ? 0.1 : 0;
  const richTextBoost = (s.length || 0) > 180 ? 0.08 : 0;
  const deptBoost = responsibleDepartment ? 0.04 : 0;
  const confidence = Math.max(0.5, Math.min(0.98, confidenceBase + evidenceBoost + richTextBoost + deptBoost));

  const titleSafe = String(title || '').trim();
  const what = String(fiveW1H?.what || '').trim();
  const why = String(fiveW1H?.why || '').trim();

  const summary = `AI analysis: "${titleSafe || 'Untitled'}" describes an incident where ${what || 'the event occurred'} due to ${why || 'factors described in the report'}. Classified as ${getCategoryLabel(riskCategory)} with ${riskLevel.label} severity (likelihood ${likelihood}/5, impact ${impact}/5). Recommended routing to ${responsibleDepartment} with ${getPriorityLabel(priority)} priority.`;

  return {
    summary,
    likelihood,
    impact,
    riskCategory,
    severity,
    riskLevel,
    responsibleDepartment,
    priority,
    priorityLabel: getPriorityLabel(priority),
    suggestedMitigation,
    confidence: Math.round(confidence * 100) / 100,
    manualReviewRequired: confidence < 0.75,
    processedAt: new Date().toISOString(),
  };
}

function isDraftTicket(ticket) {
  return ticket?.status === 'draft';
}

/** Draft-only delete from My Tickets. */
function canSupervisorDraftCrud(ticket) {
  return isDraftTicket(ticket);
}

/** Supervisor may revise a draft or a report returned by the RMO. */
function canSupervisorReviseReport(ticket) {
  return ticket?.status === 'draft' || ticket?.status === 'returned';
}

function canSupervisorEdit(ticket) {
  const status = TICKET_STATUSES[ticket.status];
  if (!status) return false;
  if (status.supervisorCanEdit) return true;
  if (ticket.status === 'submitted' && ticket.submittedAt) {
    const elapsed = Date.now() - new Date(ticket.submittedAt).getTime();
    return elapsed < GRACE_PERIOD_MS;
  }
  return false;
}

function canSupervisorSubmitAccomplishment(ticket) {
  return Boolean(
    ticket?.officerNotes?.trim()
    && ticket?.mitigationDueAt
    && SUPERVISOR_ACCOMPLISHMENT_STATUSES.includes(ticket.status),
  );
}

function findAttachmentOnTicket(ticket, attachmentId) {
  return (ticket?.evidence || []).find((a) => a.id === attachmentId) || null;
}

async function findAttachmentForUser(attachmentId, username) {
  const attachment = await attachmentRepo.findById(attachmentId);
  if (!attachment) return null;
  const ticket = getTicketByRef(attachment.ticketRef, username);
  if (!ticket) return null;
  return { ticket, attachment };
}

async function mergeUploadedEvidence(ticket, uploadedFiles, uploadedBy) {
  if (!uploadedFiles?.length) return null;
  const result = await saveUploadedFiles(ticket.reference, uploadedFiles, {
    uploadedBy: uploadedBy || ticket.submittedBy,
  });
  if (result.error) return result;
  ticket.evidence = [...(ticket.evidence || []), ...result.attachments];
  ticket.evidenceCount = ticket.evidence.length;
  return null;
}

function listTicketsForSupervisor(username) {
  const { store } = getStore();
  return (store.riskTickets || [])
    .filter((t) => isVisibleTicket(t) && t.submittedBy === username)
    .map(publicTicket)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getTicketByRef(reference, username) {
  const { store } = getStore();
  const ticket = (store.riskTickets || []).find(
    (t) => t.reference === reference && t.submittedBy === username,
  );
  if (!ticket) return null;
  return ticket;
}

function getSupervisorStats(username) {
  const tickets = listTicketsForSupervisor(username);
  const { store } = getStore();
  const accomplishments = (store.accomplishments || []).filter((a) => a.submittedBy === username);
  const { getUnreadNotificationCount } = require('./store');
  const user = { username, role: 'supervisor' };
  return {
    total: tickets.length,
    drafts: tickets.filter((t) => t.status === 'draft').length,
    submitted: tickets.filter((t) => t.status !== 'draft').length,
    active: tickets.filter((t) => !['draft', 'closed', 'resolved'].includes(t.status)).length,
    actionRequired: tickets.filter((t) => SUPERVISOR_ACTION_STATUSES.includes(t.status)).length,
    returned: tickets.filter((t) => t.status === 'returned').length,
    overdue: tickets.filter((t) => t.isOverdue).length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    accomplishments: accomplishments.length,
    unreadNotifications: getUnreadNotificationCount(user),
  };
}

function listActionTickets(username) {
  return listTicketsForSupervisor(username).filter((t) =>
    SUPERVISOR_ACTION_STATUSES.includes(t.status),
  );
}

function listAccomplishments(username) {
  const { store } = getStore();
  return [...(store.accomplishments || [])]
    .filter((a) => a.submittedBy === username)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

function parseFiveW1H(body) {
  return {
    what: String(body.what || '').trim(),
    why: String(body.why || '').trim(),
    where: String(body.where || '').trim(),
    when: String(body.when || '').trim(),
    who: String(body.who || '').trim(),
    how: String(body.how || '').trim(),
  };
}

/** Legacy text-only evidence lines (pre–file storage). */
function parseEvidenceList(raw) {
  return String(raw || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((name, i) => ({
      id: `ev-${Date.now()}-${i}`,
      name,
      uploadedAt: new Date().toISOString(),
      legacy: true,
    }));
}

function parseRemoveAttachmentIds(body) {
  const raw = body.removeAttachmentIds;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildTicketRevisionPayload(ticket) {
  const w = ticket?.fiveW1H || {};
  return {
    title: String(ticket?.title || '').trim(),
    location: String(ticket?.location || '').trim(),
    mitigationApproach: String(ticket?.mitigationApproach || '').trim(),
    what: String(w.what || '').trim(),
    why: String(w.why || '').trim(),
    where: String(w.where || '').trim(),
    when: String(w.when || '').trim(),
    who: String(w.who || '').trim(),
    how: String(w.how || '').trim(),
    evidenceIds: (ticket?.evidence || []).map((e) => e.id).sort(),
  };
}

function hashTicketRevision(ticket) {
  return crypto.createHash('sha256').update(JSON.stringify(buildTicketRevisionPayload(ticket))).digest('hex');
}

function hasRevisionSinceReturn(ticket) {
  if (ticket?.status !== 'returned') return true;
  if (!ticket.returnRevisionHash) return true;
  return hashTicketRevision(ticket) !== ticket.returnRevisionHash;
}

function captureReturnRevisionSnapshot(ticket) {
  ticket.returnedAt = new Date().toISOString();
  ticket.returnRevisionHash = hashTicketRevision(ticket);
}

function ensureReturnRevisionBaseline(ticket) {
  if (ticket?.status === 'returned' && !ticket.returnRevisionHash) {
    captureReturnRevisionSnapshot(ticket);
    return true;
  }
  return false;
}

function mockAiClassification(ticket) {
  return generateAiAnalysisFromReport({
    title: ticket.title,
    location: ticket.location,
    fiveW1H: ticket.fiveW1H,
    evidenceFiles: ticket.evidence,
    reporterDepartment: ticket.reporterDepartment,
  });
}

function parseMentions(text) {
  const matches = String(text || '').match(/@([a-zA-Z0-9._-]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

function buildThreadCommentRecord(user, text, { parentId = null, kind = 'comment', attachments = [] } = {}) {
  const now = new Date().toISOString();
  return {
    id: `thr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    authorUsername: user.username,
    authorName: user.displayName || user.username,
    authorRole: user.role,
    roleLabel: user.roleLabel || getRoleLabel(user.role),
    body: text,
    at: now,
    editedAt: null,
    parentId,
    kind,
    mentions: parseMentions(text),
    reactions: {},
    attachments: attachments.map((a) => ({
      id: a.id,
      name: a.name || a.originalName,
      href: a.href || null,
    })),
  };
}

function notifyMentionedUsers(ticket, comment, actor) {
  const { listUsers } = require('./store');
  const users = listUsers();
  for (const mention of comment.mentions || []) {
    const target = users.find((u) => u.username.toLowerCase() === mention);
    if (target && target.username !== actor.username) {
      notifyUser(target.username, {
        type: 'mention',
        title: 'You were mentioned',
        message: `${actor.displayName || actor.username} mentioned you on ${ticket.reference}`,
        ticketRef: ticket.reference,
        fromUsername: actor.username,
        fromName: actor.displayName || actor.username,
        fromRole: actor.role,
      });
    }
  }
}

function ensureThreadComments(ticket) {
  if (!ticket.threadComments) ticket.threadComments = [];
}

function findThreadComment(ticket, commentId) {
  ensureThreadComments(ticket);
  return ticket.threadComments.find((c) => c.id === commentId) || null;
}

function ensureAuditTrail(ticket) {
  if (!ticket.auditTrail) ticket.auditTrail = [];
}

function appendTicketAuditEvent(ticket, { action, detail, actorUsername, actorName, actorRole }) {
  ensureAuditTrail(ticket);
  ticket.auditTrail.push({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    action,
    detail: detail || null,
    actorUsername: actorUsername || null,
    actorName: actorName || null,
    actorRole: actorRole || null,
  });
  if (ticket.auditTrail.length > 100) {
    ticket.auditTrail = ticket.auditTrail.slice(-100);
  }
}

function getTicketTimelineForReporter(ticket) {
  const events = [];
  ensureAuditTrail(ticket);

  if (ticket.createdAt) {
    events.push({
      at: ticket.createdAt,
      action: 'Draft created',
      detail: 'Risk report draft started.',
      actorName: ticket.submittedByName || ticket.submittedBy,
    });
  }
  if (ticket.submittedAt) {
    events.push({
      at: ticket.submittedAt,
      action: 'Ticket submitted',
      detail: 'Report submitted for AI analysis and routing.',
      actorName: ticket.submittedByName || ticket.submittedBy,
    });
  }
  if (ticket.routedAt && ticket.department) {
    events.push({
      at: ticket.routedAt,
      action: 'Automatically routed',
      detail: `Assigned to ${ticket.department} based on AI classification.`,
      actorName: 'AI Routing Engine',
    });
  }
  if (ticket.returnedAt) {
    events.push({
      at: ticket.returnedAt,
      action: 'Returned for revision',
      detail: ticket.officerNotes || 'Returned by Risk Management Unit.',
      actorName: 'Risk Management Unit',
    });
  }
  if (ticket.mitigationDueAt && ticket.officerNotes) {
    events.push({
      at: ticket.updatedAt,
      action: 'Mitigation plan assigned',
      detail: ticket.officerNotes,
      actorName: 'Risk Management Unit',
    });
  }
  if (ticket.finalDecision?.at) {
    events.push({
      at: ticket.finalDecision.at,
      action: 'Final decision',
      detail: ticket.finalDecision.summary || ticket.finalDecision.decision,
      actorName: ticket.finalDecision.authorName || 'Approving authority',
    });
  }

  for (const entry of ticket.auditTrail || []) {
    events.push({
      at: entry.at,
      action: entry.action,
      detail: entry.detail,
      actorName: entry.actorName || entry.actorUsername,
    });
  }

  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}

async function createTicket(username, displayName, body, { referenceOverride, uploadedFiles, reporterDepartment } = {}) {
  const { store, saveStore } = getStore();
  if (!store.riskTickets) store.riskTickets = [];
  const ref = referenceOverride || nextTicketRef(store);
  const existing = (store.riskTickets || []).find(
    (t) => t.reference === ref && t.submittedBy === username,
  );
  if (existing) {
    if (!isDraftTicket(existing)) {
      return { error: 'This ticket can no longer be edited.' };
    }
    return updateTicketDraft(ref, username, body, { uploadedFiles });
  }

  const now = new Date().toISOString();
  const fiveW1H = parseFiveW1H(body);
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Risk title is required.' };
  if (!fiveW1H.what || !fiveW1H.why) {
    return { error: 'What happened and why are required (5W1H).' };
  }

  const evidenceFromUpload = [];
  const uploadResult = uploadedFiles?.length
    ? await saveUploadedFiles(ref, uploadedFiles, { uploadedBy: username })
    : { attachments: [] };
  if (uploadResult.error) return { error: uploadResult.error };
  evidenceFromUpload.push(...(uploadResult.attachments || []));

  let legacyEvidence = [];
  if (!uploadedFiles?.length && body.evidenceFiles) {
    legacyEvidence = parseEvidenceList(body.evidenceFiles);
    if (legacyEvidence.length) {
      legacyEvidence = await saveLegacyEvidenceReferences(ref, legacyEvidence, { uploadedBy: username });
    }
  }

  const evidenceFiles = [...evidenceFromUpload, ...legacyEvidence];
  if (!evidenceFiles.length) {
    return { error: 'At least one evidence file is required.' };
  }

  const ai = generateAiAnalysisFromReport({
    title,
    location: String(body.location || '').trim(),
    fiveW1H,
    evidenceFiles,
    reporterDepartment: String(reporterDepartment || body.reporterDepartment || '').trim() || null,
  });

  const description =
    String(body.description || '')
      .trim()
      .replace(/\n{3,}/g, '\n\n') ||
    [fiveW1H?.what, fiveW1H?.why, fiveW1H?.where, fiveW1H?.when, fiveW1H?.who, fiveW1H?.how]
      .filter(Boolean)
      .join('\n');

  const ticket = {
    id: `tkt-${Date.now()}`,
    reference: ref,
    title,
    description,
    reporterDepartment: String(reporterDepartment || body.reporterDepartment || '').trim() || null,
    department: null,
    location: String(body.location || '').trim(),
    category: ai.riskCategory,
    likelihood: ai.likelihood,
    impact: ai.impact,
    riskScore: null,
    priority: null,
    mitigationApproach: String(body.mitigationApproach || '').trim(),
    fiveW1H,
    evidenceCount: evidenceFiles.length,
    status: 'draft',
    submittedBy: username,
    submittedByName: displayName,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    routedAt: null,
    ai,
    accomplishmentId: null,
    mitigationDueAt: null,
    officerNotes: null,
    auditNotes: null,
    privateComments: [],
    executiveComments: [],
    threadComments: [],
    auditTrail: [],
    mitigationPlanHistory: [],
    mitigationPlanVersion: 0,
    finalDecision: null,
    ownership: null,
    reassignments: [],
    actionPlan: null,
    personnel: [],
    progressUpdates: [],
    finalResolution: null,
    presidentDecision: null,
  };
  ticket.riskScore = ticket.likelihood * ticket.impact;
  store.riskTickets.push(ticket);
  saveStore();
  ticket.evidence = evidenceFiles;
  return { ticket: publicTicket(ticket) };
}

async function updateTicketDraft(reference, username, body, { uploadedFiles, draftOnly = true } = {}) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  if (draftOnly && !canSupervisorDraftCrud(ticket)) {
    return { error: 'Only draft tickets can be edited from My Tickets.' };
  }
  if (!draftOnly && !canSupervisorReviseReport(ticket) && !canSupervisorEdit(ticket)) {
    return { error: 'This ticket can no longer be edited.' };
  }

  await hydrateTicketEvidence(ticket);

  const fiveW1H = parseFiveW1H(body);
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Risk title is required.' };
  if (!fiveW1H.what || !fiveW1H.why) {
    return { error: 'What happened and why are required (5W1H).' };
  }

  await removeAttachmentsFromTicket(ticket, parseRemoveAttachmentIds(body));

  ticket.title = title;
  ticket.description =
    String(body.description || '').trim() ||
    [fiveW1H.what, fiveW1H.why, fiveW1H.where, fiveW1H.when, fiveW1H.who, fiveW1H.how]
      .filter(Boolean)
      .join('\n');
  ticket.location = String(body.location || '').trim();
  ticket.mitigationApproach = String(body.mitigationApproach || '').trim();
  if (body.reporterDepartment) {
    ticket.reporterDepartment = String(body.reporterDepartment).trim();
  }
  ticket.fiveW1H = fiveW1H;

  const uploadErr = await mergeUploadedEvidence(ticket, uploadedFiles, username);
  if (uploadErr) return uploadErr;

  if (!uploadedFiles?.length && body.evidenceFiles) {
    const added = parseEvidenceList(body.evidenceFiles);
    if (added.length) {
      const saved = await saveLegacyEvidenceReferences(ticket.reference, added, { uploadedBy: username });
      ticket.evidence = [...(ticket.evidence || []), ...saved];
    }
  }

  if (!(ticket.evidence || []).length) {
    return { error: 'At least one evidence file is required.' };
  }
  ticket.evidenceCount = ticket.evidence.length;

  const ai = generateAiAnalysisFromReport({
    title: ticket.title,
    location: ticket.location,
    fiveW1H: ticket.fiveW1H,
    evidenceFiles: ticket.evidence,
    reporterDepartment: ticket.reporterDepartment,
  });
  ticket.category = ai.riskCategory;
  ticket.likelihood = ai.likelihood;
  ticket.impact = ai.impact;
  ticket.riskScore = ticket.likelihood * ticket.impact;
  ticket.ai = ai;
  ticket.updatedAt = new Date().toISOString();

  if (!draftOnly && ticket.status === 'returned' && !hasRevisionSinceReturn(ticket)) {
    return {
      error: 'You must update the report details or evidence before resubmitting to the RMO.',
    };
  }

  saveStore();
  return { ticket: publicTicket(ticket) };
}

async function deleteDraftTicket(reference, username) {
  const { store, saveStore } = getStore();
  const idx = (store.riskTickets || []).findIndex(
    (t) => t.reference === reference && t.submittedBy === username,
  );
  if (idx < 0) return { error: 'Ticket not found.' };
  const ticket = store.riskTickets[idx];
  if (!canSupervisorDraftCrud(ticket)) {
    return { error: 'Only draft tickets can be deleted.' };
  }
  await deleteTicketUploads(ticket.reference);
  store.riskTickets.splice(idx, 1);
  saveStore();
  return { reference: ticket.reference };
}

function submitTicket(reference, username, displayName) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!canSupervisorEdit(ticket) && ticket.status !== 'draft' && ticket.status !== 'returned') {
    return { error: 'This ticket cannot be submitted.' };
  }
  if (ticket.status === 'returned' && !hasRevisionSinceReturn(ticket)) {
    return {
      error: 'You must update the report details or evidence before resubmitting to the RMO.',
    };
  }

  const now = new Date().toISOString();
  const ai = mockAiClassification(ticket);
  ticket.ai = ai;
  ticket.category = ai.riskCategory;
  ticket.likelihood = ai.likelihood;
  ticket.impact = ai.impact;
  ticket.riskScore = ticket.likelihood * ticket.impact;
  ticket.priority = ai.priority;
  ticket.department = ai.responsibleDepartment;
  ticket.routedAt = now;

  const wasReturned = ticket.status === 'returned';
  // President's revised model: AI routes the ticket directly to the responsible
  // department, whose Department Head / Vice President becomes the ticket owner.
  ticket.status = 'assigned';
  ticket.ownership = {
    state: 'pending',
    ownerUsername: null,
    ownerName: null,
    ownerDepartment: ticket.department,
    assignedAt: now,
    acceptedAt: null,
    rejectedAt: null,
    rejectionReason: null,
  };
  if (wasReturned) {
    ticket.officerNotes = null;
    ticket.mitigationDueAt = null;
    ticket.returnRevisionHash = null;
    ticket.returnedAt = null;
  }
  ticket.submittedAt = ticket.submittedAt || now;
  ticket.routedAt = now;
  ticket.updatedAt = now;

  appendTicketAuditEvent(ticket, {
    action: wasReturned ? 'Report resubmitted' : 'Reporter created ticket',
    detail: wasReturned
      ? 'Reporter revised and resubmitted the risk report.'
      : 'Risk report submitted for AI analysis.',
    actorUsername: username,
    actorName: displayName || username,
    actorRole: 'supervisor',
  });
  appendTicketAuditEvent(ticket, {
    action: 'AI classified ticket',
    detail: `${getCategoryLabel(ticket.category)} · ${ai.riskLevel?.label || 'Risk'} · ${Math.round(ai.confidence * 100)}% confidence`,
    actorUsername: 'system',
    actorName: 'AI Routing Engine',
    actorRole: 'system',
  });
  appendTicketAuditEvent(ticket, {
    action: `Assigned to ${ticket.department}`,
    detail: `${getPriorityLabel(ticket.priority)} priority. Awaiting Department Head acceptance.`,
    actorUsername: 'system',
    actorName: 'AI Routing Engine',
    actorRole: 'system',
  });

  saveStore();

  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: username,
    submitterRole: 'supervisor',
    status: getStatusLabel(ticket.status),
    action: wasReturned ? 'resubmitted' : 'submitted',
    detail: `Routed to ${ticket.department}`,
  });

  notifyWorkflowStakeholders(ticket, 'assignment', {
    actor: { username, displayName: displayName || username, role: 'supervisor' },
    excludeUsername: username,
    type: 'ticket_assigned',
    title: 'New risk ticket assigned',
    message: `${displayName || username || 'A reporter'} reported ${ticket.reference} — routed to ${formatDepartmentLabel(ticket.department)}.`,
  });
  notifyReporterTicketUpdate(ticket, {
    recipientUsername: username,
    type: 'ticket_submitted',
    title: 'Ticket submitted',
    message: `${ticket.reference} was submitted and routed to ${formatDepartmentLabel(ticket.department)}.`,
  });

  return { ticket: publicTicket(ticket) };
}

async function addEvidence(reference, username, body, { uploadedFiles } = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  await hydrateTicketEvidence(ticket);
  const uploadErr = await mergeUploadedEvidence(ticket, uploadedFiles, username);
  if (uploadErr) return uploadErr;
  if (!uploadedFiles?.length) {
    const added = parseEvidenceList(body.evidenceFiles);
    if (!added.length) return { error: 'Upload at least one evidence file.' };
    const saved = await saveLegacyEvidenceReferences(ticket.reference, added, { uploadedBy: username });
    ticket.evidence = [...(ticket.evidence || []), ...saved];
  }
  ticket.evidenceCount = (ticket.evidence || []).length;
  ticket.updatedAt = new Date().toISOString();
  saveStore();
  return { ticket: publicTicket(ticket) };
}

function assignMitigationForDemo(reference) {
  const { store, saveStore } = getStore();
  const ticket = (store.riskTickets || []).find((t) => t.reference === reference);
  if (!ticket) return;
  const due = new Date();
  due.setDate(due.getDate() + 14);
  ticket.status = 'in_mitigation';
  ticket.mitigationDueAt = due.toISOString();
  ticket.officerNotes = 'Mitigation plan approved. Implement assigned actions and submit an accomplishment report.';
  ticket.updatedAt = new Date().toISOString();
  saveStore();
}

function getTicketByRefForOfficer(reference) {
  const { store } = getStore();
  const ticket = (store.riskTickets || []).find((t) => t.reference === reference);
  if (!ticket || ticket.status === 'draft') return null;
  return ticket;
}

function listTicketsForOfficer() {
  const { store } = getStore();
  return (store.riskTickets || [])
    .filter((t) => isVisibleTicket(t) && t.status !== 'draft')
    .map(publicTicket)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function listOfficerReviewQueue() {
  return listTicketsForOfficer().filter((t) => OFFICER_REVIEW_STATUSES.includes(t.status));
}

function listOfficerAuditReturnedQueue() {
  return listTicketsForOfficer().filter((t) => t.status === 'audit_returned');
}

function listOfficerFinalValidationQueue() {
  return listTicketsForOfficer().filter((t) => OFFICER_FINAL_VALIDATION_STATUSES.includes(t.status));
}

function listOfficerMonitoringQueue() {
  return listTicketsForOfficer().filter((t) => RMU_MONITORING_STATUSES.includes(t.status));
}

function listRmuOverdueQueue() {
  return listTicketsForOfficer().filter((t) => t.isOverdue);
}

function listRmuAiReviewQueue() {
  return listTicketsForOfficer().filter(
    (t) => RMU_AI_REVIEW_STATUSES.includes(t.status) || t.ai?.manualReviewRequired,
  );
}

function listRmuActionPlanQueue() {
  return listTicketsForOfficer().filter(
    (t) => RMU_ACTION_PLAN_STATUSES.includes(t.status) && t.hasActionPlan,
  );
}

function listRmuComplianceQueue() {
  return listTicketsForOfficer().filter(
    (t) => t.category === RMU_COMPLIANCE_CATEGORY && !['closed', 'resolved'].includes(t.status),
  );
}

function getOfficerStats() {
  const tickets = listTicketsForOfficer();
  const monitoring = tickets.filter((t) => RMU_MONITORING_STATUSES.includes(t.status));
  return {
    total: tickets.length,
    awaitingReview: listRmuAiReviewQueue().length,
    pendingReview: tickets.filter((t) => t.ai?.manualReviewRequired).length,
    returnedByAudit: tickets.filter((t) => t.status === 'audit_returned').length,
    awaitingFinalValidation: listRmuActionPlanQueue().length,
    inMitigation: monitoring.length,
    returned: tickets.filter((t) => t.status === 'returned').length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    overdueMitigation: listRmuOverdueQueue().length,
    open: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
    complianceOpen: listRmuComplianceQueue().length,
    escalated: tickets.filter((t) => t.isEscalated).length,
  };
}

function matrixCellTier(likelihood, impact) {
  const score = likelihood * impact;
  if (score <= 4) return 'low';
  if (score <= 9) return 'moderate';
  if (score <= 15) return 'high';
  return 'critical';
}

function getOfficerDashboardData() {
  const tickets = listTicketsForOfficer();
  const stats = getOfficerStats();

  const deptMap = {};
  for (const t of tickets) {
    const dept = (t.department || 'Unassigned').trim() || 'Unassigned';
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  }
  const departments = Object.entries(deptMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const matrix = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const t of tickets) {
    const likelihood = Math.max(1, Math.min(5, Number(t.likelihood) || 1));
    const impact = Math.max(1, Math.min(5, Number(t.impact) || 1));
    matrix[5 - likelihood][impact - 1] += 1;
  }

  return { stats, departments, matrix };
}

async function findAttachmentForOfficer(attachmentId) {
  const attachment = await attachmentRepo.findById(attachmentId);
  if (!attachment) return null;
  const ticket = getTicketByRefForOfficer(attachment.ticketRef);
  if (!ticket) return null;
  return { ticket, attachment };
}

function getAccomplishmentForTicket(ticket) {
  if (!ticket?.accomplishmentId) return null;
  const { store } = getStore();
  return (store.accomplishments || []).find((a) => a.id === ticket.accomplishmentId) || null;
}

function logOfficerAction(ticket, username, action, detail) {
  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: username,
    submitterRole: 'rm_officer',
    status: getStatusLabel(ticket.status),
    action,
    detail: detail || undefined,
  });
}

function ensurePrivateComments(ticket) {
  if (!ticket.privateComments) {
    ticket.privateComments = ticket.comments ? [...ticket.comments] : [];
    delete ticket.comments;
  }
  if (!ticket.executiveComments) ticket.executiveComments = [];
  if (!ticket.mitigationPlanHistory) ticket.mitigationPlanHistory = [];
  if (!ticket.mitigationPlanVersion) ticket.mitigationPlanVersion = 0;
}

function ticketRiskLevelId(ticket) {
  if (ticket?.ai?.riskLevel?.id) return ticket.ai.riskLevel.id;
  const sev =
    ticket?.ai?.severity
    || (ticket?.likelihood && ticket?.impact
      ? Math.round((ticket.likelihood + ticket.impact) / 2)
      : 2);
  return riskLevelFromSeverity(sev).id;
}

const RISK_LEVEL_ORDER = { low: 1, moderate: 2, high: 3, critical: 4 };

function compareTicketsByRiskLevel(a, b) {
  const rankA = RISK_LEVEL_ORDER[ticketRiskLevelId(a)] || 0;
  const rankB = RISK_LEVEL_ORDER[ticketRiskLevelId(b)] || 0;
  if (rankA !== rankB) return rankA - rankB;
  return new Date(b.updatedAt) - new Date(a.updatedAt);
}

function canOfficerEditMitigation(ticket) {
  return false;
}

function appendMitigationPlanHistory(ticket, user, { action, previous, updated }) {
  ensurePrivateComments(ticket);
  ticket.mitigationPlanHistory.push({
    id: `mph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: user.role || 'rm_officer',
    action,
    previous: {
      plan: previous.plan ?? null,
      dueAt: previous.dueAt ?? null,
    },
    updated: {
      plan: updated.plan ?? null,
      dueAt: updated.dueAt ?? null,
    },
  });
  if (ticket.mitigationPlanHistory.length > 100) {
    ticket.mitigationPlanHistory = ticket.mitigationPlanHistory.slice(-100);
  }
}

function parseMitigationDueDate(raw) {
  const dueRaw = String(raw || '').trim();
  if (!dueRaw) {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    return due;
  }
  const due = new Date(dueRaw);
  if (Number.isNaN(due.getTime())) return null;
  return due;
}

async function ticketForRole(ticket, role) {
  if (!ticket) return null;
  await hydrateTicketEvidence(ticket);
  const merged = { ...ticket, ...publicTicket(ticket) };
  ensurePrivateComments(ticket);

  if (role === 'supervisor') {
    merged.privateComments = undefined;
    merged.executiveComments = undefined;
    merged.mitigationPlanHistory = undefined;
    merged.auditNotes = undefined;
    merged.evidence = ticket.evidence || [];
    ensureThreadComments(ticket);
    merged.threadComments = ticket.threadComments || [];
    merged.timeline = getTicketTimelineForReporter(ticket);
    if (ticket.status === 'returned' && ticket.officerNotes) {
      merged.officerNotes = ticket.officerNotes;
    } else if (!SUPERVISOR_MITIGATION_VISIBLE_STATUSES.includes(ticket.status)) {
      merged.officerNotes = null;
    } else {
      merged.officerNotes = ticket.officerNotes;
    }
    merged.mitigationDueAt = SUPERVISOR_MITIGATION_VISIBLE_STATUSES.includes(ticket.status)
      ? ticket.mitigationDueAt
      : null;
    merged.finalDecision = ticket.finalDecision || null;
    merged.suggestedMitigation = ticket.ai?.suggestedMitigation || null;
    return merged;
  }

  if (role === 'dept_head') {
    ensureDeptHeadFields(ticket);
    merged.privateComments = undefined;
    merged.executiveComments = undefined;
    merged.mitigationPlanHistory = undefined;
    merged.threadComments = ticket.threadComments || [];
    merged.timeline = getTicketTimelineForReporter(ticket);
    merged.ownership = ticket.ownership || null;
    merged.reassignments = ticket.reassignments || [];
    merged.actionPlan = ticket.actionPlan || null;
    merged.personnel = ticket.personnel || [];
    merged.progressUpdates = ticket.progressUpdates || [];
    merged.finalResolution = ticket.finalResolution || null;
    merged.presidentDecision = ticket.presidentDecision || null;
    merged.presidentPlanDecision = ticket.presidentPlanDecision || null;
    merged.presidentFinalDecision = ticket.presidentFinalDecision || null;
    merged.presidentReviewPhase = ticket.presidentReviewPhase || null;
    merged.auditTrail = ticket.auditTrail || [];
    merged.suggestedMitigation = ticket.ai?.suggestedMitigation || null;
    merged.evidence = ticket.evidence || [];
    return merged;
  }

  if (role === 'rm_officer') {
    ensureDeptHeadFields(ticket);
    ensureRmuFields(ticket);
    merged.privateComments = ticket.privateComments || [];
    merged.executiveComments = ticket.executiveComments || [];
    merged.comments = merged.privateComments;
    merged.mitigationPlanHistory = ticket.mitigationPlanHistory || [];
    merged.evidence = ticket.evidence || [];
    merged.threadComments = ticket.threadComments || [];
    merged.ownership = ticket.ownership || null;
    merged.actionPlan = ticket.actionPlan || null;
    merged.personnel = ticket.personnel || [];
    merged.progressUpdates = ticket.progressUpdates || [];
    merged.finalResolution = ticket.finalResolution || null;
    merged.rmuRecommendations = ticket.rmuRecommendations || [];
    merged.escalations = ticket.escalations || [];
    return merged;
  }

  if (role === 'audit_officer') {
    ensureDeptHeadFields(ticket);
    merged.privateComments = ticket.privateComments || [];
    merged.executiveComments = ticket.executiveComments || [];
    merged.mitigationPlanHistory = ticket.mitigationPlanHistory || [];
    merged.evidence = ticket.evidence || [];
    merged.comments = merged.privateComments;
    // Compliance validates the department's action plan and accomplishment.
    merged.actionPlan = ticket.actionPlan || null;
    merged.personnel = ticket.personnel || [];
    merged.progressUpdates = ticket.progressUpdates || [];
    merged.finalResolution = ticket.finalResolution || null;
    return merged;
  }

  if (role === 'executive') {
    merged.privateComments = undefined;
    merged.executiveComments = ticket.executiveComments || [];
    merged.mitigationPlanHistory = undefined;
    merged.auditNotes = undefined;
    merged.officerNotes = ticket.officerNotes || null;
    merged.mitigationDueAt = ticket.mitigationDueAt || null;
    merged.description = ticket.description;
    merged.evidence = ticket.evidence || [];
    return merged;
  }

  if (role === 'president') {
    ensureDeptHeadFields(ticket);
    ensureRmuFields(ticket);
    merged.privateComments = undefined;
    merged.executiveComments = undefined;
    merged.mitigationPlanHistory = undefined;
    merged.evidence = ticket.evidence || [];
    merged.actionPlan = ticket.actionPlan || null;
    merged.personnel = ticket.personnel || [];
    merged.progressUpdates = ticket.progressUpdates || [];
    merged.finalResolution = ticket.finalResolution || null;
    merged.presidentDecision = ticket.presidentDecision || null;
    merged.presidentPlanDecision = ticket.presidentPlanDecision || null;
    merged.presidentFinalDecision = ticket.presidentFinalDecision || null;
    merged.presidentReviewPhase = ticket.presidentReviewPhase || null;
    merged.rmuRecommendations = ticket.rmuRecommendations || [];
    merged.auditNotes = ticket.auditNotes || null;
    merged.auditTrail = ticket.auditTrail || [];
    merged.officerNotes = ticket.officerNotes || null;
    return merged;
  }

  if (role === 'admin') {
    merged.mitigationPlanHistory = ticket.mitigationPlanHistory || [];
    merged.privateComments = ticket.privateComments || [];
    merged.executiveComments = ticket.executiveComments || [];
    merged.evidence = ticket.evidence || [];
    return merged;
  }

  return merged;
}

function ensureRmuFields(ticket) {
  if (!ticket.rmuRecommendations) ticket.rmuRecommendations = [];
  if (!ticket.escalations) ticket.escalations = [];
  if (!ticket.ai) ticket.ai = {};
  if (!ticket.ai.overrideHistory) ticket.ai.overrideHistory = [];
}

const RMU_OWNERSHIP_DENIED =
  'The Risk Governance Office (RMU) does not own tickets. Use Recommend, Comment, or Escalate instead.';

function rejectTicketForOfficer(reference, username, body) {
  return { error: RMU_OWNERSHIP_DENIED };
}

function acceptAndAssignMitigation(reference, username, body) {
  return { error: RMU_OWNERSHIP_DENIED };
}

function updateMitigationPlanForOfficer(reference, user, body) {
  return { error: 'The RMU cannot implement or edit mitigation solutions.' };
}

function closeTicketAsOfficer(reference, username, body) {
  return { error: 'The RMU cannot close tickets.' };
}

function returnAccomplishmentForRevision(reference, username, body) {
  return { error: RMU_OWNERSHIP_DENIED };
}

function addRmuRecommendation(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };

  const text = String(body.recommendation || body.body || '').trim();
  if (!text) return { error: 'Recommendation cannot be empty.' };
  if (text.length > 2000) return { error: 'Recommendation is too long (max 2000 characters).' };

  ensureRmuFields(ticket);
  const now = new Date().toISOString();
  const record = {
    id: `rmu-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    authorUsername: user.username,
    authorName: user.displayName || user.username,
    authorRole: user.role,
    body: text,
    at: now,
  };
  ticket.rmuRecommendations.push(record);
  ticket.updatedAt = now;

  appendTicketAuditEvent(ticket, {
    action: 'RMU recommendation',
    detail: text.length > 160 ? `${text.slice(0, 160)}…` : text,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'rm_officer',
  });
  saveStore();
  logOfficerAction(ticket, user.username, 'rmu_recommendation', text);

  notifyDeptHeadsForDepartment(ticket, {
    type: 'rmu_recommendation',
    title: 'RMU improvement recommendation',
    message: `The Risk Governance Office recommended improvements on ${ticket.reference}.`,
    ticketRef: ticket.reference,
    fromUsername: user.username,
    fromName: user.displayName || user.username,
    fromRole: 'rm_officer',
  });

  return { ticket: publicTicket(ticket) };
}

function escalateTicketForRmu(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };

  const escalateTo = String(body.escalateTo || 'executive').trim().toLowerCase();
  const allowed = ['executive', 'audit_officer', 'dept_head'];
  if (!allowed.includes(escalateTo)) {
    return { error: 'Invalid escalation target.' };
  }

  const reason = String(body.reason || body.body || '').trim();
  if (!reason) return { error: 'Escalation reason is required.' };
  if (reason.length > 2000) return { error: 'Escalation reason is too long (max 2000 characters).' };

  ensureRmuFields(ticket);
  const now = new Date().toISOString();
  const record = {
    id: `esc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: now,
    byUsername: user.username,
    byName: user.displayName || user.username,
    escalateTo,
    reason,
  };
  ticket.escalations.push(record);
  ticket.updatedAt = now;

  appendTicketAuditEvent(ticket, {
    action: 'RMU escalation',
    detail: `Escalated to ${escalateTo}: ${reason.length > 120 ? `${reason.slice(0, 120)}…` : reason}`,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'rm_officer',
  });
  saveStore();
  logOfficerAction(ticket, user.username, 'rmu_escalation', `Escalated to ${escalateTo}`);

  if (escalateTo === 'dept_head') {
    notifyDeptHeadsForDepartment(ticket, {
      type: 'rmu_escalation',
      title: 'RMU escalation',
      message: `${ticket.reference} was escalated by the Risk Governance Office.`,
      ticketRef: ticket.reference,
      fromUsername: user.username,
      fromName: user.displayName || user.username,
      fromRole: 'rm_officer',
    });
  } else {
    notifyRoles([escalateTo], {
      type: 'rmu_escalation',
      title: 'RMU escalation',
      message: `${ticket.reference} was escalated by the Risk Governance Office: ${reason}`,
      ticketRef: ticket.reference,
      fromUsername: user.username,
      fromName: user.displayName || user.username,
      fromRole: 'rm_officer',
    }, { excludeUsername: user.username });
  }

  return { ticket: publicTicket(ticket) };
}

function overrideAiClassificationForRmu(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!ticket.ai) return { error: 'No AI classification to override on this ticket.' };

  const reason = String(body.reason || '').trim();
  if (!reason) return { error: 'Override reason is required.' };

  const category = String(body.category || ticket.category || '').trim();
  if (!RISK_CATEGORIES.some((c) => c.id === category)) {
    return { error: 'Invalid risk category.' };
  }

  const likelihood = clampInt(body.likelihood ?? ticket.likelihood, 1, 5);
  const impact = clampInt(body.impact ?? ticket.impact, 1, 5);
  const department = String(body.department || ticket.department || '').trim();
  if (!department) return { error: 'Responsible department is required.' };

  ensureRmuFields(ticket);
  const previous = {
    category: ticket.category,
    likelihood: ticket.likelihood,
    impact: ticket.impact,
    department: ticket.department,
    riskLevel: ticket.ai.riskLevel || null,
  };

  ticket.category = category;
  ticket.likelihood = likelihood;
  ticket.impact = impact;
  ticket.riskScore = likelihood * impact;
  ticket.department = department;
  ticket.ai.riskCategory = category;
  ticket.ai.likelihood = likelihood;
  ticket.ai.impact = impact;
  ticket.ai.riskLevel = riskLevelFromSeverity(Math.round((likelihood + impact) / 2));
  ticket.ai.manualReviewRequired = false;

  const now = new Date().toISOString();
  ticket.ai.overrideHistory.push({
    id: `aio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: now,
    byUsername: user.username,
    byName: user.displayName || user.username,
    reason,
    previous,
    updated: {
      category,
      likelihood,
      impact,
      department,
      riskLevel: ticket.ai.riskLevel,
    },
  });
  ticket.updatedAt = now;

  appendTicketAuditEvent(ticket, {
    action: 'AI classification overridden',
    detail: reason,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'rm_officer',
  });
  saveStore();
  logOfficerAction(ticket, user.username, 'ai_classification_overridden', reason);

  return { ticket: publicTicket(ticket) };
}

function addRmuThreadComment(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };

  const text = String(body.comment || body.body || '').trim();
  if (!text) return { error: 'Comment cannot be empty.' };
  if (text.length > 2000) return { error: 'Comment is too long (max 2000 characters).' };

  const parentId = String(body.parentId || '').trim() || null;
  ensureThreadComments(ticket);
  if (parentId && !ticket.threadComments.some((c) => c.id === parentId && !c.parentId)) {
    return { error: 'Parent comment not found.' };
  }

  appendThreadEntry(ticket, user, text, { parentId, kind: 'governance' });
  ticket.updatedAt = new Date().toISOString();

  appendTicketAuditEvent(ticket, {
    action: parentId ? 'RMU thread reply' : 'RMU governance comment',
    detail: text.length > 120 ? `${text.slice(0, 120)}…` : text,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'rm_officer',
  });
  saveStore();
  logOfficerAction(ticket, user.username, 'rmu_thread_comment');

  if (ticket.submittedBy) {
    notifyUser(ticket.submittedBy, {
      type: 'thread_comment',
      title: 'RMU comment on your ticket',
      message: `The Risk Governance Office commented on ${ticket.reference}.`,
      ticketRef: ticket.reference,
      fromUsername: user.username,
      fromName: user.displayName || user.username,
      fromRole: 'rm_officer',
    });
  }

  return { ticket: publicTicket(ticket) };
}

function closeTicketAsAudit(reference, username, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForAudit(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!AUDIT_FINAL_VALIDATION_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting accomplishment review.' };
  }

  const notes = String(body.closingNotes || body.auditNotes || '').trim();
  const now = new Date().toISOString();
  ticket.complianceAccomplishmentReview = {
    approvedAt: now,
    approvedBy: username,
    notes: notes || 'Compliance review completed.',
  };
  if (notes) ticket.auditNotes = notes;
  ticket.updatedAt = now;

  appendTicketAuditEvent(ticket, {
    action: 'Compliance review completed',
    detail: 'Accomplishment report validated. Forwarded for presidential final decision or closure.',
    actorUsername: username,
    actorName: username,
    actorRole: 'audit_officer',
  });

  if (requiresPresidentApproval(ticket)) {
    ticket.status = 'pending_president_final';
    ticket.presidentReviewPhase = 'final';
  } else {
    ticket.status = 'closed';
    appendTicketAuditEvent(ticket, {
      action: 'Ticket closed',
      detail: 'Accomplishment approved and ticket closed after compliance review.',
      actorUsername: username,
      actorName: username,
      actorRole: 'audit_officer',
    });
  }

  saveStore();
  logAuditAction(ticket, username, requiresPresidentApproval(ticket) ? 'accomplishment_forwarded_president' : 'accomplishment_approved_closed');

  notifyWorkflowStakeholders(ticket, requiresPresidentApproval(ticket) ? 'approval' : 'closure', {
    actor: { username, role: 'audit_officer', displayName: username },
    type: requiresPresidentApproval(ticket) ? 'compliance_accomplishment_approved' : 'ticket_closed',
    title: requiresPresidentApproval(ticket) ? 'Awaiting President final decision' : 'Ticket closed',
    message: requiresPresidentApproval(ticket)
      ? `Compliance approved the accomplishment for ${ticket.reference}. Awaiting President final decision.`
      : `Compliance approved and closed ${ticket.reference}.`,
  });

  return { ticket: publicTicket(ticket) };
}

function returnAccomplishmentAsAudit(reference, username, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForAudit(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!AUDIT_FINAL_VALIDATION_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting accomplishment review.' };
  }

  const notes = String(body.returnNotes || body.auditNotes || '').trim();
  if (!notes) return { error: 'Return notes are required when sending back for revision.' };

  const now = new Date().toISOString();
  ticket.status = 'in_mitigation';
  ticket.supervisorFeedback = notes;
  ticket.auditNotes = notes;
  ticket.updatedAt = now;
  saveStore();
  logAuditAction(ticket, username, 'accomplishment_returned');
  return { ticket: publicTicket(ticket) };
}

/* —— Compliance Officer (internally 'audit_officer') ——
 * The Compliance Officer validates the department action plan and mitigation
 * solution for compliance before implementation. They either approve compliance
 * (department may begin implementation) or request revisions (return to the RMO).
 * Compliance does not own the ticket — it validates.
 */

function getTicketByRefForAudit(reference) {
  const { store } = getStore();
  const ticket = (store.riskTickets || []).find((t) => t.reference === reference);
  if (!ticket || ticket.status === 'draft') return null;
  return ticket;
}

function listTicketsForAudit() {
  const { store } = getStore();
  return (store.riskTickets || [])
    .filter((t) => isVisibleTicket(t) && t.status !== 'draft')
    .map(publicTicket)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function listAuditReviewQueue() {
  return listTicketsForAudit().filter((t) => AUDIT_REVIEW_STATUSES.includes(t.status));
}

function listAuditFinalValidationQueue() {
  return listTicketsForAudit().filter((t) => AUDIT_FINAL_VALIDATION_STATUSES.includes(t.status));
}

function getAuditStats() {
  const tickets = listTicketsForAudit();
  const recentTickets = [...tickets]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 6);
  return {
    awaitingReview: tickets.filter((t) => AUDIT_REVIEW_STATUSES.includes(t.status)).length,
    awaitingFinalValidation: tickets.filter((t) => AUDIT_FINAL_VALIDATION_STATUSES.includes(t.status))
      .length,
    inImplementation: tickets.filter((t) => t.status === 'in_mitigation').length,
    returnedToRmo: tickets.filter((t) => t.status === 'audit_returned').length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    open: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
    recentTickets,
  };
}

async function findAttachmentForAudit(attachmentId) {
  const attachment = await attachmentRepo.findById(attachmentId);
  if (!attachment) return null;
  const ticket = getTicketByRefForAudit(attachment.ticketRef);
  if (!ticket) return null;
  return { ticket, attachment };
}

function logAuditAction(ticket, username, action) {
  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: username,
    submitterRole: 'audit_officer',
    status: getStatusLabel(ticket.status),
    action,
  });
}

function getTicketByRefForExecutive(reference) {
  const { store } = getStore();
  const ticket = (store.riskTickets || []).find((t) => t.reference === reference);
  if (!ticket || ticket.status === 'draft') return null;
  return ticket;
}

function listTicketsForExecutive({ level, category } = {}) {
  const { store } = getStore();
  let tickets = (store.riskTickets || [])
    .filter((t) => isVisibleTicket(t) && t.status !== 'draft')
    .map((t) => {
      const pub = publicTicket(t);
      pub.riskLevel = ticketRiskLevelId(t);
      pub.riskLevelLabel = riskLevelFromSeverity(
        t.ai?.severity
          || (t.likelihood && t.impact ? Math.round((t.likelihood + t.impact) / 2) : 2),
      ).label;
      pub.executiveCommentCount = (t.executiveComments || []).length;
      return pub;
    });

  if (level) {
    tickets = tickets.filter((t) => t.riskLevel === level);
  }
  if (category) {
    tickets = tickets.filter((t) => t.category === category);
  }

  return tickets.sort(compareTicketsByRiskLevel);
}

function getExecutiveStats() {
  const tickets = listTicketsForExecutive();
  const byLevel = { low: 0, moderate: 0, high: 0, critical: 0 };
  const byCategory = {};
  for (const t of tickets) {
    byLevel[t.riskLevel] = (byLevel[t.riskLevel] || 0) + 1;
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  }
  const criticalTickets = tickets
    .filter((t) => t.riskLevel === 'critical')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const highCriticalTickets = tickets
    .filter((t) => t.riskLevel === 'high' || t.riskLevel === 'critical')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return {
    total: tickets.length,
    byLevel,
    byCategory,
    criticalCount: byLevel.critical,
    highCount: byLevel.high,
    highCriticalCount: (byLevel.high || 0) + (byLevel.critical || 0),
    criticalTickets,
    highCriticalTickets,
    open: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    overdue: tickets.filter((t) => t.isOverdue).length,
  };
}

const EXEC_COMMENT_RISK_LEVELS = new Set(['high', 'critical']);

function canExecutiveCommentOnTicket(ticket) {
  return EXEC_COMMENT_RISK_LEVELS.has(ticketRiskLevelId(ticket));
}

function buildExecutiveTrends(tickets) {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en', { month: 'short', year: '2-digit' }),
      count: 0,
      highCritical: 0,
    });
  }
  const monthMap = Object.fromEntries(months.map((m) => [m.key, m]));
  for (const t of tickets) {
    const raw = t.submittedAt || t.createdAt;
    if (!raw) continue;
    const d = new Date(raw);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) continue;
    monthMap[key].count += 1;
    if (t.riskLevel === 'high' || t.riskLevel === 'critical') {
      monthMap[key].highCritical += 1;
    }
  }
  return months;
}

function getExecutiveDashboardData() {
  const tickets = listTicketsForExecutive();
  const stats = getExecutiveStats();

  const deptMap = {};
  for (const t of tickets) {
    const dept = (t.department || 'Unassigned').trim() || 'Unassigned';
    if (!deptMap[dept]) {
      deptMap[dept] = { name: dept, total: 0, open: 0, closed: 0, high: 0, critical: 0, overdue: 0 };
    }
    const row = deptMap[dept];
    row.total += 1;
    if (['closed', 'resolved'].includes(t.status)) row.closed += 1;
    else row.open += 1;
    if (t.riskLevel === 'high') row.high += 1;
    if (t.riskLevel === 'critical') row.critical += 1;
    if (t.isOverdue) row.overdue += 1;
  }
  const departments = Object.values(deptMap).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const matrix = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const t of tickets) {
    const likelihood = Math.max(1, Math.min(5, Number(t.likelihood) || 1));
    const impact = Math.max(1, Math.min(5, Number(t.impact) || 1));
    matrix[5 - likelihood][impact - 1] += 1;
  }

  const byStatus = {};
  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  return {
    stats,
    departments,
    matrix,
    trends: buildExecutiveTrends(tickets),
    byStatus,
  };
}

async function findAttachmentForExecutive(attachmentId) {
  const attachment = await attachmentRepo.findById(attachmentId);
  if (!attachment) return null;
  const ticket = getTicketByRefForExecutive(attachment.ticketRef);
  if (!ticket) return null;
  return { ticket, attachment };
}

/* —— President (final approving authority for High/Critical risks) —— */

const PRESIDENT_RISK_LEVELS = new Set(['high', 'critical']);

function findDepartmentForTicket(ticket) {
  const { listDepartments } = require('./store');
  const deptName = ticket.department;
  if (!deptName) return null;
  return listDepartments().find((d) => departmentsMatch(d.name, deptName)) || null;
}

function requiresPresidentApproval(ticket) {
  return PRESIDENT_RISK_LEVELS.has(ticketRiskLevelId(ticket));
}

function enrichTicketRiskMeta(ticket) {
  const pub = publicTicket(ticket);
  pub.riskLevel = ticketRiskLevelId(ticket);
  pub.riskLevelLabel = riskLevelFromSeverity(
    ticket.ai?.severity
      || (ticket.likelihood && ticket.impact ? Math.round((ticket.likelihood + ticket.impact) / 2) : 2),
  ).label;
  return pub;
}

function isPresidentVisibleTicket(ticket) {
  return PRESIDENT_RISK_LEVELS.has(ticketRiskLevelId(ticket));
}

function getTicketByRefForPresident(reference) {
  const { store } = getStore();
  const ticket = (store.riskTickets || []).find((t) => t.reference === reference);
  if (!ticket || ticket.status === 'draft' || !isPresidentVisibleTicket(ticket)) return null;
  return ticket;
}

function listTicketsForPresident({ level, status } = {}) {
  const { store } = getStore();
  let tickets = (store.riskTickets || [])
    .filter((t) => isVisibleTicket(t) && t.status !== 'draft' && isPresidentVisibleTicket(t))
    .map(enrichTicketRiskMeta);

  if (level && PRESIDENT_RISK_LEVELS.has(level)) {
    tickets = tickets.filter((t) => t.riskLevel === level);
  }
  if (status) {
    tickets = tickets.filter((t) => t.status === status);
  }

  return tickets.sort(compareTicketsByRiskLevel);
}

function listPresidentPendingQueue() {
  return listTicketsForPresident().filter((t) =>
    ['pending_president', 'pending_president_final'].includes(t.status),
  );
}

function getPresidentStats() {
  const tickets = listTicketsForPresident();
  const byLevel = { high: 0, critical: 0 };
  for (const t of tickets) {
    byLevel[t.riskLevel] = (byLevel[t.riskLevel] || 0) + 1;
  }
  const pendingTickets = listPresidentPendingQueue()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return {
    total: tickets.length,
    byLevel,
    highCount: byLevel.high,
    criticalCount: byLevel.critical,
    pendingCount: pendingTickets.length,
    pendingTickets,
    open: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
  };
}

async function findAttachmentForPresident(attachmentId) {
  const attachment = await attachmentRepo.findById(attachmentId);
  if (!attachment) return null;
  const ticket = getTicketByRefForPresident(attachment.ticketRef);
  if (!ticket) return null;
  return { ticket, attachment };
}

function logPresidentAction(ticket, user, action, detail) {
  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: user.username,
    submitterRole: 'president',
    status: getStatusLabel(ticket.status),
    action,
    detail: detail || '',
  });
}

function recordPresidentDecision(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForPresident(reference);
  if (!ticket) return { error: 'Ticket not found or outside presidential review scope (High/Critical only).' };
  if (!['pending_president', 'pending_president_final'].includes(ticket.status)) {
    return { error: 'This ticket is not awaiting a presidential decision.' };
  }

  const isFinalPhase = ticket.status === 'pending_president_final' || ticket.presidentReviewPhase === 'final';
  const existingDecision = isFinalPhase ? ticket.presidentFinalDecision : ticket.presidentPlanDecision;
  if (existingDecision) {
    return { error: 'A presidential decision has already been recorded for this review stage.' };
  }

  const decision = String(body.decision || '').trim().toLowerCase();
  const allowed = isFinalPhase ? ['close', 'return', 'approve'] : ['approve', 'reject', 'return'];
  if (!allowed.includes(decision)) {
    return { error: `Invalid decision. Choose ${allowed.join(', ')}.` };
  }

  const note = String(body.note || body.comment || '').trim();
  if ((decision === 'reject' || decision === 'return') && !note) {
    return { error: 'A reason is required when rejecting or returning a ticket.' };
  }

  const now = new Date().toISOString();
  const decisionLabels = {
    approve: 'Approved',
    reject: 'Rejected',
    return: 'Returned',
    close: 'Closed',
  };

  const decisionRecord = {
    decision: decisionLabels[decision] || decision,
    decisionId: decision,
    note: note || null,
    authorUsername: user.username,
    authorName: user.displayName || user.username,
    at: now,
    phase: isFinalPhase ? 'final' : 'action_plan',
  };

  if (isFinalPhase) {
    ticket.presidentFinalDecision = decisionRecord;
    if (decision === 'close' || decision === 'approve') {
      ticket.status = 'closed';
      appendTicketAuditEvent(ticket, {
        action: 'President approved',
        detail: note || 'President approved closure after accomplishment review.',
        actorUsername: user.username,
        actorName: user.displayName || user.username,
        actorRole: 'president',
      });
      appendTicketAuditEvent(ticket, {
        action: 'Ticket closed',
        detail: 'Ticket closed following presidential final decision.',
        actorUsername: user.username,
        actorName: user.displayName || user.username,
        actorRole: 'president',
      });
    } else if (decision === 'return') {
      ticket.status = 'in_mitigation';
      appendTicketAuditEvent(ticket, {
        action: 'President returned ticket',
        detail: note || 'Returned to department for further implementation.',
        actorUsername: user.username,
        actorName: user.displayName || user.username,
        actorRole: 'president',
      });
    }
  } else {
    ticket.presidentPlanDecision = decisionRecord;
    if (decision === 'approve') {
      ticket.status = 'in_mitigation';
      appendTicketAuditEvent(ticket, {
        action: 'President approved',
        detail: note || 'Action plan approved. Department may begin implementation.',
        actorUsername: user.username,
        actorName: user.displayName || user.username,
        actorRole: 'president',
      });
    } else if (decision === 'reject') {
      ticket.status = 'in_progress';
      ticket.actionPlan = null;
      appendTicketAuditEvent(ticket, {
        action: 'President rejected action plan',
        detail: note || 'Action plan rejected by the President.',
        actorUsername: user.username,
        actorName: user.displayName || user.username,
        actorRole: 'president',
      });
    } else if (decision === 'return') {
      ticket.status = 'in_progress';
      appendTicketAuditEvent(ticket, {
        action: 'President returned action plan',
        detail: note || 'Returned to department for revision.',
        actorUsername: user.username,
        actorName: user.displayName || user.username,
        actorRole: 'president',
      });
    }
  }

  ticket.presidentReviewPhase = null;
  ticket.updatedAt = now;
  saveStore();
  logPresidentAction(ticket, user, `president_${decision}`, note);

  const notifyTitle = isFinalPhase
    ? (decision === 'return' ? 'Returned for revision' : 'Ticket closed')
    : {
        approve: 'Action plan approved',
        reject: 'Action plan rejected',
        return: 'Action plan returned',
      }[decision];

  notifyWorkflowStakeholders(ticket, decision === 'close' || decision === 'approve' && isFinalPhase ? 'closure' : 'return', {
    actor: user,
    type: `president_${decision}`,
    title: notifyTitle,
    message: `The President ${decisionLabels[decision]?.toLowerCase() || decision} ${ticket.reference}.${note ? ` Reason: ${note}` : ''}`,
  });

  return { ticket: publicTicket(ticket), flashKey: `president_${decision}` };
}

function addExecutiveComment(reference, user, body) {
  const { saveStore } = getStore();
  if (user.role !== 'executive') {
    return { error: 'Only the Executive Committee may post oversight comments.' };
  }
  const ticket = getTicketByRefForExecutive(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!canExecutiveCommentOnTicket(ticket)) {
    return { error: 'Executive Committee may only comment on High and Critical risk reports.' };
  }

  const text = String(body.comment || body.body || '').trim();
  if (!text) return { error: 'Comment cannot be empty.' };
  if (text.length > 2000) return { error: 'Comment is too long (max 2000 characters).' };

  ensurePrivateComments(ticket);
  const now = new Date().toISOString();
  const record = {
    id: `excmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    authorUsername: user.username,
    authorName: user.displayName || user.username,
    authorRole: user.role,
    roleLabel: user.roleLabel || user.role,
    body: text,
    at: now,
    parentId: null,
  };
  ticket.executiveComments.push(record);
  ticket.updatedAt = now;
  saveStore();
  notifyExecutiveComment(ticket, user);

  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: user.username,
    submitterRole: 'executive',
    status: getStatusLabel(ticket.status),
    action: 'executive_comment_added',
    detail: 'Executive Committee oversight comment posted.',
  });

  return { ticket: publicTicket(ticket) };
}

function replyToExecutiveComment(reference, user, body) {
  const { saveStore } = getStore();
  if (!['rm_officer', 'audit_officer'].includes(user.role)) {
    return { error: 'Only the RMO or Compliance Officer may reply to executive comments.' };
  }
  const ticket = user.role === 'audit_officer'
    ? getTicketByRefForAudit(reference)
    : getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };

  const text = String(body.comment || body.body || '').trim();
  if (!text) return { error: 'Reply cannot be empty.' };
  if (text.length > 2000) return { error: 'Reply is too long (max 2000 characters).' };

  const parentId = String(body.parentId || '').trim();
  if (!parentId) return { error: 'Select an executive comment to reply to.' };

  ensurePrivateComments(ticket);
  const parent = ticket.executiveComments.find((c) => c.id === parentId && !c.parentId);
  if (!parent) return { error: 'Executive comment not found.' };

  const now = new Date().toISOString();
  const record = {
    id: `excmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    authorUsername: user.username,
    authorName: user.displayName || user.username,
    authorRole: user.role,
    roleLabel: user.roleLabel || user.role,
    body: text,
    at: now,
    parentId,
  };
  ticket.executiveComments.push(record);
  ticket.updatedAt = now;
  saveStore();
  notifyExecutiveReply(ticket, user);

  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: user.username,
    submitterRole: user.role,
    status: getStatusLabel(ticket.status),
    action: 'executive_comment_reply',
    detail: 'Reply to executive oversight comment.',
  });

  return { ticket: publicTicket(ticket) };
}

function approveSolutionByAudit(reference, username, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForAudit(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!AUDIT_REVIEW_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting compliance review.' };
  }

  const dueRaw = String(body.mitigationDueAt || '').trim();
  if (dueRaw) {
    const due = new Date(dueRaw);
    if (Number.isNaN(due.getTime())) return { error: 'Invalid implementation due date.' };
    ticket.mitigationDueAt = due.toISOString();
  } else if (!ticket.mitigationDueAt) {
    const due = new Date();
    due.setDate(due.getDate() + 14);
    ticket.mitigationDueAt = due.toISOString();
  }

  const notes = String(body.auditNotes || '').trim();
  ticket.auditNotes = notes || 'Compliance approved the action plan.';
  ticket.compliancePlanReview = {
    approvedAt: new Date().toISOString(),
    approvedBy: username,
    notes: ticket.auditNotes,
  };
  ticket.updatedAt = new Date().toISOString();

  appendTicketAuditEvent(ticket, {
    action: 'Compliance review completed',
    detail: 'Action plan validated. Forwarded for presidential approval or implementation.',
    actorUsername: username,
    actorName: username,
    actorRole: 'audit_officer',
  });

  if (requiresPresidentApproval(ticket)) {
    ticket.status = 'pending_president';
    ticket.presidentReviewPhase = 'action_plan';
  } else {
    ticket.status = 'in_mitigation';
    ticket.presidentReviewPhase = null;
  }

  saveStore();
  logAuditAction(ticket, username, 'solution_approved');

  notifyWorkflowStakeholders(ticket, 'approval', {
    actor: { username, role: 'audit_officer', displayName: username },
    type: 'compliance_approved',
    title: 'Compliance validation completed',
    message: `Compliance approved the action plan for ${ticket.reference}.`,
  });

  return { ticket: publicTicket(ticket) };
}

function returnSolutionToRmo(reference, username, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForAudit(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!AUDIT_REVIEW_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting compliance review.' };
  }

  const notes = String(body.auditNotes || '').trim();
  if (!notes) return { error: 'Compliance notes are required when requesting revisions from the RMO.' };

  ticket.auditNotes = notes;
  ticket.status = 'in_progress';
  ticket.presidentReviewPhase = null;
  ticket.updatedAt = new Date().toISOString();

  appendTicketAuditEvent(ticket, {
    action: 'Compliance returned action plan',
    detail: notes,
    actorUsername: username,
    actorName: username,
    actorRole: 'audit_officer',
  });

  saveStore();
  logAuditAction(ticket, username, 'solution_returned_to_dept');

  notifyWorkflowStakeholders(ticket, 'return', {
    actor: { username, role: 'audit_officer', displayName: username },
    type: 'compliance_returned',
    title: 'Action plan returned for revision',
    message: `Compliance returned the action plan for ${ticket.reference} to the department.`,
  });

  return { ticket: publicTicket(ticket) };
}

function postThreadCommentForTicket(ticket, user, body, { parentIdRequired = false } = {}) {
  const text = String(body.comment || body.body || '').trim();
  if (!text) return { error: 'Comment cannot be empty.' };
  if (text.length > 2000) return { error: 'Comment is too long (max 2000 characters).' };

  const parentId = String(body.parentId || '').trim() || null;
  ensureThreadComments(ticket);
  if (parentId && !ticket.threadComments.some((c) => c.id === parentId)) {
    return { error: 'Parent comment not found.' };
  }
  if (parentIdRequired && !parentId) {
    return { error: 'Select a comment to reply to.' };
  }

  const record = buildThreadCommentRecord(user, text, { parentId });
  ticket.threadComments.push(record);
  ticket.updatedAt = new Date().toISOString();

  appendTicketAuditEvent(ticket, {
    action: parentId ? 'Comment added' : 'Comment added',
    detail: text.length > 120 ? `${text.slice(0, 120)}…` : text,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: user.role,
  });

  notifyMentionedUsers(ticket, record, user);
  notifyWorkflowStakeholders(ticket, 'comment', {
    actor: user,
    type: 'thread_comment',
    title: parentId ? 'New reply on ticket' : 'New comment on ticket',
    message: `${user.displayName || user.username} commented on ${ticket.reference}.`,
  });

  return { record };
}

function editThreadComment(reference, user, body, { ticketGetter }) {
  const { saveStore } = getStore();
  const ticket = ticketGetter(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };

  const commentId = String(body.commentId || '').trim();
  const text = String(body.comment || body.body || '').trim();
  if (!commentId) return { error: 'Comment not found.' };
  if (!text) return { error: 'Comment cannot be empty.' };

  const comment = findThreadComment(ticket, commentId);
  if (!comment || comment.authorUsername !== user.username || comment.kind !== 'comment') {
    return { error: 'You can only edit your own comments.' };
  }

  comment.body = text;
  comment.mentions = parseMentions(text);
  comment.editedAt = new Date().toISOString();
  ticket.updatedAt = comment.editedAt;

  appendTicketAuditEvent(ticket, {
    action: 'Comment edited',
    detail: text.length > 120 ? `${text.slice(0, 120)}…` : text,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: user.role,
  });

  saveStore();
  return { ticket: publicTicket(ticket) };
}

function toggleThreadReaction(reference, user, body, { ticketGetter }) {
  const { saveStore } = getStore();
  const ticket = ticketGetter(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };

  const commentId = String(body.commentId || '').trim();
  const reaction = String(body.reaction || '').trim();
  if (!commentId || !reaction) return { error: 'Invalid reaction.' };

  const comment = findThreadComment(ticket, commentId);
  if (!comment) return { error: 'Comment not found.' };

  if (!comment.reactions) comment.reactions = {};
  const users = comment.reactions[reaction] || [];
  const idx = users.indexOf(user.username);
  if (idx >= 0) users.splice(idx, 1);
  else users.push(user.username);
  comment.reactions[reaction] = users;
  ticket.updatedAt = new Date().toISOString();
  saveStore();
  return { ticket: publicTicket(ticket) };
}

function addReporterThreadComment(reference, user, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRef(reference, user.username);
  if (!ticket) return { error: 'Ticket not found.' };
  if (ticket.status === 'draft') {
    return { error: 'Comments are available after the ticket is submitted.' };
  }

  const result = postThreadCommentForTicket(ticket, user, body);
  if (result.error) return result;
  saveStore();
  return { ticket: publicTicket(ticket) };
}

/* —— Comments / Audit trail ——
 * A shared comment thread on a ticket. Per the RMS flowchart, the Compliance
 * Officer (and RMO) can leave comments / suggestions on a risk report; every
 * comment is recorded in the Report history (Audit Trail).
 */

function addTicketComment(reference, user, body) {
  const { saveStore } = getStore();
  if (!['rm_officer', 'audit_officer'].includes(user.role)) {
    return { error: 'Only the RMU and Compliance Officer may post private oversight comments.' };
  }
  const ticket = user.role === 'audit_officer'
    ? getTicketByRefForAudit(reference)
    : getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };

  const text = String(body.comment || body.body || '').trim();
  if (!text) return { error: 'Comment cannot be empty.' };
  if (text.length > 2000) return { error: 'Comment is too long (max 2000 characters).' };

  ensurePrivateComments(ticket);
  const now = new Date().toISOString();
  const record = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    authorUsername: user.username,
    authorName: user.displayName || user.username,
    authorRole: user.role,
    roleLabel: user.roleLabel || user.role,
    body: text,
    at: now,
    private: true,
  };
  ticket.privateComments.push(record);
  ticket.updatedAt = now;
  saveStore();
  notifyPrivateComment(ticket, user);

  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: user.username,
    submitterRole: user.role,
    status: getStatusLabel(ticket.status),
    action: 'private_comment_added',
    detail: 'Private RMU/Compliance oversight comment (not visible to ticket reporter).',
  });

  return { ticket: publicTicket(ticket) };
}

/* —— Department Head / Vice President ——
 * President's revised model: the AI-routed responsible department owns the
 * ticket. The Department Head / VP is the owner and drives the lifecycle —
 * accept / reject / reassign ownership, build an action plan, assign personnel,
 * upload documents, report progress, and submit the final resolution. The Risk
 * Management Unit monitors; the President is the final approving authority.
 */

function ensureDeptHeadFields(ticket) {
  if (!ticket.ownership) {
    ticket.ownership = {
      state: ticket.department ? 'pending' : 'unassigned',
      ownerUsername: null,
      ownerName: null,
      ownerDepartment: ticket.department || null,
      assignedAt: ticket.routedAt || ticket.submittedAt || null,
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    };
  }
  if (!Array.isArray(ticket.reassignments)) ticket.reassignments = [];
  if (!Array.isArray(ticket.personnel)) ticket.personnel = [];
  if (!Array.isArray(ticket.progressUpdates)) ticket.progressUpdates = [];
  if (ticket.actionPlan === undefined) ticket.actionPlan = null;
  if (ticket.finalResolution === undefined) ticket.finalResolution = null;
  if (ticket.presidentDecision === undefined) ticket.presidentDecision = null;
  ensureThreadComments(ticket);
  ensureAuditTrail(ticket);
}

function isDeptHeadTicketForUser(ticket, user) {
  if (!ticket || ticket.status === 'draft') return false;
  if (!DEPT_HEAD_VISIBLE_STATUSES.includes(ticket.status)) return false;
  if (ticket.ownership?.ownerUsername && ticket.ownership.ownerUsername === user.username) {
    return true;
  }
  return departmentsMatch(user.department, ticket.department);
}

function getTicketByRefForDeptHead(reference, user) {
  const { store } = getStore();
  const ticket = (store.riskTickets || []).find(
    (t) => t.reference === reference && isVisibleTicket(t),
  );
  if (!ticket) return null;
  if (!isDeptHeadTicketForUser(ticket, user)) return null;
  return ticket;
}

function listTicketsForDeptHead(user) {
  const { store } = getStore();
  return (store.riskTickets || [])
    .filter((t) => isVisibleTicket(t) && isDeptHeadTicketForUser(t, user))
    .map(publicTicket)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function listDeptHeadInbox(user) {
  return listTicketsForDeptHead(user).filter((t) => DEPT_HEAD_INBOX_STATUSES.includes(t.status));
}

function listDeptHeadActive(user) {
  return listTicketsForDeptHead(user).filter((t) => DEPT_HEAD_ACTIVE_STATUSES.includes(t.status));
}

function getDeptHeadStats(user) {
  const tickets = listTicketsForDeptHead(user);
  const { getUnreadNotificationCount } = require('./store');
  return {
    total: tickets.length,
    inbox: tickets.filter((t) => DEPT_HEAD_INBOX_STATUSES.includes(t.status)).length,
    active: tickets.filter((t) => DEPT_HEAD_ACTIVE_STATUSES.includes(t.status)).length,
    awaitingPresident: tickets.filter((t) => t.status === 'pending_president').length,
    rejected: tickets.filter((t) => t.status === 'ownership_rejected').length,
    overdue: tickets.filter((t) => t.isOverdue).length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    unreadNotifications: getUnreadNotificationCount(user),
  };
}

function logDeptHeadAction(ticket, user, action, detail) {
  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: user.username,
    submitterRole: 'dept_head',
    status: getStatusLabel(ticket.status),
    action,
    detail: detail || undefined,
  });
}

function appendThreadEntry(ticket, user, text, { parentId = null, kind = 'comment', attachments = [] } = {}) {
  ensureThreadComments(ticket);
  const record = buildThreadCommentRecord(user, text, { parentId, kind, attachments });
  ticket.threadComments.push(record);
  return record;
}

function acceptOwnership(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  ensureDeptHeadFields(ticket);
  if (!DEPT_HEAD_OWNERSHIP_DECISION_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting an ownership decision.' };
  }

  const now = new Date().toISOString();
  ticket.ownership.state = 'accepted';
  ticket.ownership.ownerUsername = user.username;
  ticket.ownership.ownerName = user.displayName || user.username;
  ticket.ownership.ownerDepartment = ticket.department;
  ticket.ownership.acceptedAt = now;
  ticket.status = 'in_progress';
  ticket.updatedAt = now;

  const note = String(body.comment || '').trim();
  appendTicketAuditEvent(ticket, {
    action: 'Department accepted ticket',
    detail: `${user.displayName || user.username} accepted ownership for ${formatDepartmentLabel(ticket.department)}.${note ? ` Note: ${note}` : ''}`,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'dept_head',
  });
  saveStore();
  logDeptHeadAction(ticket, user, 'ownership_accepted', `Accepted ownership for ${ticket.department}.`);

  notifyWorkflowStakeholders(ticket, 'approval', {
    actor: user,
    type: 'ownership_accepted',
    title: 'Department accepted ticket',
    message: `${formatDepartmentLabel(ticket.department)} accepted ownership of ${ticket.reference}.`,
  });

  return { ticket: publicTicket(ticket) };
}

function rejectOwnership(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  ensureDeptHeadFields(ticket);
  if (!DEPT_HEAD_OWNERSHIP_DECISION_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting an ownership decision.' };
  }

  const reason = String(body.reason || body.comment || '').trim();
  if (!reason) return { error: 'A reason is required to reject ownership.' };

  const now = new Date().toISOString();
  ticket.ownership.state = 'rejected';
  ticket.ownership.rejectedAt = now;
  ticket.ownership.rejectionReason = reason;
  ticket.ownership.ownerUsername = null;
  ticket.ownership.ownerName = null;
  ticket.status = 'ownership_rejected';
  ticket.updatedAt = now;

  appendThreadEntry(ticket, user, `Ownership rejected: ${reason}`, { kind: 'system' });
  appendTicketAuditEvent(ticket, {
    action: 'Ownership rejected',
    detail: reason,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'dept_head',
  });
  saveStore();
  logDeptHeadAction(ticket, user, 'ownership_rejected', reason);

  notifyRoles(['rm_officer'], {
    type: 'ownership_rejected',
    title: 'Department rejected ownership',
    message: `${ticket.department} rejected ownership of ${ticket.reference}. Re-routing required.`,
    ticketRef: ticket.reference,
    fromUsername: user.username,
    fromName: user.displayName || user.username,
    fromRole: 'dept_head',
  }, { excludeUsername: user.username });
  notifyReporterTicketUpdate(ticket, {
    recipientUsername: ticket.submittedBy,
    type: 'ownership_rejected',
    title: 'Ticket ownership rejected',
    message: `${ticket.department} declined ownership of ${ticket.reference}. The Risk Management Unit will re-route it.`,
  });

  return { ticket: publicTicket(ticket) };
}

function reassignTicket(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  ensureDeptHeadFields(ticket);
  if (!['assigned', 'in_progress', 'reopened'].includes(ticket.status)) {
    return { error: 'This ticket can no longer be reassigned.' };
  }

  const reason = String(body.reason || '').trim();
  const comment = String(body.comment || '').trim();
  const target = String(body.targetDepartment || '').trim();
  if (!reason) return { error: 'A reason is required to request reassignment.' };
  if (!comment) return { error: 'A comment is required to request reassignment.' };
  if (!target) return { error: 'Select the target department for reassignment.' };
  if (!DEPARTMENTS.includes(target)) return { error: 'Invalid target department.' };
  if (departmentsMatch(target, ticket.department)) {
    return { error: 'The ticket is already assigned to that department.' };
  }

  const combinedNote = `${reason}${comment ? `\n\n${comment}` : ''}`;

  const now = new Date().toISOString();
  const fromDepartment = ticket.department;
  ticket.reassignments.push({
    id: `reasg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: now,
    fromDepartment,
    toDepartment: target,
    reason: combinedNote,
    reasonSummary: reason,
    comment,
    byUsername: user.username,
    byName: user.displayName || user.username,
  });

  ticket.department = target;
  ticket.ownership = {
    state: 'pending',
    ownerUsername: null,
    ownerName: null,
    ownerDepartment: target,
    assignedAt: now,
    acceptedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    reassignedFrom: fromDepartment,
  };
  ticket.status = 'assigned';
  ticket.updatedAt = now;

  appendThreadEntry(
    ticket,
    user,
    `Reassigned from ${fromDepartment} to ${target}.\nReason: ${reason}${comment ? `\nComment: ${comment}` : ''}`,
    { kind: 'reassignment' },
  );
  appendTicketAuditEvent(ticket, {
    action: 'Ticket reassigned',
    detail: `Transferred from ${fromDepartment} to ${formatDepartmentLabel(target)}. Reason: ${reason}`,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'dept_head',
  });
  saveStore();
  logDeptHeadAction(ticket, user, 'ticket_reassigned', `From ${fromDepartment} to ${target}: ${reason}`);

  notifyWorkflowStakeholders(ticket, 'reassignment', {
    actor: user,
    type: 'ticket_reassigned',
    title: 'Ticket reassigned',
    message: `${ticket.reference} was reassigned to ${formatDepartmentLabel(target)}.`,
    reason,
    targetDepartment: target,
  });

  return { ticket: publicTicket(ticket) };
}

function canDeptHeadExecute(ticket, user) {
  return Boolean(
    DEPT_HEAD_EXECUTION_STATUSES.includes(ticket.status)
    && ticket.ownership?.ownerUsername
    && ticket.ownership.ownerUsername === user.username,
  );
}

function saveActionPlan(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  ensureDeptHeadFields(ticket);
  if (!canDeptHeadExecute(ticket, user)) {
    return { error: 'Accept ownership before creating an action plan.' };
  }

  const summary = String(body.summary || '').trim();
  if (!summary) return { error: 'An action plan summary is required.' };
  const steps = String(body.steps || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  const targetDate = String(body.targetDate || '').trim();

  const submitForReview = ['1', 'true', true].includes(body.submitForReview);
  const now = new Date().toISOString();
  const existed = Boolean(ticket.actionPlan);
  ticket.actionPlan = {
    summary,
    steps,
    targetDate: targetDate || ticket.actionPlan?.targetDate || null,
    createdAt: ticket.actionPlan?.createdAt || now,
    updatedAt: now,
    updatedByName: user.displayName || user.username,
    version: (ticket.actionPlan?.version || 0) + 1,
    submittedForReviewAt: submitForReview ? now : ticket.actionPlan?.submittedForReviewAt || null,
  };
  if (ticket.actionPlan.targetDate) {
    ticket.mitigationDueAt = new Date(ticket.actionPlan.targetDate).toISOString();
  }
  ticket.updatedAt = now;

  if (submitForReview) {
    ticket.status = 'under_audit';
    ticket.presidentReviewPhase = 'action_plan';
    appendTicketAuditEvent(ticket, {
      action: 'Action plan uploaded',
      detail: 'Submitted to Compliance for validation before presidential approval and implementation.',
      actorUsername: user.username,
      actorName: user.displayName || user.username,
      actorRole: 'dept_head',
    });
    notifyWorkflowStakeholders(ticket, 'approval', {
      actor: user,
      type: 'action_plan_submitted',
      title: 'Action plan awaiting compliance review',
      message: `${formatDepartmentLabel(ticket.department)} submitted an action plan for ${ticket.reference}.`,
    });
  } else {
    appendTicketAuditEvent(ticket, {
      action: existed ? 'Action plan updated' : 'Action plan created',
      detail: summary.length > 160 ? `${summary.slice(0, 160)}…` : summary,
      actorUsername: user.username,
      actorName: user.displayName || user.username,
      actorRole: 'dept_head',
    });
    notifyWorkflowStakeholders(ticket, 'comment', {
      actor: user,
      type: 'action_plan',
      title: existed ? 'Action plan updated' : 'Action plan created',
      message: `${formatDepartmentLabel(ticket.department)} ${existed ? 'updated' : 'created'} an action plan for ${ticket.reference}.`,
    });
  }

  saveStore();
  logDeptHeadAction(ticket, user, submitForReview ? 'action_plan_submitted' : (existed ? 'action_plan_updated' : 'action_plan_created'));

  return { ticket: publicTicket(ticket), flashKey: submitForReview ? 'action_plan_submitted' : undefined };
}

function assignPersonnel(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  ensureDeptHeadFields(ticket);
  if (!canDeptHeadExecute(ticket, user)) {
    return { error: 'Accept ownership before assigning personnel.' };
  }

  const name = String(body.personName || '').trim();
  if (!name) return { error: 'Personnel name is required.' };
  const role = String(body.personRole || '').trim();

  const now = new Date().toISOString();
  ticket.personnel.push({
    id: `per-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    role: role || null,
    assignedAt: now,
    assignedByName: user.displayName || user.username,
  });
  ticket.updatedAt = now;

  appendTicketAuditEvent(ticket, {
    action: 'Personnel assigned',
    detail: `${name}${role ? ` — ${role}` : ''}`,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'dept_head',
  });
  saveStore();
  logDeptHeadAction(ticket, user, 'personnel_assigned', name);
  return { ticket: publicTicket(ticket) };
}

async function uploadDeptDocuments(reference, user, { uploadedFiles } = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  ensureDeptHeadFields(ticket);
  if (!DEPT_HEAD_EXECUTION_STATUSES.includes(ticket.status)) {
    return { error: 'Documents can be uploaded once the ticket is in progress.' };
  }
  if (!uploadedFiles?.length) return { error: 'Select at least one document to upload.' };

  await hydrateTicketEvidence(ticket);
  const uploadErr = await mergeUploadedEvidence(ticket, uploadedFiles, user.username);
  if (uploadErr) return uploadErr;

  const now = new Date().toISOString();
  ticket.updatedAt = now;
  appendTicketAuditEvent(ticket, {
    action: 'Documents uploaded',
    detail: `${uploadedFiles.length} document${uploadedFiles.length === 1 ? '' : 's'} added by ${user.displayName || user.username}.`,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'dept_head',
  });
  saveStore();
  logDeptHeadAction(ticket, user, 'documents_uploaded', `${uploadedFiles.length} file(s)`);
  return { ticket: publicTicket(ticket), uploaded: uploadedFiles.length };
}

function addProgressUpdate(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  ensureDeptHeadFields(ticket);
  if (!canDeptHeadExecute(ticket, user)) {
    return { error: 'Accept ownership before submitting progress updates.' };
  }

  const text = String(body.update || body.body || '').trim();
  if (!text) return { error: 'A progress update is required.' };
  let percent = null;
  if (body.percent !== undefined && String(body.percent).trim() !== '') {
    percent = clampInt(body.percent, 0, 100);
  }

  const now = new Date().toISOString();
  ticket.progressUpdates.push({
    id: `prog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: now,
    authorUsername: user.username,
    authorName: user.displayName || user.username,
    body: text,
    percent,
  });
  ticket.updatedAt = now;

  appendTicketAuditEvent(ticket, {
    action: 'Progress update submitted',
    detail: `${percent != null ? `[${percent}%] ` : ''}${text.length > 160 ? `${text.slice(0, 160)}…` : text}`,
    actorUsername: user.username,
    actorName: user.displayName || user.username,
    actorRole: 'dept_head',
  });
  saveStore();
  logDeptHeadAction(ticket, user, 'progress_update');

  notifyRoles(['rm_officer'], {
    type: 'progress_update',
    title: 'New progress update',
    message: `${ticket.department} posted a progress update on ${ticket.reference}${percent != null ? ` (${percent}%)` : ''}.`,
    ticketRef: ticket.reference,
    fromUsername: user.username,
    fromName: user.displayName || user.username,
    fromRole: 'dept_head',
  }, { excludeUsername: user.username });
  notifyReporterTicketUpdate(ticket, {
    recipientUsername: ticket.submittedBy,
    type: 'progress_update',
    title: 'Progress update',
    message: `${ticket.department} posted a progress update on ${ticket.reference}.`,
  });

  return { ticket: publicTicket(ticket) };
}

function submitFinalResolution(reference, user, body = {}) {
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  return {
    error: 'Use the revised workflow: submit the action plan for compliance review, complete implementation, then have the reporter submit an accomplishment report.',
  };
}

function addDeptHeadThreadComment(reference, user, body = {}) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForDeptHead(reference, user);
  if (!ticket) return { error: 'Ticket not found.' };
  ensureDeptHeadFields(ticket);

  const result = postThreadCommentForTicket(ticket, user, body);
  if (result.error) return result;
  saveStore();
  return { ticket: publicTicket(ticket) };
}

async function findAttachmentForDeptHead(attachmentId, user) {
  const attachment = await attachmentRepo.findById(attachmentId);
  if (!attachment) return null;
  const ticket = getTicketByRefForDeptHead(attachment.ticketRef, user);
  if (!ticket) return null;
  return { ticket, attachment };
}

function submitAccomplishment(reference, username, displayName, body, { uploadedFiles } = {}) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!canSupervisorSubmitAccomplishment(ticket)) {
    return { error: 'No active mitigation assignment for this ticket.' };
  }

  const summary = String(body.summary || '').trim();
  const outcomes = String(body.outcomes || '').trim();
  if (!summary || !outcomes) {
    return { error: 'Implementation summary and outcomes are required.' };
  }

  return hydrateTicketEvidence(ticket).then(async () => {
    if (uploadedFiles?.length) {
      const uploadErr = await mergeUploadedEvidence(ticket, uploadedFiles, username);
      if (uploadErr) return uploadErr;
    }

    const storedFiles = (ticket.evidence || []).filter((e) => e.storageKey || !e.legacy);
    if (!storedFiles.length) {
      return {
        error: 'At least one evidence file is required before submitting your accomplishment report.',
      };
    }

    if (!store.accomplishments) store.accomplishments = [];
    const now = new Date().toISOString();
    const record = {
      id: `acc-${Date.now()}`,
      ticketRef: ticket.reference,
      ticketTitle: ticket.title,
      summary,
      outcomes,
      evidence: storedFiles.map((e) => ({
        id: e.id,
        name: e.name || e.originalName,
        uploadedAt: e.uploadedAt,
      })),
      submittedBy: username,
      submittedByName: displayName,
      submittedAt: now,
    };
    store.accomplishments.push(record);
    ticket.accomplishmentId = record.id;
    ticket.status = 'pending_audit';
    ticket.updatedAt = now;

    appendTicketAuditEvent(ticket, {
      action: 'Accomplishment report submitted',
      detail: 'Reporter submitted the accomplishment report for compliance review.',
      actorUsername: username,
      actorName: displayName || username,
      actorRole: 'supervisor',
    });

    saveStore();

    notifyWorkflowStakeholders(ticket, 'approval', {
      actor: { username, displayName: displayName || username, role: 'supervisor' },
      type: 'accomplishment_submitted',
      title: 'Accomplishment report submitted',
      message: `${displayName || username} submitted an accomplishment report for ${ticket.reference}.`,
    });

    const { appendReportLog } = require('./store');
    appendReportLog({
      ticketRef: ticket.reference,
      title: ticket.title,
      submittedBy: username,
      submitterRole: 'supervisor',
      status: getStatusLabel(ticket.status),
      action: 'accomplishment_submitted',
    });

    return { accomplishment: record, ticket: publicTicket(ticket) };
  });
}

function listTicketsForAdmin({ department, level, status, search, deletedOnly = false } = {}) {
  const { store } = getStore();
  let tickets = store.riskTickets || [];
  tickets = deletedOnly
    ? tickets.filter((t) => t.deleted)
    : tickets.filter((t) => isVisibleTicket(t));
  tickets = tickets.map((t) => {
    const pub = publicTicket(t);
    pub.riskLevel = ticketRiskLevelId(t);
    pub.riskLevelLabel = riskLevelFromSeverity(
      t.ai?.severity
        || (t.likelihood && t.impact ? Math.round((t.likelihood + t.impact) / 2) : 2),
    ).label;
    pub.deleted = Boolean(t.deleted);
    pub.deletionReason = t.deletionReason || null;
    return pub;
  });
  if (department) {
    tickets = tickets.filter((t) => t.department?.toLowerCase() === String(department).toLowerCase());
  }
  if (level) {
    tickets = tickets.filter((t) => t.riskLevel === level);
  }
  if (status) {
    tickets = tickets.filter((t) => t.status === status);
  }
  if (search) {
    const q = String(search).toLowerCase();
    tickets = tickets.filter(
      (t) =>
        t.reference?.toLowerCase().includes(q)
        || t.title?.toLowerCase().includes(q)
        || t.submittedByName?.toLowerCase().includes(q),
    );
  }
  return tickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getAdminTicketStats() {
  const tickets = listTicketsForAdmin();
  const byLevel = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const t of tickets) {
    byLevel[t.riskLevel] = (byLevel[t.riskLevel] || 0) + 1;
  }
  return {
    total: tickets.length,
    open: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    highRisk: byLevel.high || 0,
    criticalRisk: byLevel.critical || 0,
    byLevel,
  };
}

function getTicketByRefForAdmin(reference) {
  const { store } = getStore();
  return (store.riskTickets || []).find((t) => t.reference === reference) || null;
}

function softDeleteTicketForAdmin(reference, user, reason) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForAdmin(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (ticket.deleted) return { error: 'Ticket is already deleted.' };
  const deletionReason = String(reason || '').trim();
  if (!deletionReason) return { error: 'A reason for deletion is required.' };
  const now = new Date().toISOString();
  ticket.deleted = true;
  ticket.deletedAt = now;
  ticket.deletedBy = user.username;
  ticket.deletedByName = user.displayName || user.username;
  ticket.deletionReason = deletionReason;
  ticket.updatedAt = now;
  saveStore();
  const { appendDeletedTicketLog } = require('./store');
  appendDeletedTicketLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    deletedBy: user.username,
    reason: deletionReason,
  });
  return { ticket: publicTicket(ticket) };
}

module.exports = {
  listTicketsForSupervisor,
  getTicketByRef,
  getSupervisorStats,
  listActionTickets,
  listAccomplishments,
  isDraftTicket,
  canSupervisorDraftCrud,
  canSupervisorReviseReport,
  canSupervisorEdit,
  canSupervisorSubmitAccomplishment,
  hasRevisionSinceReturn,
  ensureReturnRevisionBaseline,
  findAttachmentForUser,
  createTicket,
  updateTicketDraft,
  deleteDraftTicket,
  submitTicket,
  addEvidence,
  submitAccomplishment,
  publicTicket,
  assignMitigationForDemo,
  peekNextTicketRef,
  getTicketByRefForOfficer,
  listTicketsForOfficer,
  listOfficerReviewQueue,
  listOfficerAuditReturnedQueue,
  listOfficerFinalValidationQueue,
  listOfficerMonitoringQueue,
  listRmuOverdueQueue,
  listRmuAiReviewQueue,
  listRmuActionPlanQueue,
  listRmuComplianceQueue,
  getOfficerStats,
  getOfficerDashboardData,
  matrixCellTier,
  findAttachmentForOfficer,
  getAccomplishmentForTicket,
  rejectTicketForOfficer,
  acceptAndAssignMitigation,
  updateMitigationPlanForOfficer,
  canOfficerEditMitigation,
  ticketForRole,
  closeTicketAsOfficer,
  returnAccomplishmentForRevision,
  addRmuRecommendation,
  escalateTicketForRmu,
  overrideAiClassificationForRmu,
  addRmuThreadComment,
  getTicketByRefForAudit,
  listTicketsForAudit,
  listAuditReviewQueue,
  listAuditFinalValidationQueue,
  getAuditStats,
  findAttachmentForAudit,
  approveSolutionByAudit,
  returnSolutionToRmo,
  closeTicketAsAudit,
  returnAccomplishmentAsAudit,
  addTicketComment,
  addReporterThreadComment,
  getTicketByRefForDeptHead,
  listTicketsForDeptHead,
  listDeptHeadInbox,
  listDeptHeadActive,
  getDeptHeadStats,
  acceptOwnership,
  rejectOwnership,
  reassignTicket,
  saveActionPlan,
  assignPersonnel,
  uploadDeptDocuments,
  addProgressUpdate,
  submitFinalResolution,
  addDeptHeadThreadComment,
  editThreadComment,
  toggleThreadReaction,
  findAttachmentForDeptHead,
  canDeptHeadExecute,
  getTicketTimelineForReporter,
  generateAiAnalysisFromReport,
  ticketRiskLevelId,
  getTicketByRefForExecutive,
  listTicketsForExecutive,
  getExecutiveStats,
  getExecutiveDashboardData,
  canExecutiveCommentOnTicket,
  findAttachmentForExecutive,
  addExecutiveComment,
  replyToExecutiveComment,
  getTicketByRefForPresident,
  listTicketsForPresident,
  listPresidentPendingQueue,
  getPresidentStats,
  findAttachmentForPresident,
  recordPresidentDecision,
  requiresPresidentApproval,
  listTicketsForAdmin,
  getAdminTicketStats,
  getTicketByRefForAdmin,
  softDeleteTicketForAdmin,
};
