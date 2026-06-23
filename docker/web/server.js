const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const {
  authenticate,
  requireAuth,
  requireAdmin,
  requireSupervisor,
  requireRmOfficer,
  requireAuditOfficer,
  requireExecutive,
  sessionUser,
} = require('./lib/auth');
const { loginPage, dashboardPage } = require('./lib/templates');
const {
  adminOverviewPage,
  accountsPage,
  credentialsLogPage,
  reportHistoryPage,
} = require('./lib/templates/admin');
const {
  supervisorOverviewPage,
  ticketsListPage,
  ticketFormPage,
  newRiskReportStep1Page,
  newRiskReportPreviewPage,
  actionsPage,
  accomplishmentsPage,
} = require('./lib/templates/supervisor');
const {
  officerOverviewPage,
  reviewQueuePage,
  finalValidationQueuePage,
  monitoringQueuePage,
  allTicketsPage,
  renderOfficerTicketPage,
} = require('./lib/templates/officer');
const {
  auditOverviewPage,
  auditReviewQueuePage,
  auditFinalValidationQueuePage,
  allTicketsPage: auditAllTicketsPage,
  renderAuditTicketPage,
} = require('./lib/templates/audit');
const {
  executiveOverviewPage,
  allTicketsPage: executiveAllTicketsPage,
  criticalTicketsPage,
  ticketDetailPage: executiveTicketDetailPage,
} = require('./lib/templates/executive');
const {
  getSupervisorStats,
  listTicketsForSupervisor,
  getTicketByRef,
  listActionTickets,
  listAccomplishments,
  peekNextTicketRef,
  createTicket,
  updateTicketDraft,
  deleteDraftTicket,
  submitTicket,
  addEvidence,
  submitAccomplishment,
  assignMitigationForDemo,
  findAttachmentForUser,
  canSupervisorDraftCrud,
  canSupervisorReviseReport,
  getOfficerStats,
  getOfficerDashboardData,
  listTicketsForOfficer,
  listOfficerReviewQueue,
  listOfficerFinalValidationQueue,
  listOfficerMonitoringQueue,
  getTicketByRefForOfficer,
  findAttachmentForOfficer,
  rejectTicketForOfficer,
  acceptAndAssignMitigation,
  updateMitigationPlanForOfficer,
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
  getExecutiveStats,
  listTicketsForExecutive,
  getTicketByRefForExecutive,
  findAttachmentForExecutive,
  addExecutiveComment,
  replyToExecutiveComment,
  publicTicket,
} = require('./lib/tickets');
const { logCredential } = require('./lib/logger');
const { handleEvidenceUpload } = require('./lib/upload');
const { initializeAttachmentStorage, hydrateTicketEvidence } = require('./lib/attachments');
const { migrateLegacyEvidenceFromStore } = require('./lib/attachmentRepository');
const { loadStore, saveStore } = require('./lib/store');
const {
  listUsers,
  createUser,
  updateUserRole,
  deleteUser,
  getCredentialLogs,
  getReportLogs,
} = require('./lib/store');
const { ROLES } = require('./config/roles');

const app = express();
const port = process.env.PORT || 3000;

loadStore();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  cookieSession({
    name: 'rms_session',
    secret: process.env.SESSION_SECRET || 'rms-dev-session-change-in-production',
    maxAge: 8 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }),
);

app.use(
  '/css',
  express.static(path.join(__dirname, 'public', 'css'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  }),
);

