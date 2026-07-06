const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const {
  authenticate,
  requireAuth,
  requireAdmin,
  requireSupervisor,
  requireDeptHead,
  requireRmOfficer,
  requireAuditOfficer,
  requireExecutive,
  requirePresident,
  sessionUser,
  refreshSessionUser,
} = require('./lib/auth');
const { loginPage, dashboardPage } = require('./lib/templates');
const {
  adminOverviewPage,
  usersPage,
  resetPasswordPage,
  departmentsPage,
  positionsPage,
  ticketsPage,
  ticketDetailPage,
  auditLogsPage,
  settingsPage,
  profilePage,
} = require('./lib/templates/admin');
const {
  supervisorOverviewPage,
  ticketsListPage,
  ticketFormPage,
  newRiskReportStep1Page,
  newRiskReportPreviewPage,
  actionsPage,
  accomplishmentsPage,
  filteredTicketsPage,
  reporterProfilePage,
  reporterNotificationsPage,
} = require('./lib/templates/supervisor');
const {
  officerOverviewPage,
  reviewQueuePage,
  finalValidationQueuePage,
  overdueQueuePage,
  monitoringQueuePage,
  allTicketsPage,
  renderOfficerTicketPage,
} = require('./lib/templates/officer');
const {
  deptHeadOverviewPage,
  deptHeadInboxPage,
  deptHeadActivePage,
  deptHeadAllTicketsPage,
  renderDeptHeadTicketPage,
} = require('./lib/templates/dept-head');
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
  heatmapPage: executiveHeatmapPage,
  reportsPage: executiveReportsPage,
  trendsPage: executiveTrendsPage,
  statisticsPage: executiveStatisticsPage,
  departmentPerformancePage: executiveDepartmentPerformancePage,
} = require('./lib/templates/executive');
const {
  presidentOverviewPage,
  pendingQueuePage,
  highTicketsPage,
  criticalTicketsPage: presidentCriticalTicketsPage,
  ticketDetailPage: presidentTicketDetailPage,
} = require('./lib/templates/president');
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
  hasRevisionSinceReturn,
  ensureReturnRevisionBaseline,
  findAttachmentForUser,
  canSupervisorDraftCrud,
  canSupervisorReviseReport,
  getOfficerStats,
  getOfficerDashboardData,
  listTicketsForOfficer,
  listRmuOverdueQueue,
  listRmuAiReviewQueue,
  listRmuActionPlanQueue,
  listOfficerMonitoringQueue,
  getTicketByRefForOfficer,
  findAttachmentForOfficer,
  addTicketComment,
  addRmuThreadComment,
  ticketForRole,
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
  getExecutiveStats,
  getExecutiveDashboardData,
  listTicketsForExecutive,
  getTicketByRefForExecutive,
  findAttachmentForExecutive,
  addExecutiveComment,
  replyToExecutiveComment,
  getPresidentStats,
  listTicketsForPresident,
  listPresidentPendingQueue,
  getTicketByRefForPresident,
  findAttachmentForPresident,
  recordPresidentDecision,
  publicTicket,
  listTicketsForAdmin,
  getAdminTicketStats,
  getTicketByRefForAdmin,
  softDeleteTicketForAdmin,
  ticketRiskLevelId,
} = require('./lib/tickets');
const { logCredential } = require('./lib/logger');
const { logAdminAction, notifyAdmin, getAdminDashboardData } = require('./lib/admin');
const { markTicketNotificationsRead, layoutNotifications } = require('./lib/notifications');
const { markNotificationsReadForUser } = require('./lib/store');
const { handleEvidenceUpload } = require('./lib/upload');
const { initializeAttachmentStorage, hydrateTicketEvidence } = require('./lib/attachments');
const { migrateLegacyEvidenceFromStore } = require('./lib/attachmentRepository');
const { loadStore, saveStore } = require('./lib/store');
const {
  listUsers,
  createUser,
  updateUser,
  updateUserRole,
  deleteUser,
  setUserStatus,
  resetUserPassword,
  findUserRecord,
  getCredentialLogs,
  listDepartments,
  findDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  getAuditLogs,
  getAuditLogFilterOptions,
  getSystemSettings,
  updateSystemSettings,
} = require('./lib/store');
const { isAssignableRole, roleDashboardPath } = require('./config/roles');
const { REPORTER_REVISION_STATUSES } = require('./config/tickets');

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

app.use(
  '/img',
  express.static(path.join(__dirname, 'public', 'img'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  }),
);

