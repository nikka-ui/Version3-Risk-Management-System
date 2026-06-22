const {
  DEFAULT_DEPARTMENT,
  TICKET_STATUSES,
  SUPERVISOR_ACTION_STATUSES,
  SUPERVISOR_ACCOMPLISHMENT_STATUSES,
  OFFICER_REVIEW_STATUSES,
  OFFICER_FINAL_VALIDATION_STATUSES,
  OFFICER_MONITORING_STATUSES,
  AUDIT_REVIEW_STATUSES,
  AUDIT_FINAL_VALIDATION_STATUSES,
  OFFICER_MITIGATION_EDIT_STATUSES,
  SUPERVISOR_MITIGATION_VISIBLE_STATUSES,
  GRACE_PERIOD_MS,
  getStatusLabel,
  getCategoryLabel,
} = require('../config/tickets');
const {
  saveUploadedFiles,
  saveLegacyEvidenceReferences,
  deleteTicketUploads,
  removeAttachmentsFromTicket,
  hydrateTicketEvidence,
} = require('./attachments');
const attachmentRepo = require('./attachmentRepository');

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
    evidenceCount: ticket.evidenceCount ?? (ticket.evidence || []).length,
    hasAccomplishment: Boolean(ticket.accomplishmentId),
    officerNotes: ticket.officerNotes || null,
    auditNotes: ticket.auditNotes || null,
    mitigationDueAt: ticket.mitigationDueAt || null,
    mitigationPlanVersion: ticket.mitigationPlanVersion || 0,
    hasMitigationPlan: Boolean(ticket.officerNotes && ticket.mitigationPlanVersion),
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
    Math.min(0.98, 0.68 + ((ticket.evidenceCount ?? ticket.evidence?.length) ? 0.1 : 0) + (String(ticket.description || '').length > 200 ? 0.06 : 0)),
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

async function createTicket(username, displayName, body, { referenceOverride, uploadedFiles } = {}) {
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
    category: ai.riskCategory,
    likelihood: ai.likelihood,
    impact: ai.impact,
    riskScore: null,
    mitigationApproach: String(body.mitigationApproach || '').trim(),
    fiveW1H,
    evidenceCount: evidenceFiles.length,
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
    privateComments: [],
    executiveComments: [],
    mitigationPlanHistory: [],
    mitigationPlanVersion: 0,
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
  ticket.department = String(body.department || ticket.department).trim();
  ticket.location = String(body.location || '').trim();
  ticket.mitigationApproach = String(body.mitigationApproach || '').trim();
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

  const now = new Date().toISOString();
  // If the supervisor already generated an AI preview, keep it unless the draft was edited.
  const shouldRefreshAi =
    !ticket.ai
    || ticket.ai.likelihood !== ticket.likelihood
    || ticket.ai.impact !== ticket.impact
    || ticket.ai.riskCategory !== ticket.category;

  ticket.ai = shouldRefreshAi ? mockAiClassification(ticket) : ticket.ai;
  const wasReturned = ticket.status === 'returned';
  ticket.status = 'under_review';
  if (wasReturned) {
    ticket.officerNotes = null;
    ticket.mitigationDueAt = null;
  }
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
    total: tickets.length,
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
  return Boolean(
    ticket?.officerNotes && OFFICER_MITIGATION_EDIT_STATUSES.includes(ticket.status),
  );
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
    return merged;
  }

  if (role === 'rm_officer') {
    merged.privateComments = undefined;
    merged.executiveComments = undefined;
    merged.comments = undefined;
    merged.mitigationPlanHistory = ticket.mitigationPlanHistory || [];
    merged.evidence = ticket.evidence || [];
    return merged;
  }

  if (role === 'audit_officer') {
    merged.privateComments = ticket.privateComments || [];
    merged.executiveComments = ticket.executiveComments || [];
    merged.mitigationPlanHistory = ticket.mitigationPlanHistory || [];
    merged.evidence = ticket.evidence || [];
    merged.comments = merged.privateComments;
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

  if (role === 'admin') {
    merged.mitigationPlanHistory = ticket.mitigationPlanHistory || [];
    merged.privateComments = ticket.privateComments || [];
    merged.executiveComments = ticket.executiveComments || [];
    merged.evidence = ticket.evidence || [];
    return merged;
  }

  return merged;
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

  const due = parseMitigationDueDate(body.mitigationDueAt);
  if (!due) return { error: 'Invalid mitigation due date.' };

  const now = new Date().toISOString();
  ensurePrivateComments(ticket);
  appendMitigationPlanHistory(
    ticket,
    { username, displayName: username, role: 'rm_officer' },
    {
      action: 'created',
      previous: { plan: null, dueAt: null },
      updated: { plan, dueAt: due.toISOString() },
    },
  );
  ticket.mitigationPlanVersion = 1;
  // Architecture step 4: the RMO solution must be reviewed by the Audit Officer
  // before the department begins implementation. The due date is a proposal that
  // the Audit Officer confirms (or adjusts) on approval.
  ticket.status = 'under_audit';
  ticket.officerNotes = plan;
  ticket.mitigationDueAt = due.toISOString();
  ticket.updatedAt = now;
  saveStore();
  logOfficerAction(
    ticket,
    username,
    'solution_submitted_for_audit',
    `Mitigation plan v1 submitted for audit review.`,
  );
  return { ticket: publicTicket(ticket) };
}