function flashFromQuery(query) {
  const map = {
    created: 'Account created successfully.',
    role_updated: 'Role updated successfully.',
    deleted: 'Account deleted successfully.',
    draft_saved: 'Draft saved successfully.',
    preview_generated: 'AI preview generated successfully.',
    draft_updated: 'Draft updated successfully.',
    draft_deleted: 'Draft deleted successfully.',
    submitted: 'Risk report submitted for RMO review.',
    evidence_added: 'Evidence reference added.',
    accomplishment_submitted: 'Accomplishment report submitted for audit review.',
    mitigation_assigned: 'Mitigation assignment simulated (development).',
    rmo_accepted: 'Mitigation solution submitted to the Audit Officer for review.',
    rmo_rejected: 'Report returned to department for revision.',
    rmo_closed: 'Ticket closed after final validation.',
    rmo_returned: 'Accomplishment returned for further implementation.',
    audit_approved: 'Solution approved. Department may begin implementation.',
    audit_returned: 'Solution returned to the RMO for revision.',
    audit_closed: 'Accomplishment approved. Ticket closed.',
    audit_accomplishment_returned: 'Accomplishment returned to the department for further action.',
    comment_added: 'Comment posted.',
    executive_comment_added: 'Executive comment posted.',
    executive_reply_added: 'Reply posted.',
    rmo_plan_updated: 'Mitigation plan updated successfully.',
    not_found: 'Ticket not found.',
    invalid: null,
  };
  if (query.flash === 'evidence_uploaded') {
    const n = parseInt(query.count, 10) || 1;
    return n > 1 ? `${n} evidence files uploaded successfully.` : 'Evidence file uploaded successfully.';
  }
  return map[query.flash] || null;
}

function dashboardPath(user) {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'supervisor') return '/supervisor';
  if (user?.role === 'rm_officer') return '/officer';
  if (user?.role === 'audit_officer') return '/audit';
  if (user?.role === 'executive') return '/executive';
  return '/dashboard';
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function sendAttachment(res, found) {
  const { streamAttachmentToResponse } = require('./lib/attachments');
  await streamAttachmentToResponse(res, found);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'web' });
});

app.get('/login', (req, res) => {
  if (req.session?.user) {
    return res.redirect(dashboardPath(req.session.user));
  }
  const error = req.query.error === 'invalid' ? 'Invalid username or password.' : null;
  const next = typeof req.query.next === 'string' ? req.query.next : '';
  res.type('html').send(loginPage({ error, next }));
});

app.post('/login', (req, res) => {
  const { username, password, next } = req.body;
  const user = authenticate(username, password);

  if (!user) {
    logCredential(req, {
      action: 'login_failed',
      username: username || '—',
      actor: '—',
      detail: 'Invalid credentials',
      success: false,
    });
    const nextParam = next ? `&next=${encodeURIComponent(next)}` : '';
    return res.redirect(`/login?error=invalid${nextParam}`);
  }

  logCredential(req, {
    action: 'login_success',
    username: user.username,
    actor: user.username,
    detail: `Signed in as ${user.roleLabel}`,
    success: true,
  });

  req.session.user = user;

  let destination = dashboardPath(user);
  if (next && typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    destination = next;
  }
  return res.redirect(destination);
});

app.post('/logout', (req, res) => {
  if (req.session?.user) {
    logCredential(req, {
      action: 'logout',
      username: req.session.user.username,
      actor: req.session.user.username,
      detail: 'Signed out',
      success: true,
    });
  }
  req.session = null;
  res.set('Cache-Control', 'no-store');
  res.redirect('/login');
});

app.get('/logout', (req, res) => {
  if (req.session?.user) {
    logCredential(req, {
      action: 'logout',
      username: req.session.user.username,
      actor: req.session.user.username,
      detail: 'Signed out',
      success: true,
    });
  }
  req.session = null;
  res.set('Cache-Control', 'no-store');
  res.redirect('/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }
  if (req.session.user.role === 'supervisor') {
    return res.redirect('/supervisor');
  }
  if (req.session.user.role === 'rm_officer') {
    return res.redirect('/officer');
  }
  if (req.session.user.role === 'audit_officer') {
    return res.redirect('/audit');
  }
  if (req.session.user.role === 'executive') {
    return res.redirect('/executive');
  }
  res.type('html').send(dashboardPage(req.session.user));
});

/* —— Department Supervisor —— */

const isDev = process.env.NODE_ENV !== 'production';

function supervisorStats(username) {
  return getSupervisorStats(username);
}

app.get('/supervisor', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const stats = supervisorStats(user.username);
  res.type('html').send(
    supervisorOverviewPage(
      user,
      stats,
      flashFromQuery(req.query),
      listTicketsForSupervisor(user.username),
    ),
  );
});

app.get('/supervisor/tickets', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    ticketsListPage(user, listTicketsForSupervisor(user.username), flashFromQuery(req.query), {
      filter: req.query.filter,
      error: req.query.error,
      stats: supervisorStats(user.username),
    }),
  );
});

