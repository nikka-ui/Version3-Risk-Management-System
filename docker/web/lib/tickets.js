const {
  DEFAULT_DEPARTMENT,
  TICKET_STATUSES,
  SUPERVISOR_ACTION_STATUSES,
  OFFICER_REVIEW_STATUSES,
  OFFICER_FINAL_VALIDATION_STATUSES,
  OFFICER_MONITORING_STATUSES,
  AUDIT_REVIEW_STATUSES,
  GRACE_PERIOD_MS,
  getStatusLabel,
  getCategoryLabel,
} = require('../config/tickets');
const {
  saveUploadedFiles,
  deleteTicketUploads,
  removeAttachmentsFromTicket,
} = require('./attachments');

function getStore() {
  const { loadStore, saveStore } = require('./store');
  return { store: loadStore(), saveStore };
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
    fiveW1H: ticket.fiveW1H,
    evidenceCount: (ticket.evidence || []).length,
    hasAccomplishment: Boolean(ticket.accomplishmentId),
    officerNotes: ticket.officerNotes || null,
    auditNotes: ticket.auditNotes || null,
    comments: ticket.comments || [],
    mitigationDueAt: ticket.mitigationDueAt || null,
    isOverdue: ticket.mitigationDueAt
      ? new Date(ticket.mitigationDueAt) < new Date() && SUPERVISOR_ACTION_STATUSES.includes(ticket.status)
      : false,
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
  if (any(compliance)) return 'compliance';
  if (any(financial)) return 'financial';
  if (any(reputational)) return 'reputational';
  if (any(strategic)) return 'strategic';
  return 'operational';
}

function generateAiAnalysisFromReport({ title, department, location, fiveW1H, evidenceFiles }) {
  const joined = [
    title,
    department,
    location,
    fiveW1H?.what,
    fiveW1H?.why,
    fiveW1H?.where,
    fiveW1H?.when,
    fiveW1H?.who,
    fiveW1H?.how,
  ]
    .filter(Boolean)
    .join(' ');

  const s = String(joined || '').toLowerCase();

  // Heuristic scoring to support the UI preview until the real AI service is wired.
  const impactKeywords = ['breach', 'fraud', 'shutdown', 'injury', 'penalt', 'sanction', 'lawsuit', 'leak', 'outage', 'major'];
  const likelihoodKeywords = ['often', 'frequent', 'recurr', 'pattern', 'may', 'could', 'lack of', 'weak', 'previous', 'history'];

  const countHits = (arr) => arr.reduce((acc, k) => (s.includes(k) ? acc + 1 : acc), 0);
  const impactHits = countHits(impactKeywords);
  const likelihoodHits = countHits(likelihoodKeywords);

  const lenBoost = Math.floor((s.length || 0) / 450); // up to a few points
  const base = 2;

  const likelihood = clampInt(base + lenBoost + likelihoodHits * 1.2, 1, 5);
  const impact = clampInt(base + lenBoost + impactHits * 1.3, 1, 5);

  const severity = clampInt(Math.round((likelihood + impact) / 2), 1, 5);
  const riskLevel = riskLevelFromSeverity(severity);

  const riskCategory = detectRiskCategory(s);
  const evidenceCount = Array.isArray(evidenceFiles) ? evidenceFiles.length : 0;
  const confidenceBase = 0.68;
  const evidenceBoost = evidenceCount >= 1 ? 0.08 : 0;
  const richTextBoost = (s.length || 0) > 180 ? 0.06 : 0;
  const confidence = Math.max(0.5, Math.min(0.98, confidenceBase + evidenceBoost + richTextBoost));

  const titleSafe = String(title || '').trim();
  const what = String(fiveW1H?.what || '').trim();
  const why = String(fiveW1H?.why || '').trim();

  const summary = `AI preview summary: “${titleSafe || 'Untitled'}” appears to describe an incident where ${what || 'the event is described'} occurred due to ${why || 'the stated cause'}. Based on the provided narrative, the report is classified as ${getCategoryLabel(riskCategory)} risk with likelihood ${likelihood}/5 and impact ${impact}/5.`;

  return {
    summary,
    likelihood,
    impact,
    riskCategory,
    severity,
    riskLevel,
    confidence: Math.round(confidence * 100) / 100,
    manualReviewRequired: confidence < 0.75,
    processedAt: new Date().toISOString(),
  };
}

function isDraftTicket(ticket) {
  return ticket?.status === 'draft';
}

