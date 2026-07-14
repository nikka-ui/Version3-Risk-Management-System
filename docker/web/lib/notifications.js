const { appendNotification, getNotificationsForUser, markNotificationsReadForUser } = require('./store');
const { getRoleLabel } = require('../config/roles');
const { departmentsMatch } = require('../config/tickets');

function ticketRiskLevelId(ticket) {
  const sev = ticket?.ai?.severity
    || (ticket?.likelihood && ticket?.impact ? Math.round((ticket.likelihood + ticket.impact) / 2) : 2);
  if (sev <= 2) return 'low';
  if (sev === 3) return 'moderate';
  if (sev === 4) return 'high';
  return 'critical';
}

function isCriticalTicket(ticket) {
  return ticketRiskLevelId(ticket) === 'critical';
}

function formatDepartmentLabel(name) {
  const raw = String(name || '').trim();
  if (!raw) return '—';
  return /department$/i.test(raw) ? raw : `${raw} Department`;
}

const ROLE_TICKET_PATH = {
  supervisor: '/supervisor/tickets',
  dept_head: '/dept/tickets',
  rm_officer: '/officer/tickets',
  executive: '/executive/tickets',
  president: '/president/tickets',
};

function ticketHref(role, ticketRef) {
  const base = ROLE_TICKET_PATH[role];
  return base ? `${base}/${ticketRef}` : `/tickets/${ticketRef}`;
}

function notifyRoles(roles, payload, { excludeUsername } = {}) {
  const unique = [...new Set(roles)];
  for (const recipientRole of unique) {
    appendNotification({
      recipientRole,
      excludeAuthor: excludeUsername || null,
      ...payload,
      href: payload.href || ticketHref(recipientRole, payload.ticketRef),
    });
  }
}

function notifyUser(username, payload) {
  appendNotification({
    recipientUsername: username,
    ...payload,
    href: payload.href || ticketHref('supervisor', payload.ticketRef),
  });
}

/**
 * Notify every active Department Head / Vice President whose department matches
 * the ticket's responsible department. Falls back to a role-wide notification if
 * no matching head account exists yet.
 */
function notifyDeptHeadsForDepartment(ticket, payload) {
  const { listUsers } = require('./store');
  const heads = listUsers()
    .filter((u) => u.role === 'dept_head' && departmentsMatch(u.department, ticket.department));

  const notification = {
    ...payload,
    ticketRef: ticket.reference,
    href: payload.href || ticketHref('dept_head', ticket.reference),
    fromRole: payload.fromRole || 'supervisor',
  };

  if (heads.length) {
    for (const head of heads) {
      appendNotification({ recipientUsername: head.username, ...notification });
    }
    return;
  }

  appendNotification({ recipientRole: 'dept_head', ...notification });
}

function authorLabel(user) {
  return user.displayName || user.username;
}

function notifyExecutiveComment(ticket, user) {
  const from = authorLabel(user);
  notifyRoles(['rm_officer'], {
    type: 'executive_comment',
    title: 'Executive Committee comment',
    message: `${from} commented on ticket ${ticket.reference}`,
    ticketRef: ticket.reference,
    fromUsername: user.username,
    fromName: from,
    fromRole: user.role,
  }, { excludeUsername: user.username });
}

function notifyExecutiveReply(ticket, user) {
  const from = authorLabel(user);
  const fromRoleLabel = getRoleLabel(user.role);
  notifyRoles(['executive'], {
    type: 'executive_reply',
    title: 'Reply to your comment',
    message: `${from} (${fromRoleLabel}) replied on ticket ${ticket.reference}`,
    ticketRef: ticket.reference,
    fromUsername: user.username,
    fromName: from,
    fromRole: user.role,
  }, { excludeUsername: user.username });

  if (user.role !== 'rm_officer') {
    notifyRoles(['rm_officer'], {
      type: 'executive_reply',
      title: 'New reply on executive thread',
      message: `${from} (${fromRoleLabel}) replied to an executive comment on ${ticket.reference}`,
      ticketRef: ticket.reference,
      fromUsername: user.username,
      fromName: from,
      fromRole: user.role,
    }, { excludeUsername: user.username });
  }
}

function notifyPrivateComment(ticket, user) {
  const from = authorLabel(user);
  const fromRoleLabel = getRoleLabel(user.role);
  notifyRoles(['rm_officer'], {
    type: 'private_comment',
    title: 'New private comment',
    message: `${from} (${fromRoleLabel}) left a private comment on ${ticket.reference}`,
    ticketRef: ticket.reference,
    fromUsername: user.username,
    fromName: from,
    fromRole: user.role,
  }, { excludeUsername: user.username });
}

function notifyRmoTicketSubmitted(ticket, { username, displayName } = {}) {
  notifyRoles(['rm_officer'], {
    type: 'ticket_submitted',
    title: 'New risk ticket submitted',
    message: `${displayName || username || 'A reporter'} submitted ${ticket.reference} — routed to ${ticket.department || 'pending assignment'}.`,
    ticketRef: ticket.reference,
    fromUsername: username || ticket.submittedBy,
    fromName: displayName || ticket.submittedByName,
    fromRole: 'supervisor',
  }, { excludeUsername: username });
}