app.get('/supervisor/tickets/new', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const ticketRef = peekNextTicketRef();
  res.type('html').send(
    newRiskReportStep1Page(user, ticketRef, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: supervisorStats(user.username),
    }),
  );
});

// Step 1 -> Step 2 (AI preview)
app.post('/supervisor/tickets/new/preview', requireSupervisor, handleEvidenceUpload, asyncRoute(async (req, res) => {
  const user = req.session.user;
  if (req.uploadError) {
    return res.redirect(`/supervisor/tickets/new?error=${encodeURIComponent(req.uploadError)}`);
  }
  const referenceOverride = req.body.referenceOverride;

  const result = await createTicket(user.username, user.displayName, req.body, {
    referenceOverride,
    uploadedFiles: req.files,
  });

  if (result.error) {
    return res.redirect(`/supervisor/tickets/new?error=${encodeURIComponent(result.error)}`);
  }

  return res.redirect(`/supervisor/tickets/new/preview/${result.ticket.reference}?flash=preview_generated`);
}));

app.get('/supervisor/tickets/:ref/edit', requireSupervisor, asyncRoute(async (req, res) => {
  const user = req.session.user;
  const ticket = getTicketByRef(req.params.ref, user.username);
  if (!ticket || !canSupervisorReviseReport(ticket)) {
    return res.redirect('/supervisor/tickets?error=' + encodeURIComponent('This ticket cannot be revised.'));
  }
  await hydrateTicketEvidence(ticket);
  const mode = ticket.status === 'returned' ? 'revise' : 'edit';
  return res.type('html').send(
    newRiskReportStep1Page(user, ticket.reference, {
      mode,
      ticket,
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: supervisorStats(user.username),
    }),
  );
}));

app.post('/supervisor/tickets/:ref/edit', requireSupervisor, handleEvidenceUpload, asyncRoute(async (req, res) => {
  const user = req.session.user;
  const ref = req.params.ref;
  if (req.uploadError) {
    return res.redirect(`/supervisor/tickets/${ref}/edit?error=${encodeURIComponent(req.uploadError)}`);
  }
  const ticket = getTicketByRef(ref, user.username);
  const draftOnly = ticket?.status === 'draft';
  const result = await updateTicketDraft(ref, user.username, req.body, {
    uploadedFiles: req.files,
    draftOnly,
  });
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}/edit?error=${encodeURIComponent(result.error)}`);
  }
  const uploadedCount = req.files?.length || 0;
  if (uploadedCount > 0) {
    return res.redirect(
      `/supervisor/tickets/new/preview/${ref}?flash=evidence_uploaded&count=${uploadedCount}`,
    );
  }
  return res.redirect(`/supervisor/tickets/new/preview/${ref}?flash=draft_updated`);
}));

app.post('/supervisor/tickets/:ref/delete', requireSupervisor, asyncRoute(async (req, res) => {
  const result = await deleteDraftTicket(req.params.ref, req.session.user.username);
  if (result.error) {
    return res.redirect('/supervisor/tickets?error=' + encodeURIComponent(result.error));
  }
  return res.redirect('/supervisor/tickets?flash=draft_deleted');
}));

app.get('/supervisor/attachments/:id', requireSupervisor, asyncRoute(async (req, res) => {
  const found = await findAttachmentForUser(req.params.id, req.session.user.username);
  await sendAttachment(res, found);
}));

app.get('/supervisor/tickets/new/preview/:ref', requireSupervisor, asyncRoute(async (req, res) => {
  const user = req.session.user;
  const ticket = getTicketByRef(req.params.ref, user.username);
  if (!ticket) {
    return res.redirect('/supervisor/tickets/new?flash=not_found');
  }
  await hydrateTicketEvidence(ticket);
  res.type('html').send(
    newRiskReportPreviewPage(user, ticket, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: supervisorStats(user.username),
      showUploadToast: req.query.flash === 'evidence_uploaded',
    }),
  );
}));

app.post('/supervisor/tickets/new/preview/:ref/save', requireSupervisor, (req, res) => {
  // Draft was already created during NEXT; nothing else to save in the placeholder build.
  return res.redirect(`/supervisor/tickets?flash=draft_saved`);
});

app.post('/supervisor/tickets/new/preview/:ref/submit', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const ref = req.params.ref;

  // Server-side guard: checkbox must be inside submit form (name=confirmBox, value=1).
  const confirmed = req.body.confirmBox === '1' || req.body.confirmBox === 'on';
  if (!confirmed) {
    return res.redirect(
      `/supervisor/tickets/new/preview/${encodeURIComponent(ref)}?error=${encodeURIComponent('Please confirm the information is accurate.')}`,
    );
  }

  const sub = submitTicket(ref, user.username, user.displayName);
  if (sub.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(sub.error)}`);
  }
  return res.redirect(`/supervisor/tickets/${ref}?flash=submitted`);
});