/** Draft-only CRUD from My Tickets (create / edit / delete before submit). */
function canSupervisorDraftCrud(ticket) {
  return isDraftTicket(ticket);
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

function findAttachmentOnTicket(ticket, attachmentId) {
  return (ticket?.evidence || []).find((a) => a.id === attachmentId) || null;
}

function findAttachmentForUser(attachmentId, username) {
  const { store } = getStore();
  for (const ticket of store.riskTickets || []) {
    if (ticket.submittedBy !== username) continue;
    const att = findAttachmentOnTicket(ticket, attachmentId);
    if (att) return { ticket, attachment: att };
  }
  return null;
}

function mergeUploadedEvidence(ticket, uploadedFiles) {
  if (!uploadedFiles?.length) return null;
  const result = saveUploadedFiles(ticket.reference, uploadedFiles);
  if (result.error) return result;
  ticket.evidence = [...(ticket.evidence || []), ...result.attachments];
  return null;
}

function listTicketsForSupervisor(username) {
  const { store } = getStore();
  return (store.riskTickets || [])
    .filter((t) => t.submittedBy === username)
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
  return {
    total: tickets.length,
    drafts: tickets.filter((t) => t.status === 'draft').length,
    active: tickets.filter((t) => !['draft', 'closed', 'resolved'].includes(t.status)).length,
    actionRequired: tickets.filter((t) => SUPERVISOR_ACTION_STATUSES.includes(t.status)).length,
    overdue: tickets.filter((t) => t.isOverdue).length,
    accomplishments: accomplishments.length,
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

function mockAiClassification(ticket) {
  const riskLevel = riskLevelFromSeverity(Math.round((ticket.likelihood + ticket.impact) / 2));
  const confidence = Math.max(
    0.55,
    Math.min(0.98, 0.68 + (ticket.evidence?.length ? 0.1 : 0) + (String(ticket.description || '').length > 200 ? 0.06 : 0)),
  );
  return {
    summary: `AI analysis: ${getCategoryLabel(ticket.category)} risk with likelihood ${ticket.likelihood}/5 and impact ${ticket.impact}/5 (confidence ${Math.round(
      confidence * 100,
    )}%).`,
    likelihood: ticket.likelihood,
    impact: ticket.impact,
    riskCategory: ticket.category,
    severity: riskLevel.id === 'critical' ? 5 : riskLevel.id === 'high' ? 4 : riskLevel.id === 'moderate' ? 3 : 2,
    riskLevel,
    confidence: Math.round(confidence * 100) / 100,
    manualReviewRequired: confidence < 0.75,
    processedAt: new Date().toISOString(),
  };
}

function createTicket(username, displayName, body, { referenceOverride, uploadedFiles } = {}) {
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
  const uploadResult = uploadedFiles?.length ? saveUploadedFiles(ref, uploadedFiles) : { attachments: [] };
  if (uploadResult.error) return { error: uploadResult.error };
  evidenceFromUpload.push(...(uploadResult.attachments || []));
  const legacyEvidence = uploadedFiles?.length ? [] : parseEvidenceList(body.evidenceFiles);
  const evidenceFiles = [...evidenceFromUpload, ...legacyEvidence];
  if (!evidenceFiles.length) {
    return { error: 'At least one evidence file is required.' };
  }

  const ai = generateAiAnalysisFromReport({
    title,
    department: String(body.department || DEFAULT_DEPARTMENT).trim(),
    location: String(body.location || '').trim(),
    fiveW1H,
    evidenceFiles,
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
    department: String(body.department || DEFAULT_DEPARTMENT).trim(),
    location: String(body.location || '').trim(),
    // AI preview values (used for risk analysis badges and submission workflow).
    category: ai.riskCategory,
    likelihood: ai.likelihood,
    impact: ai.impact,
    riskScore: null,
    mitigationApproach: String(body.mitigationApproach || '').trim(),
    fiveW1H,
    evidence: evidenceFiles,
    status: 'draft',
    submittedBy: username,
    submittedByName: displayName,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    ai,
    accomplishmentId: null,
    mitigationDueAt: null,
    officerNotes: null,
    auditNotes: null,
    comments: [],
  };
  ticket.riskScore = ticket.likelihood * ticket.impact;
  store.riskTickets.push(ticket);
  saveStore();
  return { ticket: publicTicket(ticket) };
}

function updateTicketDraft(reference, username, body, { uploadedFiles, draftOnly = true } = {}) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  if (draftOnly && !canSupervisorDraftCrud(ticket)) {
    return { error: 'Only draft tickets can be edited from My Tickets.' };
  }
  if (!draftOnly && !canSupervisorEdit(ticket)) {
    return { error: 'This ticket can no longer be edited.' };
  }

  const fiveW1H = parseFiveW1H(body);
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Risk title is required.' };
  if (!fiveW1H.what || !fiveW1H.why) {
    return { error: 'What happened and why are required (5W1H).' };
  }

  removeAttachmentsFromTicket(ticket, parseRemoveAttachmentIds(body));

  ticket.title = title;
  ticket.description =
    String(body.description || '').trim() ||
    [fiveW1H.what, fiveW1H.why, fiveW1H.where, fiveW1H.when, fiveW1H.who, fiveW1H.how]
      .filter(Boolean)
      .join('\n');
  ticket.department = String(body.department || ticket.department).trim();
  ticket.location = String(body.location || '').trim();
  ticket.mitigationApproach = String(body.mitigationApproach || '').trim();
  ticket.fiveW1H = fiveW1H;

  const uploadErr = mergeUploadedEvidence(ticket, uploadedFiles);
  if (uploadErr) return uploadErr;

  if (!uploadedFiles?.length && body.evidenceFiles) {
    const added = parseEvidenceList(body.evidenceFiles);
    ticket.evidence = [...(ticket.evidence || []), ...added];
  }

  if (!(ticket.evidence || []).length) {
    return { error: 'At least one evidence file is required.' };
  }

  const ai = generateAiAnalysisFromReport({
    title: ticket.title,
    department: ticket.department,
    location: ticket.location,
    fiveW1H: ticket.fiveW1H,
    evidenceFiles: ticket.evidence,
  });
  ticket.category = ai.riskCategory;
  ticket.likelihood = ai.likelihood;
  ticket.impact = ai.impact;
  ticket.riskScore = ticket.likelihood * ticket.impact;
  ticket.ai = ai;
  ticket.updatedAt = new Date().toISOString();
  saveStore();
  return { ticket: publicTicket(ticket) };
}

function deleteDraftTicket(reference, username) {
  const { store, saveStore } = getStore();
  const idx = (store.riskTickets || []).findIndex(
    (t) => t.reference === reference && t.submittedBy === username,
  );
  if (idx < 0) return { error: 'Ticket not found.' };
  const ticket = store.riskTickets[idx];
  if (!canSupervisorDraftCrud(ticket)) {
    return { error: 'Only draft tickets can be deleted.' };
  }
  deleteTicketUploads(ticket.reference);
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

  const now = new Date().toISOString();
  // If the supervisor already generated an AI preview, keep it unless the draft was edited.
  const shouldRefreshAi =
    !ticket.ai
    || ticket.ai.likelihood !== ticket.likelihood
    || ticket.ai.impact !== ticket.impact
    || ticket.ai.riskCategory !== ticket.category;

  ticket.ai = shouldRefreshAi ? mockAiClassification(ticket) : ticket.ai;
  ticket.status = 'under_review';
  ticket.submittedAt = ticket.submittedAt || now;
  ticket.updatedAt = now;
  saveStore();

  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: username,
    submitterRole: 'supervisor',
    status: getStatusLabel(ticket.status),
    action: 'submitted',
  });

  return { ticket: publicTicket(ticket) };
}

function addEvidence(reference, username, body, { uploadedFiles } = {}) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  const uploadErr = mergeUploadedEvidence(ticket, uploadedFiles);
  if (uploadErr) return uploadErr;
  if (!uploadedFiles?.length) {
    const added = parseEvidenceList(body.evidenceFiles);
    if (!added.length) return { error: 'Upload at least one evidence file.' };
    ticket.evidence = [...(ticket.evidence || []), ...added];
  }
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
    .filter((t) => t.status !== 'draft')
    .map(publicTicket)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function listOfficerReviewQueue() {
  return listTicketsForOfficer().filter((t) => OFFICER_REVIEW_STATUSES.includes(t.status));
}

function listOfficerFinalValidationQueue() {
  return listTicketsForOfficer().filter((t) => OFFICER_FINAL_VALIDATION_STATUSES.includes(t.status));
}

function listOfficerMonitoringQueue() {
  return listTicketsForOfficer().filter((t) => OFFICER_MONITORING_STATUSES.includes(t.status));
}

function getOfficerStats() {
  const tickets = listTicketsForOfficer();
  const monitoring = tickets.filter((t) => OFFICER_MONITORING_STATUSES.includes(t.status));
  return {
    awaitingReview: tickets.filter((t) => OFFICER_REVIEW_STATUSES.includes(t.status)).length,
    awaitingFinalValidation: tickets.filter((t) => OFFICER_FINAL_VALIDATION_STATUSES.includes(t.status))
      .length,
    inMitigation: tickets.filter((t) => t.status === 'in_mitigation').length,
    returned: tickets.filter((t) => t.status === 'returned').length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    overdueMitigation: monitoring.filter((t) => t.isOverdue).length,
    open: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
  };
}

function findAttachmentForOfficer(attachmentId) {
  const { store } = getStore();
  for (const ticket of store.riskTickets || []) {
    const att = findAttachmentOnTicket(ticket, attachmentId);
    if (att) return { ticket, attachment: att };
  }
  return null;
}

function getAccomplishmentForTicket(ticket) {
  if (!ticket?.accomplishmentId) return null;
  const { store } = getStore();
  return (store.accomplishments || []).find((a) => a.id === ticket.accomplishmentId) || null;
}

function logOfficerAction(ticket, username, action) {
  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: username,
    submitterRole: 'rm_officer',
    status: getStatusLabel(ticket.status),
    action,
  });
}