function flashFromQuery(query) {
  const map = {
    created: 'Account created successfully.',
    updated: 'Record updated successfully.',
    role_updated: 'Role updated successfully.',
    deleted: 'Record deleted successfully.',
    activated: 'User activated successfully.',
    deactivated: 'User deactivated successfully.',
    password_reset: 'Password reset successfully.',
    settings_saved: 'System settings saved successfully.',
    ticket_deleted: 'Ticket deleted successfully (soft delete).',
    draft_saved: 'Draft saved successfully.',
    preview_generated: 'AI preview generated successfully.',
    draft_updated: 'Draft updated successfully.',
    draft_deleted: 'Draft deleted successfully.',
    submitted: 'Risk ticket submitted. AI analysis complete — ticket routed to the responsible department.',
    evidence_added: 'Evidence reference added.',
    accomplishment_submitted: 'Accomplishment report submitted for audit review.',
    comment_posted: 'Comment posted to the ticket thread.',
    notifications_read: 'All notifications marked as read.',
    mitigation_assigned: 'Mitigation assignment simulated (development).',
    rmo_accepted: 'Mitigation solution submitted to the Compliance Officer for review.',
    rmo_rejected: 'Report returned to department for revision.',
    rmo_closed: 'Ticket closed after final validation.',
    rmo_returned: 'Accomplishment returned for further implementation.',
    audit_approved: 'Compliance validation completed. Action plan approved for implementation or presidential review.',
    audit_returned: 'Action plan returned to the department for revision.',
    audit_closed: 'Compliance review completed. Ticket forwarded for presidential final decision or closed.',
    audit_accomplishment_returned: 'Revisions requested. Accomplishment returned to the department.',
    comment_added: 'Comment posted.',
    ownership_accepted: 'Ownership accepted. This ticket is now in progress under your department.',
    ownership_rejected: 'Ticket returned by the department. Revise your report and resubmit.',
    ticket_reassigned: 'Reassignment requested. The reporter and new department have been notified.',
    action_plan_saved: 'Action plan saved.',
    action_plan_submitted: 'Action plan submitted to Compliance for validation.',
    personnel_assigned: 'Personnel assigned to the ticket.',
    documents_uploaded_dept: 'Documents uploaded successfully.',
    progress_submitted: 'Progress update submitted.',
    resolution_submitted: 'Final resolution submitted. Awaiting the President\u2019s decision.',
    resolution_submitted_president: 'Final resolution submitted. Awaiting the President\u2019s decision (High/Critical risk).',
    resolution_submitted_auto: 'Final resolution auto-approved per department policy (Low/Moderate risk).',
    resolution_submitted_resolved: 'Final resolution accepted. Ticket resolved (Low/Moderate risk — no presidential review required).',
    president_approve: 'Presidential approval recorded.',
    president_reject: 'Action plan rejected. Ticket returned to the department.',
    president_return: 'Ticket returned to the department for further work.',
    president_close: 'Ticket closed.',
    dept_comment_posted: 'Comment posted to the ticket thread.',
    executive_comment_added: 'Executive Committee comment posted.',
    executive_reply_added: 'Reply posted.',
    rmo_recommendation: 'Governance recommendation recorded.',
    rmu_escalated: 'Ticket escalated successfully.',
    rmu_ai_overridden: 'AI classification overridden.',
    rmu_thread_comment: 'Governance comment posted.',
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
  return roleDashboardPath(user?.role);
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
  const loginErrors = {
    invalid_username: 'Invalid username.',
    invalid_password: 'Invalid password.',
  };
  const errorKey = typeof req.query.error === 'string' ? req.query.error : '';
  const error = loginErrors[errorKey] || null;
  const next = typeof req.query.next === 'string' ? req.query.next : '';
  res.type('html').send(loginPage({ error, next }));
});

app.post('/login', (req, res) => {
  const { username, password, next } = req.body;
  const authResult = authenticate(username, password);

  if (authResult.error) {
    logCredential(req, {
      action: 'login_failed',
      username: username || '—',
      actor: '—',
      detail: 'Invalid credentials',
      success: false,
    });
    const { appendAuditLog } = require('./lib/store');
    const { parseClientInfo } = require('./lib/admin');
    const { device, browser } = parseClientInfo(req);
    appendAuditLog({
      username: username || '—',
      role: '—',
      roleLabel: '—',
      action: 'login_failed',
      module: 'Security',
      description: 'Failed login attempt detected',
      ip: require('./lib/logger').clientIp(req),
      device,
      browser,
    });
    notifyAdmin({
      type: 'failed_login',
      title: 'Failed login attempt',
      message: `Failed login for username: ${username || 'unknown'}`,
    });
    const nextParam = next ? `&next=${encodeURIComponent(next)}` : '';
    return res.redirect(`/login?error=${authResult.error}${nextParam}`);
  }

  const user = authResult.user;

  logCredential(req, {
    action: 'login_success',
    username: user.username,
    actor: user.username,
    detail: `Signed in as ${user.roleLabel}`,
    success: true,
  });

  {
    const { appendAuditLog } = require('./lib/store');
    const { parseClientInfo } = require('./lib/admin');
    const { device, browser } = parseClientInfo(req);
    appendAuditLog({
      username: user.username,
      role: user.role,
      roleLabel: user.roleLabel,
      action: 'login_success',
      module: 'Security',
      description: `Successful login as ${user.roleLabel}`,
      ip: require('./lib/logger').clientIp(req),
      device,
      browser,
    });
  }

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
  const target = roleDashboardPath(req.session.user.role);
  if (target && target !== '/dashboard') {
    return res.redirect(target);
  }
  res.type('html').send(dashboardPage(req.session.user));
});