app.get('/supervisor/tickets/:ref', requireSupervisor, asyncRoute(async (req, res) => {
  const user = req.session.user;
  const raw = getTicketByRef(req.params.ref, user.username);
  if (!raw) {
    return res.redirect('/supervisor/tickets?flash=not_found');
  }
  if (raw.status === 'returned' || raw.status === 'draft') {
    return res.redirect(`/supervisor/tickets/${raw.reference}/edit`);
  }
  const ticket = await ticketForRole(raw, 'supervisor');
  res.type('html').send(
    ticketFormPage(user, ticket, {
      mode: 'view',
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      devMode: isDev,
      stats: supervisorStats(user.username),
    }),
  );
}));

app.post('/supervisor/tickets', requireSupervisor, asyncRoute(async (req, res) => {
  const user = req.session.user;
  const result = await createTicket(user.username, user.displayName, req.body);
  if (result.error) {
    return res.redirect('/supervisor/tickets/new?error=' + encodeURIComponent(result.error));
  }
  if (req.body.intent === 'submit') {
    const sub = submitTicket(result.ticket.reference, user.username, user.displayName);
    if (sub.error) {
      return res.redirect(
        `/supervisor/tickets/${result.ticket.reference}?error=${encodeURIComponent(sub.error)}`,
      );
    }
    return res.redirect(`/supervisor/tickets/${result.ticket.reference}?flash=submitted`);
  }
  return res.redirect(`/supervisor/tickets/${result.ticket.reference}?flash=draft_saved`);
}));

app.post('/supervisor/tickets/:ref', requireSupervisor, asyncRoute(async (req, res) => {
  const user = req.session.user;
  const ref = req.params.ref;
  const result = await updateTicketDraft(ref, user.username, req.body);
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  if (req.body.intent === 'submit') {
    const sub = submitTicket(ref, user.username, user.displayName);
    if (sub.error) {
      return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(sub.error)}`);
    }
    return res.redirect(`/supervisor/tickets/${ref}?flash=submitted`);
  }
  return res.redirect(`/supervisor/tickets/${ref}?flash=draft_saved`);
}));

app.post('/supervisor/tickets/:ref/evidence', requireSupervisor, handleEvidenceUpload, asyncRoute(async (req, res) => {
  const ref = req.params.ref;
  if (req.uploadError) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(req.uploadError)}`);
  }
  const result = await addEvidence(ref, req.session.user.username, req.body, { uploadedFiles: req.files });
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/supervisor/tickets/${ref}?flash=evidence_added`);
}));

app.post('/supervisor/tickets/:ref/accomplishment', requireSupervisor, handleEvidenceUpload, asyncRoute(async (req, res) => {
  const user = req.session.user;
  const ref = req.params.ref;
  if (req.uploadError) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(req.uploadError)}`);
  }
  const result = await submitAccomplishment(ref, user.username, user.displayName, req.body, {
    uploadedFiles: req.files,
  });
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/supervisor/accomplishments?flash=accomplishment_submitted');
}));

app.post('/supervisor/tickets/:ref/simulate-mitigation', requireSupervisor, (req, res) => {
  if (!isDev) {
    return res.status(404).send('Not found');
  }
  const ticket = getTicketByRef(req.params.ref, req.session.user.username);
  if (!ticket) {
    return res.redirect('/supervisor/tickets');
  }
  assignMitigationForDemo(req.params.ref);
  return res.redirect(`/supervisor/tickets/${req.params.ref}?flash=mitigation_assigned`);
});