function rejectTicketForOfficer(reference, username, body) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!OFFICER_REVIEW_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting RMO review.' };
  }
  const notes = String(body.rejectionNotes || body.officerNotes || '').trim();
  if (!notes) return { error: 'Rejection notes are required when returning a report.' };

  const now = new Date().toISOString();
  ticket.status = 'returned';
  ticket.officerNotes = notes;
  ticket.mitigationDueAt = null;
  ticket.updatedAt = now;
  saveStore();
  logOfficerAction(ticket, username, 'returned_for_revision');
  return { ticket: publicTicket(ticket) };
}

function acceptAndAssignMitigation(reference, username, body) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!OFFICER_REVIEW_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting RMO review.' };
  }

  const plan = String(body.mitigationPlan || body.officerNotes || '').trim();
  if (!plan) return { error: 'Mitigation plan / officer notes are required.' };

  const dueRaw = String(body.mitigationDueAt || '').trim();
  let due;
  if (dueRaw) {
    due = new Date(dueRaw);
    if (Number.isNaN(due.getTime())) return { error: 'Invalid mitigation due date.' };
  } else {
    due = new Date();
    due.setDate(due.getDate() + 14);
  }

  const now = new Date().toISOString();
  // Architecture step 4: the RMO solution must be reviewed by the Audit Officer
  // before the department begins implementation. The due date is a proposal that
  // the Audit Officer confirms (or adjusts) on approval.
  ticket.status = 'under_audit';
  ticket.officerNotes = plan;
  ticket.mitigationDueAt = due.toISOString();
  ticket.updatedAt = now;
  saveStore();
  logOfficerAction(ticket, username, 'solution_submitted_for_audit');
  return { ticket: publicTicket(ticket) };
}