/* —— Ticket Reporter —— */

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
    reporterDepartment: user.department,
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
  if (ensureReturnRevisionBaseline(ticket)) {
    saveStore();
  }
  const mode = REPORTER_REVISION_STATUSES.includes(ticket.status) ? 'revise' : 'edit';
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
  if (ensureReturnRevisionBaseline(ticket)) {
    saveStore();
  }
  res.type('html').send(
    newRiskReportPreviewPage(user, ticket, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: supervisorStats(user.username),
      showUploadToast: req.query.flash === 'evidence_uploaded',
      revisionBlocked: REPORTER_REVISION_STATUSES.includes(ticket.status) && !hasRevisionSinceReturn(ticket),
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
  markTicketNotificationsRead(req.session.user, req.params.ref);
  res.type('html').send(
    ticketFormPage(user, ticket, {
      mode: 'view',
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: supervisorStats(user.username),
    }),
  );
}));

app.post('/supervisor/tickets', requireSupervisor, asyncRoute(async (req, res) => {
  const user = req.session.user;
  const result = await createTicket(user.username, user.displayName, req.body, {
    reporterDepartment: user.department,
  });
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

app.get('/supervisor/drafts', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    filteredTicketsPage(user, listTicketsForSupervisor(user.username), flashFromQuery(req.query), {
      filter: 'draft',
      title: 'Draft reports',
      desc: 'Reports saved but not yet submitted. Edit or delete drafts before submission.',
      activeNav: 'drafts',
      stats: supervisorStats(user.username),
    }),
  );
});

app.get('/supervisor/submitted', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    filteredTicketsPage(user, listTicketsForSupervisor(user.username), flashFromQuery(req.query), {
      filter: 'submitted',
      title: 'Submitted reports',
      desc: 'Tickets submitted for AI analysis and automatic routing to the responsible department.',
      activeNav: 'submitted',
      stats: supervisorStats(user.username),
    }),
  );
});

app.get('/supervisor/returned', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    filteredTicketsPage(user, listTicketsForSupervisor(user.username), flashFromQuery(req.query), {
      filter: 'returned',
      title: 'Returned reports',
      desc: 'Reports returned by the Risk Management Unit or responsible department for revision and resubmission.',
      activeNav: 'returned',
      stats: supervisorStats(user.username),
    }),
  );
});

app.get('/supervisor/profile', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    reporterProfilePage(user, flashFromQuery(req.query), supervisorStats(user.username)),
  );
});

app.get('/supervisor/notifications', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    reporterNotificationsPage(
      user,
      layoutNotifications(user, 50),
      flashFromQuery(req.query),
      supervisorStats(user.username),
    ),
  );
});

app.post('/supervisor/notifications/read-all', requireSupervisor, (req, res) => {
  markNotificationsReadForUser(req.session.user);
  return res.redirect('/supervisor/notifications?flash=notifications_read');
});

app.post('/supervisor/tickets/:ref/comment', requireSupervisor, (req, res) => {
  const ref = req.params.ref;
  const result = addReporterThreadComment(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/supervisor/tickets/${ref}?flash=comment_posted`);
});

app.post('/supervisor/tickets/:ref/comment/edit', requireSupervisor, (req, res) => {
  const ref = req.params.ref;
  const result = editThreadComment(ref, req.session.user, req.body, {
    ticketGetter: (r, u) => getTicketByRef(r, u.username),
  });
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/supervisor/tickets/${ref}?flash=comment_posted`);
});

app.post('/supervisor/tickets/:ref/comment/react', requireSupervisor, (req, res) => {
  const ref = req.params.ref;
  const result = toggleThreadReaction(ref, req.session.user, req.body, {
    ticketGetter: (r, u) => getTicketByRef(r, u.username),
  });
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/supervisor/tickets/${ref}#comment-${encodeURIComponent(req.body.commentId || '')}`);
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

/* —— Department Head / Vice President —— */

function deptNoCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  return next();
}

app.use('/dept', deptNoCache);

function deptStats(user) {
  return getDeptHeadStats(user);
}

app.get('/dept', requireDeptHead, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    deptHeadOverviewPage(user, deptStats(user), flashFromQuery(req.query), listTicketsForDeptHead(user)),
  );
});

app.get('/dept/inbox', requireDeptHead, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    deptHeadInboxPage(user, listDeptHeadInbox(user), flashFromQuery(req.query), {
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: deptStats(user),
    }),
  );
});

app.get('/dept/active', requireDeptHead, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    deptHeadActivePage(user, listDeptHeadActive(user), flashFromQuery(req.query), {
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: deptStats(user),
    }),
  );
});

app.get('/dept/tickets', requireDeptHead, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    deptHeadAllTicketsPage(user, listTicketsForDeptHead(user), flashFromQuery(req.query), {
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: deptStats(user),
    }),
  );
});