app.get('/supervisor/actions', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    actionsPage(
      user,
      listActionTickets(user.username),
      flashFromQuery(req.query),
      supervisorStats(user.username),
    ),
  );
});

app.get('/supervisor/accomplishments', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    accomplishmentsPage(
      user,
      listAccomplishments(user.username),
      flashFromQuery(req.query),
      supervisorStats(user.username),
    ),
  );
});

/* —— Risk Management Officer —— */

function officerNoCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  return next();
}

app.use('/officer', officerNoCache);

app.get('/officer', requireRmOfficer, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    officerOverviewPage(user, getOfficerDashboardData(), flashFromQuery(req.query)),
  );
});

app.get('/officer/review', requireRmOfficer, (req, res) => {
  res.type('html').send(
    reviewQueuePage(
      req.session.user,
      listOfficerReviewQueue(),
      flashFromQuery(req.query),
      {
        error: req.query.error ? decodeURIComponent(req.query.error) : null,
        stats: getOfficerStats(),
      },
    ),
  );
});

app.get('/officer/final-validation', requireRmOfficer, (req, res) => {
  res.type('html').send(
    finalValidationQueuePage(
      req.session.user,
      listOfficerFinalValidationQueue(),
      flashFromQuery(req.query),
      {
        error: req.query.error ? decodeURIComponent(req.query.error) : null,
        stats: getOfficerStats(),
      },
    ),
  );
});

app.get('/officer/monitoring', requireRmOfficer, (req, res) => {
  res.type('html').send(
    monitoringQueuePage(
      req.session.user,
      listOfficerMonitoringQueue(),
      flashFromQuery(req.query),
      { stats: getOfficerStats() },
    ),
  );
});

app.get('/officer/tickets', requireRmOfficer, (req, res) => {
  res.type('html').send(
    allTicketsPage(req.session.user, listTicketsForOfficer(), flashFromQuery(req.query), {
      stats: getOfficerStats(),
    }),
  );
});

app.get('/officer/tickets/:ref', requireRmOfficer, asyncRoute(async (req, res) => {
  const raw = getTicketByRefForOfficer(req.params.ref);
  if (!raw) {
    return res.redirect('/officer/tickets?flash=not_found');
  }
  const ticket = await ticketForRole(raw, 'rm_officer');
  res.type('html').send(
    renderOfficerTicketPage(req.session.user, ticket, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: getOfficerStats(),
    }),
  );
}));

app.get('/officer/attachments/:id', requireRmOfficer, asyncRoute(async (req, res) => {
  const found = await findAttachmentForOfficer(req.params.id);
  await sendAttachment(res, found);
}));