function closeTicketAsOfficer(reference, username, body) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!OFFICER_FINAL_VALIDATION_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting final validation.' };
  }

  const notes = String(body.closingNotes || '').trim();
  const now = new Date().toISOString();
  ticket.status = 'closed';
  if (notes) {
    ticket.officerNotes = ticket.officerNotes
      ? `${ticket.officerNotes}\n\nFinal validation: ${notes}`
      : `Final validation: ${notes}`;
  }
  ticket.updatedAt = now;
  saveStore();
  logOfficerAction(ticket, username, 'closed');
  return { ticket: publicTicket(ticket) };
}

function returnAccomplishmentForRevision(reference, username, body) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!OFFICER_FINAL_VALIDATION_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting final validation.' };
  }

  const notes = String(body.returnNotes || body.officerNotes || '').trim();
  if (!notes) return { error: 'Return notes are required when sending back for revision.' };

  const now = new Date().toISOString();
  ticket.status = 'in_mitigation';
  ticket.officerNotes = notes;
  ticket.updatedAt = now;
  saveStore();
  logOfficerAction(ticket, username, 'accomplishment_returned');
  return { ticket: publicTicket(ticket) };
}

/* —— Audit Officer ——
 * The Audit Officer reviews the mitigation solution defined by the RMO before
 * implementation (architecture step 4). They either approve it (department may
 * begin implementation) or return it to the RMO as insufficient.
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
    .filter((t) => t.status !== 'draft')
    .map(publicTicket)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function listAuditReviewQueue() {
  return listTicketsForAudit().filter((t) => AUDIT_REVIEW_STATUSES.includes(t.status));
}

function getAuditStats() {
  const tickets = listTicketsForAudit();
  return {
    awaitingReview: tickets.filter((t) => AUDIT_REVIEW_STATUSES.includes(t.status)).length,
    inImplementation: tickets.filter((t) => t.status === 'in_mitigation').length,
    returnedToRmo: tickets.filter((t) => t.status === 'audit_returned').length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
    open: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
  };
}

function findAttachmentForAudit(attachmentId) {
  const { store } = getStore();
  for (const ticket of store.riskTickets || []) {
    const att = findAttachmentOnTicket(ticket, attachmentId);
    if (att) return { ticket, attachment: att };
  }
  return null;
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

function approveSolutionByAudit(reference, username, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForAudit(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!AUDIT_REVIEW_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting audit review.' };
  }

  // The Audit Officer may confirm or adjust the implementation due date.
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
  ticket.auditNotes = notes || 'Solution approved by Audit Officer.';
  ticket.status = 'in_mitigation';
  ticket.updatedAt = new Date().toISOString();
  saveStore();
  logAuditAction(ticket, username, 'solution_approved');
  return { ticket: publicTicket(ticket) };
}

function returnSolutionToRmo(reference, username, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForAudit(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!AUDIT_REVIEW_STATUSES.includes(ticket.status)) {
    return { error: 'This ticket is not awaiting audit review.' };
  }

  const notes = String(body.auditNotes || '').trim();
  if (!notes) return { error: 'Audit notes are required when returning a solution to the RMO.' };

  ticket.auditNotes = notes;
  ticket.status = 'audit_returned';
  ticket.updatedAt = new Date().toISOString();
  saveStore();
  logAuditAction(ticket, username, 'solution_returned_to_rmo');
  return { ticket: publicTicket(ticket) };
}

/* —— Comments / Audit trail ——
 * A shared comment thread on a ticket. Per the RMS flowchart, the Audit Officer
 * (and RMO) can leave comments / suggestions on a risk report; every comment is
 * recorded in the Report history (Audit Trail).
 */

