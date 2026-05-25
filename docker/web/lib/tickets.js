const {
  DEFAULT_DEPARTMENT,
  TICKET_STATUSES,
  SUPERVISOR_ACTION_STATUSES,
  GRACE_PERIOD_MS,
  getStatusLabel,
  getCategoryLabel,
} = require('../config/tickets');

function getStore() {
  const { loadStore, saveStore } = require('./store');
  return { store: loadStore(), saveStore };
}

function nextTicketRef(store) {
  const year = new Date().getFullYear();
  const prefix = `RMS-${year}-`;
  const nums = (store.riskTickets || [])
    .map((t) => t.reference)
    .filter((r) => r && r.startsWith(prefix))
    .map((r) => parseInt(r.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
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
    mitigationDueAt: ticket.mitigationDueAt || null,
    isOverdue: ticket.mitigationDueAt
      ? new Date(ticket.mitigationDueAt) < new Date() && SUPERVISOR_ACTION_STATUSES.includes(ticket.status)
      : false,
  };
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
      note: 'Metadata only until object storage is integrated',
    }));
}

function mockAiClassification(ticket) {
  const score = Math.min(5, Math.max(1, Math.round((ticket.likelihood + ticket.impact) / 2)));
  const confidence = 0.72 + Math.random() * 0.2;
  return {
    category: ticket.category,
    severity: score,
    confidence: Math.round(confidence * 100) / 100,
    manualReviewRequired: confidence < 0.75,
    summary: `AI pre-classification: ${getCategoryLabel(ticket.category)} risk with severity ${score}/5 based on reported likelihood (${ticket.likelihood}) and impact (${ticket.impact}).`,
    processedAt: new Date().toISOString(),
  };
}

function createTicket(username, displayName, body) {
  const { store, saveStore } = getStore();
  if (!store.riskTickets) store.riskTickets = [];
  const now = new Date().toISOString();
  const fiveW1H = parseFiveW1H(body);
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Risk title is required.' };
  if (!fiveW1H.what || !fiveW1H.why) {
    return { error: 'What happened and why are required (5W1H).' };
  }

  const ticket = {
    id: `tkt-${Date.now()}`,
    reference: nextTicketRef(store),
    title,
    description: String(body.description || '').trim(),
    department: String(body.department || DEFAULT_DEPARTMENT).trim(),
    location: String(body.location || '').trim(),
    category: String(body.category || 'operational'),
    likelihood: Math.min(5, Math.max(1, parseInt(body.likelihood, 10) || 3)),
    impact: Math.min(5, Math.max(1, parseInt(body.impact, 10) || 3)),
    riskScore: null,
    mitigationApproach: String(body.mitigationApproach || '').trim(),
    fiveW1H,
    evidence: parseEvidenceList(body.evidenceFiles),
    status: 'draft',
    submittedBy: username,
    submittedByName: displayName,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    ai: null,
    accomplishmentId: null,
    mitigationDueAt: null,
    officerNotes: null,
  };
  ticket.riskScore = ticket.likelihood * ticket.impact;
  store.riskTickets.push(ticket);
  saveStore();
  return { ticket: publicTicket(ticket) };
}

function updateTicketDraft(reference, username, body) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!canSupervisorEdit(ticket)) {
    return { error: 'This ticket can no longer be edited.' };
  }

  const fiveW1H = parseFiveW1H(body);
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Risk title is required.' };
  if (!fiveW1H.what || !fiveW1H.why) {
    return { error: 'What happened and why are required (5W1H).' };
  }

  ticket.title = title;
  ticket.description = String(body.description || '').trim();
  ticket.department = String(body.department || ticket.department).trim();
  ticket.location = String(body.location || '').trim();
  ticket.category = String(body.category || ticket.category);
  ticket.likelihood = Math.min(5, Math.max(1, parseInt(body.likelihood, 10) || ticket.likelihood));
  ticket.impact = Math.min(5, Math.max(1, parseInt(body.impact, 10) || ticket.impact));
  ticket.riskScore = ticket.likelihood * ticket.impact;
  ticket.mitigationApproach = String(body.mitigationApproach || '').trim();
  ticket.fiveW1H = fiveW1H;
  if (body.evidenceFiles) {
    const added = parseEvidenceList(body.evidenceFiles);
    ticket.evidence = [...(ticket.evidence || []), ...added];
  }
  ticket.updatedAt = new Date().toISOString();
  saveStore();
  return { ticket: publicTicket(ticket) };
}

function submitTicket(reference, username, displayName) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  if (!canSupervisorEdit(ticket) && ticket.status !== 'draft' && ticket.status !== 'returned') {
    return { error: 'This ticket cannot be submitted.' };
  }

  const now = new Date().toISOString();
  ticket.ai = mockAiClassification(ticket);
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

function addEvidence(reference, username, body) {
  const { store, saveStore } = getStore();
  const ticket = getTicketByRef(reference, username);
  if (!ticket) return { error: 'Ticket not found.' };
  const added = parseEvidenceList(body.evidenceFiles);
  if (!added.length) return { error: 'Enter at least one evidence file name or reference.' };
  ticket.evidence = [...(ticket.evidence || []), ...added];
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
  canSupervisorEdit,
  createTicket,
  updateTicketDraft,
  submitTicket,
  addEvidence,
  submitAccomplishment,
  publicTicket,
  assignMitigationForDemo,
};