app.post('/officer/tickets/:ref/accept', requireRmOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = acceptAndAssignMitigation(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/officer/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/officer/monitoring?flash=rmo_accepted`);
});

app.post('/officer/tickets/:ref/reject', requireRmOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = rejectTicketForOfficer(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/officer/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/officer/review?flash=rmo_rejected');
});

app.post('/officer/tickets/:ref/close', requireRmOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = closeTicketAsOfficer(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/officer/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/officer/final-validation?flash=rmo_closed');
});

app.post('/officer/tickets/:ref/return-accomplishment', requireRmOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = returnAccomplishmentForRevision(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/officer/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/officer/monitoring?flash=rmo_returned');
});

app.post('/officer/tickets/:ref/update-mitigation', requireRmOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = updateMitigationPlanForOfficer(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/officer/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  const flash = result.ticket?.status === 'under_audit' ? 'rmo_plan_updated' : 'rmo_plan_updated';
  return res.redirect(`/officer/tickets/${ref}?flash=${flash}`);
});

app.all('/officer/tickets/:ref/comment', requireRmOfficer, (req, res) => {
  res.status(404).type('text').send('Comment feature is not available for the RMO console.');
});

app.all('/officer/tickets/:ref/executive-reply', requireRmOfficer, (req, res) => {
  res.status(404).type('text').send('Comment feature is not available for the RMO console.');
});

/* —— Audit Officer —— */

app.get('/audit', requireAuditOfficer, (req, res) => {
  res.type('html').send(
    auditOverviewPage(req.session.user, getAuditStats(), flashFromQuery(req.query)),
  );
});

app.get('/audit/review', requireAuditOfficer, (req, res) => {
  const stats = getAuditStats();
  res.type('html').send(
    auditReviewQueuePage(
      req.session.user,
      listAuditReviewQueue(),
      flashFromQuery(req.query),
      { error: req.query.error ? decodeURIComponent(req.query.error) : null, stats },
    ),
  );
});

app.get('/audit/final-validation', requireAuditOfficer, (req, res) => {
  const stats = getAuditStats();
  res.type('html').send(
    auditFinalValidationQueuePage(
      req.session.user,
      listAuditFinalValidationQueue(),
      flashFromQuery(req.query),
      { error: req.query.error ? decodeURIComponent(req.query.error) : null, stats },
    ),
  );
});

app.get('/audit/tickets', requireAuditOfficer, (req, res) => {
  const stats = getAuditStats();
  res.type('html').send(
    auditAllTicketsPage(req.session.user, listTicketsForAudit(), flashFromQuery(req.query), { stats }),
  );
});

app.get('/audit/tickets/:ref', requireAuditOfficer, asyncRoute(async (req, res) => {
  const raw = getTicketByRefForAudit(req.params.ref);
  if (!raw) {
    return res.redirect('/audit/tickets?flash=not_found');
  }
  const ticket = await ticketForRole(raw, 'audit_officer');
  res.type('html').send(
    renderAuditTicketPage(req.session.user, ticket, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: getAuditStats(),
    }),
  );
}));

app.get('/audit/attachments/:id', requireAuditOfficer, asyncRoute(async (req, res) => {
  const found = await findAttachmentForAudit(req.params.id);
  await sendAttachment(res, found);
}));

app.post('/audit/tickets/:ref/approve', requireAuditOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = approveSolutionByAudit(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/audit/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/audit/review?flash=audit_approved');
});

app.post('/audit/tickets/:ref/return', requireAuditOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = returnSolutionToRmo(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/audit/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/audit/review?flash=audit_returned');
});

app.post('/audit/tickets/:ref/close', requireAuditOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = closeTicketAsAudit(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/audit/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/audit/final-validation?flash=audit_closed');
});

app.post('/audit/tickets/:ref/return-accomplishment', requireAuditOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = returnAccomplishmentAsAudit(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/audit/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/audit/final-validation?flash=audit_accomplishment_returned');
});

app.post('/audit/tickets/:ref/comment', requireAuditOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = addTicketComment(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/audit/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/audit/tickets/${ref}?flash=comment_added`);
});

app.post('/audit/tickets/:ref/executive-reply', requireAuditOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = replyToExecutiveComment(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/audit/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/audit/tickets/${ref}?flash=executive_reply_added`);
});

/* —— Executive —— */

app.get('/executive', requireExecutive, (req, res) => {
  res.type('html').send(
    executiveOverviewPage(
      req.session.user,
      getExecutiveStats(),
      flashFromQuery(req.query),
    ),
  );
});

app.get('/executive/critical', requireExecutive, (req, res) => {
  const stats = getExecutiveStats();
  const tickets = listTicketsForExecutive({ level: 'critical' });
  res.type('html').send(
    criticalTicketsPage(req.session.user, tickets, flashFromQuery(req.query), stats),
  );
});

app.get('/executive/tickets', requireExecutive, (req, res) => {
  const stats = getExecutiveStats();
  const level = typeof req.query.level === 'string' ? req.query.level : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const filters = { level, category };
  const tickets = listTicketsForExecutive({
    level: level || undefined,
    category: category || undefined,
  });
  res.type('html').send(
    executiveAllTicketsPage(req.session.user, tickets, flashFromQuery(req.query), filters, stats),
  );
});

app.get('/executive/tickets/:ref', requireExecutive, asyncRoute(async (req, res) => {
  const raw = getTicketByRefForExecutive(req.params.ref);
  if (!raw) {
    return res.redirect('/executive/tickets?flash=not_found');
  }
  const ticket = await ticketForRole(raw, 'executive');
  res.type('html').send(
    executiveTicketDetailPage(req.session.user, ticket, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: getExecutiveStats(),
    }),
  );
}));

app.get('/executive/attachments/:id', requireExecutive, asyncRoute(async (req, res) => {
  const found = await findAttachmentForExecutive(req.params.id);
  await sendAttachment(res, found);
}));

app.post('/executive/tickets/:ref/comment', requireExecutive, (req, res) => {
  const ref = req.params.ref;
  const result = addExecutiveComment(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/executive/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/executive/tickets/${ref}?flash=executive_comment_added`);
});

