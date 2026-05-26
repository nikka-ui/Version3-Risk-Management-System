const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const { authenticate, requireAuth, requireAdmin, requireSupervisor, sessionUser } = require('./lib/auth');
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
} = require('./lib/tickets');
const { logCredential } = require('./lib/logger');
const { handleEvidenceUpload } = require('./lib/upload');
const {
  listUsers,
  createUser,
  updateUserRole,
  deleteUser,
  getCredentialLogs,
  getReportLogs,
  loadStore,
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
    not_found: 'Ticket not found.',
    invalid: null,
  };
  return map[query.flash] || null;
}

function dashboardPath(user) {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'supervisor') return '/supervisor';
  return '/dashboard';
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
  res.redirect('/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
  if (req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }
  if (req.session.user.role === 'supervisor') {
    return res.redirect('/supervisor');
  }
  res.type('html').send(dashboardPage(req.session.user));
});

/* —— Department Supervisor —— */

const isDev = process.env.NODE_ENV !== 'production';

app.get('/supervisor', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    supervisorOverviewPage(user, getSupervisorStats(user.username), flashFromQuery(req.query)),
  );
});

app.get('/supervisor/tickets', requireSupervisor, (req, res) => {
  const user = req.session.user;
  res.type('html').send(
    ticketsListPage(user, listTicketsForSupervisor(user.username), flashFromQuery(req.query), {
      filter: req.query.filter,
      error: req.query.error,
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
    }),
  );
});

// Step 1 -> Step 2 (AI preview)
app.post('/supervisor/tickets/new/preview', requireSupervisor, handleEvidenceUpload, (req, res) => {
  const user = req.session.user;
  if (req.uploadError) {
    return res.redirect(`/supervisor/tickets/new?error=${encodeURIComponent(req.uploadError)}`);
  }
  const referenceOverride = req.body.referenceOverride;

  const result = createTicket(user.username, user.displayName, req.body, {
    referenceOverride,
    uploadedFiles: req.files,
  });

  if (result.error) {
    return res.redirect(`/supervisor/tickets/new?error=${encodeURIComponent(result.error)}`);
  }

  return res.redirect(`/supervisor/tickets/new/preview/${result.ticket.reference}?flash=preview_generated`);
});

app.get('/supervisor/tickets/:ref/edit', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const ticket = getTicketByRef(req.params.ref, user.username);
  if (!ticket || !canSupervisorDraftCrud(ticket)) {
    return res.redirect('/supervisor/tickets?error=' + encodeURIComponent('Only draft tickets can be edited.'));
  }
  return res.type('html').send(
    newRiskReportStep1Page(user, ticket.reference, {
      mode: 'edit',
      ticket,
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
    }),
  );
});

app.post('/supervisor/tickets/:ref/edit', requireSupervisor, handleEvidenceUpload, (req, res) => {
  const user = req.session.user;
  const ref = req.params.ref;
  if (req.uploadError) {
    return res.redirect(`/supervisor/tickets/${ref}/edit?error=${encodeURIComponent(req.uploadError)}`);
  }
  const result = updateTicketDraft(ref, user.username, req.body, { uploadedFiles: req.files });
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}/edit?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/supervisor/tickets/new/preview/${ref}?flash=draft_updated`);
});

app.post('/supervisor/tickets/:ref/delete', requireSupervisor, (req, res) => {
  const result = deleteDraftTicket(req.params.ref, req.session.user.username);
  if (result.error) {
    return res.redirect('/supervisor/tickets?error=' + encodeURIComponent(result.error));
  }
  return res.redirect('/supervisor/tickets?flash=draft_deleted');
});

app.get('/supervisor/attachments/:id', requireSupervisor, (req, res) => {
  const found = findAttachmentForUser(req.params.id, req.session.user.username);
  if (!found?.attachment?.storageKey) {
    return res.status(404).send('Attachment not found.');
  }
  const { readFileStream } = require('./lib/attachments');
  const file = readFileStream(found.attachment.storageKey);
  if (!file) return res.status(404).send('File not found on disk.');
  res.setHeader('Content-Type', found.attachment.mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(found.attachment.originalName || found.attachment.name)}"`,
  );
  file.stream.pipe(res);
});

app.get('/supervisor/tickets/new/preview/:ref', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const ticket = getTicketByRef(req.params.ref, user.username);
  if (!ticket) {
    return res.redirect('/supervisor/tickets/new?flash=not_found');
  }
  res.type('html').send(
    newRiskReportPreviewPage(user, ticket, {
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
    }),
  );
});

app.post('/supervisor/tickets/new/preview/:ref/save', requireSupervisor, (req, res) => {
  // Draft was already created during NEXT; nothing else to save in the placeholder build.
  return res.redirect(`/supervisor/tickets?flash=draft_saved`);
});

app.post('/supervisor/tickets/new/preview/:ref/submit', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const ref = req.params.ref;

  // Server-side guard: prevent submit if confirmation checkbox wasn't checked.
  if (!req.body.confirmBox) {
    const ticket = getTicketByRef(ref, user.username);
    return res.redirect(`/supervisor/tickets/new/preview/${encodeURIComponent(ref)}?error=${encodeURIComponent('Please confirm the information is accurate.')}`);
  }

  const sub = submitTicket(ref, user.username, user.displayName);
  if (sub.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(sub.error)}`);
  }
  return res.redirect(`/supervisor/tickets/${ref}?flash=submitted`);
});

app.get('/supervisor/tickets/:ref', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const ticket = getTicketByRef(req.params.ref, user.username);
  if (!ticket) {
    return res.redirect('/supervisor/tickets?flash=not_found');
  }
  res.type('html').send(
    ticketFormPage(user, ticket, {
      mode: 'view',
      flash: flashFromQuery(req.query),
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      devMode: isDev,
    }),
  );
});

app.post('/supervisor/tickets', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const result = createTicket(user.username, user.displayName, req.body);
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
});

app.post('/supervisor/tickets/:ref', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const ref = req.params.ref;
  const result = updateTicketDraft(ref, user.username, req.body);
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
});

app.post('/supervisor/tickets/:ref/evidence', requireSupervisor, (req, res) => {
  const ref = req.params.ref;
  const result = addEvidence(ref, req.session.user.username, req.body);
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect(`/supervisor/tickets/${ref}?flash=evidence_added`);
});

app.post('/supervisor/tickets/:ref/accomplishment', requireSupervisor, (req, res) => {
  const user = req.session.user;
  const ref = req.params.ref;
  const result = submitAccomplishment(ref, user.username, user.displayName, req.body);
  if (result.error) {
    return res.redirect(`/supervisor/tickets/${ref}?error=${encodeURIComponent(result.error)}`);
  }
  return res.redirect('/supervisor/accomplishments?flash=accomplishment_submitted');
});

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
  res.type('html').send(
    actionsPage(req.session.user, listActionTickets(req.session.user.username), flashFromQuery(req.query)),
  );
});

app.get('/supervisor/accomplishments', requireSupervisor, (req, res) => {
  res.type('html').send(
    accomplishmentsPage(
      req.session.user,
      listAccomplishments(req.session.user.username),
      flashFromQuery(req.query),
    ),
  );
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

app.listen(port, '0.0.0.0', () => {
  console.log(`rms-web listening on ${port}`);
});