function updateMitigationPlanForOfficer(reference, user, body) {
  const { saveStore } = getStore();
  const ticket = getTicketByRefForOfficer(reference);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!canOfficerEditMitigation(ticket)) {
    return { error: 'This mitigation plan cannot be edited at the current ticket stage.' };
  }

  const plan = String(body.mitigationPlan || body.officerNotes || '').trim();
  if (!plan) return { error: 'Mitigation plan is required.' };

  const due = parseMitigationDueDate(body.mitigationDueAt);
  if (!due) return { error: 'Invalid mitigation due date.' };

  const previous = {
    plan: ticket.officerNotes || null,
    dueAt: ticket.mitigationDueAt || null,
  };
  const updated = {
    plan,
    dueAt: due.toISOString(),
  };

  const unchanged =
    previous.plan === updated.plan && previous.dueAt === updated.dueAt;
  if (unchanged) {
    return { error: 'No changes were made to the mitigation plan.' };
  }

  ensurePrivateComments(ticket);
  const resubmit = ticket.status === 'audit_returned' || body.resubmitForAudit === '1';
  appendMitigationPlanHistory(ticket, user, {
    action: resubmit ? 'updated_and_resubmitted' : 'updated',
    previous,
    updated,
  });

  ticket.officerNotes = plan;
  ticket.mitigationDueAt = updated.dueAt;
  ticket.mitigationPlanVersion = (ticket.mitigationPlanVersion || 0) + 1;
  if (resubmit) {
    ticket.status = 'under_audit';
  }
  ticket.updatedAt = new Date().toISOString();
  saveStore();

  const detail = JSON.stringify({
    version: ticket.mitigationPlanVersion,
    previous,
    updated,
    resubmittedForAudit: resubmit,
  });
  logOfficerAction(ticket, user.username, 'mitigation_plan_updated', detail);

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
    ticket.closingNotes = notes;
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
  ticket.supervisorFeedback = notes;
  ticket.updatedAt = now;
  saveStore();
  logOfficerAction(ticket, username, 'accomplishment_returned');
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
  ticket.status = 'closed';
  if (notes) {
    ticket.auditNotes = notes;
  }
  ticket.updatedAt = now;
  saveStore();
  logAuditAction(ticket, username, 'accomplishment_approved_closed');
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
    .filter((t) => t.status !== 'draft')
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
  return {
    total: tickets.length,
    byLevel,
    byCategory,
    criticalCount: byLevel.critical,
    criticalTickets,
    open: tickets.filter((t) => !['closed', 'resolved'].includes(t.status)).length,
    closed: tickets.filter((t) => ['closed', 'resolved'].includes(t.status)).length,
  };
}

async function findAttachmentForExecutive(attachmentId) {
  const attachment = await attachmentRepo.findById(attachmentId);
  if (!attachment) return null;
  const ticket = getTicketByRefForExecutive(attachment.ticketRef);
  if (!ticket) return null;
  return { ticket, attachment };
}

function addExecutiveComment(reference, user, body) {
  const { saveStore } = getStore();
  if (user.role !== 'executive') {
    return { error: 'Only the Executive may post oversight comments.' };
  }
  const ticket = getTicketByRefForExecutive(reference);
  if (!ticket) return { error: 'Ticket not found.' };

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

  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: user.username,
    submitterRole: 'executive',
    status: getStatusLabel(ticket.status),
    action: 'executive_comment_added',
    detail: 'Executive oversight comment posted.',
  });

  return { ticket: publicTicket(ticket) };
}

function replyToExecutiveComment(reference, user, body) {
  const { saveStore } = getStore();
  if (!['rm_officer', 'audit_officer'].includes(user.role)) {
    return { error: 'Only the RMO or Audit Officer may reply to executive comments.' };
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
  if (!['rm_officer', 'audit_officer'].includes(user.role)) {
    return { error: 'Only the RMO and Audit Officer may post private comments.' };
  }
  const ticket = getTicketByRefForOfficer(reference);
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

  const { appendReportLog } = require('./store');
  appendReportLog({
    ticketRef: ticket.reference,
    title: ticket.title,
    submittedBy: user.username,
    submitterRole: user.role,
    status: getStatusLabel(ticket.status),
    action: 'private_comment_added',
    detail: 'Private RMO/Audit comment (not visible to department supervisor).',
  });

  return { ticket: publicTicket(ticket) };
}

function submitAccomplishment(reference, username, displayName, body) {
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
  canSupervisorReviseReport,
  canSupervisorEdit,
  canSupervisorSubmitAccomplishment,
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
  ticketRiskLevelId,
  getTicketByRefForExecutive,
  listTicketsForExecutive,
  getExecutiveStats,
  findAttachmentForExecutive,
  addExecutiveComment,
  replyToExecutiveComment,
};