app.get('/dept/tickets/:ref', requireDeptHead, asyncRoute(async (req, res) => {
  const user = req.session.user;
  markTicketNotificationsRead(user, req.params.ref);
  const raw = getTicketByRefForDeptHead(req.params.ref, user);
  if (!raw) {
    return res.redirect('/dept/tickets?flash=not_found');
  }
  const ticket = await ticketForRole(raw, 'dept_head');
  res.type('html').send(
    renderDeptHeadTicketPage(user, ticket, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: deptStats(user),
    }),
  );
}));

app.get('/dept/attachments/:id', requireDeptHead, asyncRoute(async (req, res) => {
  const found = await findAttachmentForDeptHead(req.params.id, req.session.user);
  await sendAttachment(res, found);
}));

app.post('/dept/tickets/:ref/accept', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = acceptOwnership(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}?flash=ownership_accepted`);
});

app.post('/dept/tickets/:ref/reject', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = rejectOwnership(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/dept/inbox?flash=ownership_rejected');
});

app.post('/dept/tickets/:ref/reassign', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = reassignTicket(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/dept/inbox?flash=ticket_reassigned');
});

app.post('/dept/tickets/:ref/action-plan', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = saveActionPlan(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}?flash=${result.flashKey || 'action_plan_saved'}`);
});

app.post('/dept/tickets/:ref/personnel', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = assignPersonnel(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}?flash=personnel_assigned`);
});

app.post('/dept/tickets/:ref/documents', requireDeptHead, handleEvidenceUpload, asyncRoute(async (req, res) => {
  const ref = req.params.ref;
  if (req.uploadError) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(req.uploadError)}`);
  }
  const result = await uploadDeptDocuments(ref, req.session.user, { uploadedFiles: req.files });
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}?flash=documents_uploaded_dept`);
}));

app.post('/dept/tickets/:ref/progress', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = addProgressUpdate(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}?flash=progress_submitted`);
});

app.post('/dept/tickets/:ref/resolution', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = submitFinalResolution(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}?flash=${result.flashKey || 'resolution_submitted'}`);
});

app.post('/dept/tickets/:ref/comment', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = addDeptHeadThreadComment(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}?flash=dept_comment_posted`);
});

app.post('/dept/tickets/:ref/comment/edit', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = editThreadComment(ref, req.session.user, req.body, {
    ticketGetter: (r, u) => getTicketByRefForDeptHead(r, u),
  });
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}?flash=dept_comment_posted`);
});

app.post('/dept/tickets/:ref/comment/react', requireDeptHead, (req, res) => {
  const ref = req.params.ref;
  const result = toggleThreadReaction(ref, req.session.user, req.body, {
    ticketGetter: (r, u) => getTicketByRefForDeptHead(r, u),
  });
  if (result.error) {
    return res.redirect(`/dept/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/dept/tickets/${ref}#comment-${encodeURIComponent(req.body.commentId || '')}`);
});

app.post('/dept/notifications/read-all', requireDeptHead, (req, res) => {
  markNotificationsReadForUser(req.session.user);
  const back = typeof req.headers.referer === 'string' ? req.headers.referer : '/dept';
  return res.redirect(back);
});

/* —— Risk Governance Office (RMU) —— */

function officerNoCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (req.session?.user?.username) {
    refreshSessionUser(req, req.session.user.username);
  }
  return next();
}

app.use('/officer', officerNoCache);

app.get('/officer', requireRmOfficer, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    officerOverviewPage(user, getOfficerDashboardData(), flashFromQuery(req.query)),
  );
});

app.get('/officer/ai-review', requireRmOfficer, (req, res) => {
  return res.redirect('/officer/tickets');
});

app.get('/officer/review', requireRmOfficer, (req, res) => {
  return res.redirect('/officer/tickets');
});

app.get('/officer/action-plans', requireRmOfficer, (req, res) => {
  res.type('html').send(
    finalValidationQueuePage(
      req.session.user,
      listRmuActionPlanQueue(),
      flashFromQuery(req.query),
      {
        error: req.query.error ? decodeURIComponent(req.query.error) : null,
        stats: getOfficerStats(),
      },
    ),
  );
});

app.get('/officer/final-validation', requireRmOfficer, (req, res) => {
  return res.redirect('/officer/action-plans');
});