function addTicketComment(reference, user, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };

  const text = String(body.comment || body.body || '').trim();
  if (!text) return { error: 'Comment cannot be empty.' };
  if (text.length > 2000) return { error: 'Comment is too long (max 2000 characters).' };

  if (!ticket.comments) ticket.comments = [];
  const now = new Date().toISOString();
  const record = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    authorUsername: user.username,
    authorName: user.displayName || user.username,
    authorRole: user.role,
    roleLabel: user.roleLabel || user.role,
    body: text,
    at: now,
  };
  ticket.comments.push(record);
  ticket.updatedAt = now;
  saveStore();

  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: user.username,
    submitterRole: user.role,
    status: getStatusLabel(ticket.status),
    action: 'comment_added',
  });

  return { ticket: publicTicket(ticket) };
}

function submitAccomplishment(reference, username, displayName, body) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!SUPERVISOR_ACTION_STATUSES.includes(ticket.status)) {
    return { error: 'No active mitigation assignment for this ticket.' };
  }

  const summary = String(body.summary || '').trim();
  const outcomes = String(body.outcomes || '').trim();
  if (!summary || !outcomes) {
    return { error: 'Implementation summary and outcomes are required.' };
  }

  if (!store.accomplishments) store.accomplishments = [];
  const now = new Date().toISOString();
  const record = {
    id: `acc-${Date.now()}`,
    ticketRef: ticket.reference,
    ticketTitle: ticket.title,
    summary,
    outcomes,
    evidence: parseEvidenceList(body.evidenceFiles),
    submittedBy: username,
    submittedByName: displayName,
    submittedAt: now,
  };
  store.accomplishments.push(record);
  ticket.accomplishmentId = record.id;
  ticket.status = 'pending_audit';
  ticket.updatedAt = now;
  saveStore();

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
}

module.exports = {
  listTicketsForSupervisor,
  getTicketByRef,
  getSupervisorStats,
  listActionTickets,
  listAccomplishments,
  isDraftTicket,
  canSupervisorDraftCrud,
  canSupervisorEdit,
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
  listOfficerFinalValidationQueue,
  listOfficerMonitoringQueue,
  getOfficerStats,
  findAttachmentForOfficer,
  getAccomplishmentForTicket,
  rejectTicketForOfficer,
  acceptAndAssignMitigation,
  closeTicketAsOfficer,
  returnAccomplishmentForRevision,
  getTicketByRefForAudit,
  listTicketsForAudit,
  listAuditReviewQueue,
  getAuditStats,
  findAttachmentForAudit,
  approveSolutionByAudit,
  returnSolutionToRmo,
  addTicketComment,
};