function notifyReporterTicketUpdate(ticket, { recipientUsername, type, title, message }) {
  if (!recipientUsername) return;
  notifyUser(recipientUsername, {
    type: type || 'ticket_update',
    title: title || 'Ticket update',
    message: message || `Update on ${ticket.reference}`,
    ticketRef: ticket.reference,
    href: ticketHref('supervisor', ticket.reference),
  });
}

/** Notify the ticket reporter and matching department head(s) that a ticket is past due. */
function notifyOverdueStakeholders(ticket, { dueLabel } = {}) {
  const due = dueLabel || 'the target date';
  const titleText = ticket.title || 'Risk ticket';
  const reporterName = ticket.submittedByName || ticket.submittedBy || 'the reporter';

  notifyDeptHeadsForDepartment(ticket, {
    type: 'ticket_overdue',
    title: 'Ticket past due',
    message: `${ticket.reference} — ${titleText} is past due (target: ${due}). Reporter: ${reporterName}.`,
    fromRole: 'system',
    fromName: 'System',
  });

  if (ticket.submittedBy) {
    notifyReporterTicketUpdate(ticket, {
      recipientUsername: ticket.submittedBy,
      type: 'ticket_overdue',
      title: 'Your ticket is past due',
      message: `${ticket.reference} — ${titleText} is past the mitigation target date (${due}). Please complete your action items or contact your department head.`,
    });
  }
}

/**
 * Notify workflow stakeholders for assignment, reassignment, comments, approvals,
 * returns, escalations, overdue, and closure events.
 */
function notifyWorkflowStakeholders(ticket, event, {
  actor,
  excludeUsername,
  title,
  message,
  type,
  reason,
  targetDepartment,
} = {}) {
  const from = actor ? authorLabel(actor) : 'System';
  const payload = {
    type: type || event,
    title: title || 'Ticket update',
    message: message || `Update on ${ticket.reference}`,
    ticketRef: ticket.reference,
    fromUsername: actor?.username,
    fromName: from,
    fromRole: actor?.role,
  };
  const exclude = excludeUsername || actor?.username;

  const notifyRmu = () => {
    notifyRoles(['rm_officer'], payload, { excludeUsername: exclude });
  };
  const notifyPresident = () => {
    notifyRoles(['president'], payload, { excludeUsername: exclude });
  };
  const notifyExecutiveIfCritical = () => {
    if (isCriticalTicket(ticket)) {
      notifyRoles(['executive'], payload, { excludeUsername: exclude });
    }
  };
  const notifyReporter = (customMessage) => {
    if (ticket.submittedBy) {
      notifyReporterTicketUpdate(ticket, {
        recipientUsername: ticket.submittedBy,
        type: payload.type,
        title: payload.title,
        message: customMessage || payload.message,
      });
    }
  };

  switch (event) {
    case 'assignment':
      notifyDeptHeadsForDepartment(ticket, payload);
      notifyRmu();
      notifyExecutiveIfCritical();
      notifyReporter();
      break;
    case 'reassignment': {
      const deptLabel = formatDepartmentLabel(targetDepartment || ticket.department);
      const reporterMsg = [
        'Your ticket has been reassigned.',
        '',
        reason ? `Reason:\n${reason}` : '',
        '',
        `New Department:\n${deptLabel}`,
      ].filter(Boolean).join('\n');
      notifyDeptHeadsForDepartment(ticket, {
        ...payload,
        title: title || 'Ticket reassigned to your department',
        message: message || `${ticket.reference} was reassigned to ${deptLabel}.`,
      });
      notifyRmu();
      notifyExecutiveIfCritical();
      notifyReporter(reporterMsg);
      break;
    }
    case 'comment':
      notifyDeptHeadsForDepartment(ticket, payload);
      notifyRmu();
      notifyReporter();
      break;
    case 'approval':
      notifyDeptHeadsForDepartment(ticket, payload);
      notifyRmu();
      notifyPresident();
      notifyExecutiveIfCritical();
      notifyReporter();
      break;
    case 'return':
      notifyDeptHeadsForDepartment(ticket, payload);
      notifyRmu();
      notifyReporter();
      break;
    case 'escalation':
      notifyDeptHeadsForDepartment(ticket, payload);
      notifyRmu();
      notifyPresident();
      notifyExecutiveIfCritical();
      notifyReporter();
      break;
    case 'overdue':
      notifyDeptHeadsForDepartment(ticket, payload);
      notifyRmu();
      notifyExecutiveIfCritical();
      notifyReporter();
      break;
    case 'closure':
      notifyDeptHeadsForDepartment(ticket, payload);
      notifyRmu();
      notifyPresident();
      notifyExecutiveIfCritical();
      notifyReporter();
      break;
    default:
      notifyRmu();
      notifyReporter();
  }
}

function layoutNotifications(user, limit = 15) {
  return getNotificationsForUser(user, limit);
}

function markTicketNotificationsRead(user, ticketRef) {
  if (!ticketRef) return;
  markNotificationsReadForUser(user, { ticketRef });
}

module.exports = {
  layoutNotifications,
  markTicketNotificationsRead,
  notifyExecutiveComment,
  notifyExecutiveReply,
  notifyPrivateComment,
  notifyRmoTicketSubmitted,
  notifyReporterTicketUpdate,
  notifyDeptHeadsForDepartment,
  notifyOverdueStakeholders,
  notifyWorkflowStakeholders,
  notifyRoles,
  notifyUser,
  ticketHref,
  formatDepartmentLabel,
  isCriticalTicket,
  ticketRiskLevelId,
};