app.get('/officer/overdue', requireRmOfficer, (req, res) => {
  res.type('html').send(
    overdueQueuePage(
      req.session.user,
      listRmuOverdueQueue(),
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
  const ref = req.params.ref;
  markTicketNotificationsRead(req.session.user, ref);
  const raw = getTicketByRefForOfficer(ref);
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

app.post('/officer/tickets/:ref/thread-comment', requireRmOfficer, (req, res) => {
  const ref = req.params.ref;
  const result = addRmuThreadComment(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/officer/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/officer/tickets/${ref}?flash=rmu_thread_comment`);
});

app.post('/officer/notifications/read-all', requireRmOfficer, (req, res) => {
  markNotificationsReadForUser(req.session.user);
  const back = typeof req.headers.referer === 'string' ? req.headers.referer : '/officer';
  return res.redirect(back);
});

/* —— Compliance Officer (routes retain /audit and requireAuditOfficer for compatibility) —— */

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
  const ref = req.params.ref;
  markTicketNotificationsRead(req.session.user, ref);
  const raw = getTicketByRefForAudit(ref);
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

app.post('/audit/notifications/read-all', requireAuditOfficer, (req, res) => {
  markNotificationsReadForUser(req.session.user);
  const back = typeof req.headers.referer === 'string' ? req.headers.referer : '/audit';
  return res.redirect(back);
});

/* —— Executive Committee (view only) —— */

app.get('/executive', requireExecutive, (req, res) => {
  res.type('html').send(
    executiveOverviewPage(
      req.session.user,
      getExecutiveDashboardData(),
      flashFromQuery(req.query),
    ),
  );
});

app.get('/executive/heatmap', requireExecutive, (req, res) => {
  res.type('html').send(
    executiveHeatmapPage(req.session.user, getExecutiveDashboardData(), flashFromQuery(req.query)),
  );
});

app.get('/executive/register', requireExecutive, (req, res) => {
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

app.get('/executive/reports', requireExecutive, (req, res) => {
  res.type('html').send(
    executiveReportsPage(req.session.user, getExecutiveDashboardData(), flashFromQuery(req.query)),
  );
});

app.get('/executive/trends', requireExecutive, (req, res) => {
  res.type('html').send(
    executiveTrendsPage(req.session.user, getExecutiveDashboardData(), flashFromQuery(req.query)),
  );
});

app.get('/executive/statistics', requireExecutive, (req, res) => {
  res.type('html').send(
    executiveStatisticsPage(req.session.user, getExecutiveDashboardData(), flashFromQuery(req.query)),
  );
});

app.get('/executive/departments', requireExecutive, (req, res) => {
  res.type('html').send(
    executiveDepartmentPerformancePage(req.session.user, getExecutiveDashboardData(), flashFromQuery(req.query)),
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
  const q = new URLSearchParams(req.query).toString();
  return res.redirect(`/executive/register${q ? `?${q}` : ''}`);
});

app.get('/executive/tickets/:ref', requireExecutive, asyncRoute(async (req, res) => {
  const ref = req.params.ref;
  markTicketNotificationsRead(req.session.user, ref);
  const raw = getTicketByRefForExecutive(ref);
  if (!raw) {
    return res.redirect('/executive/register?flash=not_found');
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

app.post('/executive/notifications/read-all', requireExecutive, (req, res) => {
  markNotificationsReadForUser(req.session.user);
  const back = typeof req.headers.referer === 'string' ? req.headers.referer : '/executive';
  return res.redirect(back);
});

/* —— President —— */

app.get('/president', requirePresident, (req, res) => {
  res.type('html').send(
    presidentOverviewPage(
      req.session.user,
      getPresidentStats(),
      flashFromQuery(req.query),
    ),
  );
});

app.get('/president/pending', requirePresident, (req, res) => {
  const stats = getPresidentStats();
  const tickets = listPresidentPendingQueue();
  res.type('html').send(
    pendingQueuePage(req.session.user, tickets, flashFromQuery(req.query), stats),
  );
});

app.get('/president/high', requirePresident, (req, res) => {
  const stats = getPresidentStats();
  const tickets = listTicketsForPresident({ level: 'high' });
  res.type('html').send(
    highTicketsPage(req.session.user, tickets, flashFromQuery(req.query), stats),
  );
});

app.get('/president/critical', requirePresident, (req, res) => {
  const stats = getPresidentStats();
  const tickets = listTicketsForPresident({ level: 'critical' });
  res.type('html').send(
    presidentCriticalTicketsPage(req.session.user, tickets, flashFromQuery(req.query), stats),
  );
});

app.get('/president/tickets/:ref', requirePresident, asyncRoute(async (req, res) => {
  const ref = req.params.ref;
  markTicketNotificationsRead(req.session.user, ref);
  const raw = getTicketByRefForPresident(ref);
  if (!raw) {
    return res.redirect('/president/pending?flash=not_found');
  }
  const ticket = await ticketForRole(raw, 'president');
  res.type('html').send(
    presidentTicketDetailPage(req.session.user, ticket, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      stats: getPresidentStats(),
    }),
  );
}));

app.post('/president/tickets/:ref/decision', requirePresident, (req, res) => {
  const ref = req.params.ref;
  const result = recordPresidentDecision(ref, req.session.user, req.body);
  if (result.error) {
    return res.redirect(`/president/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/president/tickets/${ref}?flash=${result.flashKey || 'president_approve'}`);
});

app.get('/president/attachments/:id', requirePresident, asyncRoute(async (req, res) => {
  const found = await findAttachmentForPresident(req.params.id);
  await sendAttachment(res, found);
}));

app.post('/president/notifications/read-all', requirePresident, (req, res) => {
  markNotificationsReadForUser(req.session.user);
  const back = typeof req.headers.referer === 'string' ? req.headers.referer : '/president';
  return res.redirect(back);
});

/* —— System Administrator —— */

function adminError(res, path, message) {
  return res.redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function filterUsers(users, query) {
  let result = users;
  if (query.q) {
    const q = String(query.q).toLowerCase();
    result = result.filter(
      (u) =>
        u.username.toLowerCase().includes(q)
        || u.displayName.toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.employeeId || '').toLowerCase().includes(q),
    );
  }
  if (query.role) result = result.filter((u) => u.role === query.role);
  if (query.status) result = result.filter((u) => u.status === query.status);
  if (query.filter === 'active') result = result.filter((u) => u.status === 'active');
  return result;
}

app.get('/admin', requireAdmin, (req, res) => {
  const ticketStats = getAdminTicketStats();
  const data = getAdminDashboardData(ticketStats);
  res.type('html').send(adminOverviewPage(req.session.user, data, flashFromQuery(req.query)));
});

app.get('/admin/profile', requireAdmin, (req, res) => {
  const record = findUserRecord(req.session.user.username);
  const profile = record ? { ...req.session.user, ...require('./lib/store').publicUser(record) } : req.session.user;
  res.type('html').send(profilePage(profile, flashFromQuery(req.query)));
});

app.get('/admin/users', requireAdmin, (req, res) => {
  const users = filterUsers(listUsers({ includeInactive: true }), req.query);
  res.type('html').send(
    usersPage(
      req.session.user,
      users,
      listDepartments(),
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
      { filters: req.query },
    ),
  );
});

app.get('/admin/users/:username/edit', requireAdmin, (req, res) => {
  const editUser = findUserRecord(req.params.username.toLowerCase(), { includeInactive: true });
  if (!editUser) return res.redirect('/admin/users?flash=not_found');
  res.type('html').send(
    usersPage(
      req.session.user,
      listUsers({ includeInactive: true }),
      listDepartments(),
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
      { editUser, filters: req.query },
    ),
  );
});

app.post('/admin/users', requireAdmin, (req, res) => {
  const { username, password, displayName, role, employeeId, email, department, position, confirmPassword } = req.body;
  if (!isAssignableRole(role)) return adminError(res, '/admin/users', 'Invalid role selected.');
  const result = createUser({
    username,
    password,
    displayName,
    role,
    employeeId,
    email,
    department,
    position,
    confirmPassword,
  });
  if (result.error) return adminError(res, '/admin/users', result.error);
  logCredential(req, {
    action: 'account_created',
    username: result.user.username,
    actor: req.session.user.username,
    detail: `Created account with role ${result.user.roleLabel}`,
    success: true,
  });
  logAdminAction(req, {
    action: 'user_created',
    module: 'User Management',
    description: `Created account: ${result.user.displayName} (${result.user.username})`,
    targetUser: result.user.username,
  });
  notifyAdmin({
    type: 'user_created',
    title: 'New user created',
    message: `${result.user.displayName} was added to the system.`,
  });
  return res.redirect('/admin/users?flash=created');
});

app.post('/admin/users/:username/edit', requireAdmin, (req, res) => {
  const username = req.params.username.toLowerCase();
  const { displayName, email, employeeId, department, position, role, status } = req.body;
  const result = updateUser(username, { displayName, email, employeeId, department, position, role });
  if (result.error) return adminError(res, `/admin/users/${username}/edit`, result.error);
  if (status && username !== 'admin') {
    const statusResult = setUserStatus(username, status === 'active');
    if (statusResult.error) return adminError(res, `/admin/users/${username}/edit`, statusResult.error);
  }
  logAdminAction(req, {
    action: 'user_updated',
    module: 'User Management',
    description: `Updated account: ${result.user.displayName}`,
    targetUser: username,
  });
  return res.redirect('/admin/users?flash=updated');
});

app.post('/admin/users/:username/delete', requireAdmin, (req, res) => {
  const username = req.params.username.toLowerCase();
  const result = deleteUser(username);
  if (result.error) return adminError(res, '/admin/users', result.error);
  logCredential(req, {
    action: 'account_deleted',
    username,
    actor: req.session.user.username,
    detail: `Deleted account (${result.user.roleLabel})`,
    success: true,
  });
  logAdminAction(req, {
    action: 'user_deleted',
    module: 'User Management',
    description: `Deleted account: ${result.user.displayName}`,
    targetUser: username,
  });
  return res.redirect('/admin/users?flash=deleted');
});

app.post('/admin/users/:username/activate', requireAdmin, (req, res) => {
  const username = req.params.username.toLowerCase();
  const result = setUserStatus(username, true);
  if (result.error) return adminError(res, '/admin/users', result.error);
  logAdminAction(req, {
    action: 'user_activated',
    module: 'User Management',
    description: `Activated account: ${result.user.displayName}`,
    targetUser: username,
  });
  return res.redirect('/admin/users?flash=activated');
});

app.post('/admin/users/:username/deactivate', requireAdmin, (req, res) => {
  const username = req.params.username.toLowerCase();
  const result = setUserStatus(username, false);
  if (result.error) return adminError(res, '/admin/users', result.error);
  logAdminAction(req, {
    action: 'user_deactivated',
    module: 'User Management',
    description: `Deactivated account: ${result.user.displayName}`,
    targetUser: username,
  });
  return res.redirect('/admin/users?flash=deactivated');
});

app.get('/admin/users/:username/reset-password', requireAdmin, (req, res) => {
  const target = findUserRecord(req.params.username.toLowerCase());
  if (!target) return res.redirect('/admin/users?flash=not_found');
  res.type('html').send(
    resetPasswordPage(
      req.session.user,
      target,
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
    ),
  );
});

app.post('/admin/users/:username/reset-password', requireAdmin, (req, res) => {
  const username = req.params.username.toLowerCase();
  if (req.body.mode === 'prompt') {
    return res.redirect(`/admin/users/${username}/reset-password`);
  }
  const { password, confirmPassword } = req.body;
  const result = resetUserPassword(username, password, confirmPassword);
  if (result.error) return adminError(res, `/admin/users/${username}/reset-password`, result.error);
  logAdminAction(req, {
    action: 'password_reset',
    module: 'User Management',
    description: `Reset password for: ${result.user.displayName}`,
    targetUser: username,
  });
  return res.redirect('/admin/users?flash=password_reset');
});

app.get('/admin/departments', requireAdmin, (req, res) => {
  res.type('html').send(
    departmentsPage(
      req.session.user,
      listDepartments(),
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
      { showAdd: req.query.action === 'add' },
    ),
  );
});

app.get('/admin/departments/:id/edit', requireAdmin, (req, res) => {
  const editDept = findDepartment(req.params.id);
  if (!editDept) return res.redirect('/admin/departments?flash=not_found');
  res.type('html').send(
    departmentsPage(
      req.session.user,
      listDepartments(),
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
      { editDept },
    ),
  );
});

app.post('/admin/departments', requireAdmin, (req, res) => {
  const result = createDepartment(req.body);
  if (result.error) return adminError(res, '/admin/departments', result.error);
  logAdminAction(req, {
    action: 'department_created',
    module: 'Department Management',
    description: `Added department: ${result.department.name}`,
  });
  notifyAdmin({ type: 'department_added', title: 'Department added', message: result.department.name });
  return res.redirect('/admin/departments?flash=created');
});

app.post('/admin/departments/:id/edit', requireAdmin, (req, res) => {
  const result = updateDepartment(req.params.id, req.body);
  if (result.error) return adminError(res, `/admin/departments/${req.params.id}/edit`, result.error);
  logAdminAction(req, {
    action: 'department_updated',
    module: 'Department Management',
    description: `Updated department: ${result.department.name}`,
  });
  return res.redirect('/admin/departments?flash=updated');
});

app.post('/admin/departments/:id/delete', requireAdmin, (req, res) => {
  const dept = findDepartment(req.params.id);
  const result = deleteDepartment(req.params.id);
  if (result.error) return adminError(res, '/admin/departments', result.error);
  logAdminAction(req, {
    action: 'department_deleted',
    module: 'Department Management',
    description: `Deleted department: ${dept?.name || req.params.id}`,
  });
  return res.redirect('/admin/departments?flash=deleted');
});

app.get('/admin/positions', requireAdmin, (req, res) => {
  res.type('html').send(
    positionsPage(
      req.session.user,
      listPositions(),
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
      { showAdd: req.query.action === 'add' },
    ),
  );
});

app.get('/admin/positions/:id/edit', requireAdmin, (req, res) => {
  const positions = listPositions();
  const editPos = positions.find((p) => p.id === req.params.id);
  if (!editPos) return res.redirect('/admin/positions?flash=not_found');
  res.type('html').send(
    positionsPage(
      req.session.user,
      positions,
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
      { editPos },
    ),
  );
});

app.post('/admin/positions', requireAdmin, (req, res) => {
  const result = createPosition(req.body.name);
  if (result.error) return adminError(res, '/admin/positions', result.error);
  logAdminAction(req, {
    action: 'position_created',
    module: 'Position Management',
    description: `Added position: ${result.position.name}`,
  });
  return res.redirect('/admin/positions?flash=created');
});

app.post('/admin/positions/:id/edit', requireAdmin, (req, res) => {
  const result = updatePosition(req.params.id, req.body.name);
  if (result.error) return adminError(res, `/admin/positions/${req.params.id}/edit`, result.error);
  logAdminAction(req, {
    action: 'position_updated',
    module: 'Position Management',
    description: `Updated position: ${result.position.name}`,
  });
  return res.redirect('/admin/positions?flash=updated');
});

app.post('/admin/positions/:id/delete', requireAdmin, (req, res) => {
  const positions = listPositions();
  const pos = positions.find((p) => p.id === req.params.id);
  const result = deletePosition(req.params.id);
  if (result.error) return adminError(res, '/admin/positions', result.error);
  logAdminAction(req, {
    action: 'position_deleted',
    module: 'Position Management',
    description: `Deleted position: ${pos?.name || req.params.id}`,
  });
  return res.redirect('/admin/positions?flash=deleted');
});

app.get('/admin/tickets', requireAdmin, (req, res) => {
  let status = req.query.status;
  if (status === 'open') status = '';
  const filters = {
    q: req.query.q,
    department: req.query.department,
    level: req.query.level,
    status: status === 'closed' ? 'closed' : status,
    deleted: req.query.deleted === '1',
  };
  let tickets = listTicketsForAdmin({
    department: filters.department,
    level: filters.level,
    status: filters.status,
    search: filters.q,
    deletedOnly: filters.deleted,
  });
  if (filters.status === 'closed') {
    tickets = tickets.filter((t) => ['closed', 'resolved'].includes(t.status));
  } else if (req.query.status === 'open') {
    tickets = tickets.filter((t) => !['closed', 'resolved'].includes(t.status));
  }
  res.type('html').send(
    ticketsPage(
      req.session.user,
      tickets,
      listDepartments(),
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
      filters,
    ),
  );
});

app.get('/admin/tickets/:ref', requireAdmin, (req, res) => {
  const ticket = getTicketByRefForAdmin(req.params.ref);
  if (!ticket) return res.redirect('/admin/tickets?flash=not_found');
  const pub = publicTicket(ticket);
  pub.riskLevel = ticketRiskLevelId(ticket);
  pub.deleted = Boolean(ticket.deleted);
  pub.deletionReason = ticket.deletionReason;
  res.type('html').send(ticketDetailPage(req.session.user, pub, flashFromQuery(req.query)));
});

app.post('/admin/tickets/:ref/delete', requireAdmin, (req, res) => {
  const result = softDeleteTicketForAdmin(req.params.ref, req.session.user, req.body.reason);
  if (result.error) return adminError(res, '/admin/tickets', result.error);
  logAdminAction(req, {
    action: 'ticket_deleted',
    module: 'Ticket Management',
    description: `Soft-deleted ticket ${req.params.ref}: ${req.body.reason}`,
  });
  notifyAdmin({
    type: 'ticket_deleted',
    title: 'Ticket deleted',
    message: `Ticket ${req.params.ref} was soft-deleted.`,
  });
  return res.redirect('/admin/tickets?flash=ticket_deleted');
});

app.get('/admin/audit-logs', requireAdmin, (req, res) => {
  const filters = {
    q: req.query.q,
    date: req.query.date,
    user: req.query.user,
    action: req.query.action,
    module: req.query.module,
  };
  const logs = getAuditLogs({ limit: 300, filters });
  const options = getAuditLogFilterOptions();
  res.type('html').send(auditLogsPage(req.session.user, logs, flashFromQuery(req.query), filters, options));
});

app.get('/admin/audit-logs/export', requireAdmin, (req, res) => {
  const filters = {
    q: req.query.q,
    date: req.query.date,
    user: req.query.user,
    action: req.query.action,
    module: req.query.module,
  };
  const logs = getAuditLogs({ limit: 1000, filters });
  const header = 'Date,User,Role,Action,Module,Description,IP,Device,Browser\n';
  const rows = logs
    .map((l) =>
      [l.at, l.username, l.roleLabel, l.action, l.module, l.description, l.ip, l.device, l.browser]
        .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
  res.send(header + rows);
});

app.get('/admin/settings', requireAdmin, (req, res) => {
  res.type('html').send(
    settingsPage(
      req.session.user,
      getSystemSettings(),
      flashFromQuery(req.query),
      req.query.error ? decodeURIComponent(req.query.error) : null,
    ),
  );
});

app.post('/admin/settings', requireAdmin, (req, res) => {
  const body = req.body;
  const fields = {
    systemName: body.systemName,
    organizationName: body.organizationName,
    themeColor: body.themeColor,
    ticketNumberFormat: body.ticketNumberFormat,
    defaultRiskLevels: String(body.defaultRiskLevels || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    emailNotifications: body.emailNotifications === '1',
    passwordMinLength: Number(body.passwordMinLength) || 8,
    sessionTimeoutMinutes: Number(body.sessionTimeoutMinutes) || 480,
    mfaEnabled: body.mfaEnabled === '1',
    maxUploadSizeMb: Number(body.maxUploadSizeMb) || 25,
    allowedFileTypes: String(body.allowedFileTypes || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    maintenanceMode: body.maintenanceMode === '1',
    backupEnabled: body.backupEnabled === '1',
    backupFrequency: body.backupFrequency || 'daily',
  };
  updateSystemSettings(fields);
  logAdminAction(req, {
    action: 'settings_updated',
    module: 'System Settings',
    description: 'System settings were updated',
  });
  return res.redirect('/admin/settings?flash=settings_saved');
});

/* Legacy admin routes → redirect */
app.get('/admin/accounts', requireAdmin, (_req, res) => res.redirect('/admin/users'));
app.get('/admin/logs/credentials', requireAdmin, (_req, res) => res.redirect('/admin/audit-logs'));
app.get('/admin/logs/reports', requireAdmin, (_req, res) => res.redirect('/admin/tickets'));

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
