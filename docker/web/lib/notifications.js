const { appendNotification, getNotificationsForUser, markNotificationsReadForUser } = require('./store');
const { getRoleLabel } = require('../config/roles');

const ROLE_TICKET_PATH = {
  rm_officer: '/officer/tickets',
  audit_officer: '/audit/tickets',
  executive: '/executive/tickets',
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

function authorLabel(user) {
  return user.displayName || user.username;
}

function notifyExecutiveComment(ticket, user) {
  const from = authorLabel(user);
  notifyRoles(['rm_officer', 'audit_officer'], {
    type: 'executive_comment',
    title: 'New executive comment',
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

  const otherRole = user.role === 'rm_officer' ? 'audit_officer' : 'rm_officer';
  notifyRoles([otherRole], {
    type: 'executive_reply',
    title: 'New reply on executive thread',
    message: `${from} (${fromRoleLabel}) replied to an executive comment on ${ticket.reference}`,
    ticketRef: ticket.reference,
    fromUsername: user.username,
    fromName: from,
    fromRole: user.role,
  }, { excludeUsername: user.username });
}

function notifyPrivateComment(ticket, user) {
  const from = authorLabel(user);
  const fromRoleLabel = getRoleLabel(user.role);
  const recipientRole = user.role === 'audit_officer' ? 'rm_officer' : 'audit_officer';
  notifyRoles([recipientRole], {
    type: 'private_comment',
    title: 'New private comment',
    message: `${from} (${fromRoleLabel}) left a private comment on ${ticket.reference}`,
    ticketRef: ticket.reference,
    fromUsername: user.username,
    fromName: from,
    fromRole: user.role,
  }, { excludeUsername: user.username });
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
  ticketHref,
};