/* —— IT Administrator —— */

app.get('/admin', requireAdmin, (req, res) => {
  const cred = getCredentialLogs();
  const reports = getReportLogs();
  res.type('html').send(
    adminOverviewPage(req.session.user, {
      accounts: listUsers().length,
      credentialEvents: cred.length,
      reportEvents: reports.length,
    }, flashFromQuery(req.query)),
  );
});

app.get('/admin/accounts', requireAdmin, (req, res) => {
  res.type('html').send(
    accountsPage(
      req.session.user,
      listUsers(),
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
    ),
  );
});

app.post('/admin/accounts', requireAdmin, (req, res) => {
  const { username, password, displayName, role } = req.body;
  if (!ROLES[role]) {
    return res.redirect('/admin/accounts?error=' + encodeURIComponent('Invalid role selected.'));
  }
  const result = createUser({ username, password, displayName, role });
  if (result.error) {
    return res.redirect('/admin/accounts?error=' + encodeURIComponent(result.error));
  }
  logCredential(req, {
    action: 'account_created',
    username: result.user.username,
    actor: req.session.user.username,
    detail: `Created account with role ${result.user.roleLabel}`,
    success: true,
  });
  return res.redirect('/admin/accounts?flash=created');
});

app.post('/admin/accounts/:username/role', requireAdmin, (req, res) => {
  const username = req.params.username.toLowerCase();
  const { role } = req.body;
  if (!ROLES[role]) {
    return res.redirect('/admin/accounts?error=' + encodeURIComponent('Invalid role.'));
  }
  const result = updateUserRole(username, role, req.session.user.username);
  if (result.error) {
    return res.redirect('/admin/accounts?error=' + encodeURIComponent(result.error));
  }
  logCredential(req, {
    action: 'role_changed',
    username,
    actor: req.session.user.username,
    detail: `Role changed from ${ROLES[result.previous]?.label || result.previous} to ${result.user.roleLabel}`,
    success: true,
  });
  return res.redirect('/admin/accounts?flash=role_updated');
});

app.post('/admin/accounts/:username/delete', requireAdmin, (req, res) => {
  const username = req.params.username.toLowerCase();
  const result = deleteUser(username);
  if (result.error) {
    return res.redirect('/admin/accounts?error=' + encodeURIComponent(result.error));
  }
  logCredential(req, {
    action: 'account_deleted',
    username,
    actor: req.session.user.username,
    detail: `Deleted account (${result.user.roleLabel})`,
    success: true,
  });
  return res.redirect('/admin/accounts?flash=deleted');
});

app.get('/admin/logs/credentials', requireAdmin, (req, res) => {
  res.type('html').send(
    credentialsLogPage(req.session.user, getCredentialLogs(), flashFromQuery(req.query)),
  );
});

app.get('/admin/logs/reports', requireAdmin, (req, res) => {
  res.type('html').send(
    reportHistoryPage(req.session.user, getReportLogs(), flashFromQuery(req.query)),
  );
});

app.get('/', (req, res) => {
  if (req.session?.user) {
    return res.redirect(dashboardPath(req.session.user));
  }
  return res.redirect('/login');
});

app.use((err, req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).send('An unexpected error occurred.');
});

async function startServer() {
  await initializeAttachmentStorage();
  const store = loadStore();
  const migrated = await migrateLegacyEvidenceFromStore(store.riskTickets);
  if (migrated) {
    saveStore();
    console.log(`Migrated ${migrated} legacy evidence record(s) to PostgreSQL.`);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`rms-web listening on ${port} (files: MinIO, metadata: PostgreSQL)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start rms-web:', err);
  process.exit(1);
});
