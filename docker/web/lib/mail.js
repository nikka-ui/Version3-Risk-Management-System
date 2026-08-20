const MAIL_HTTP_URL = process.env.MAIL_HTTP_URL || 'http://mailpit:8025';
const FROM_EMAIL = process.env.MAIL_FROM_ADDRESS || 'noreply@rms.local';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'ACCC RMS';

async function sendMail({ to, subject, text, html }) {
  const res = await fetch(`${MAIL_HTTP_URL.replace(/\/$/, '')}/api/v1/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      From: { Email: FROM_EMAIL, Name: FROM_NAME },
      To: [{ Email: to }],
      Subject: subject,
      Text: text,
      HTML: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Mail send failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

function passwordResetOtpEmail({ name, otp, minutes = 10 }) {
  const text = [
    `Hello ${name},`,
    '',
    `Use this one-time code to reset your ACCC Risk Management System password: ${otp}`,
    '',
    `This code expires in ${minutes} minutes. If you did not request a reset, you can ignore this email.`,
  ].join('\n');
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5; padding: 24px;">
  <p>Hello ${escapeHtml(name)},</p>
  <p>Use this one-time code to reset your ACCC Risk Management System password:</p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.24em; margin: 24px 0;">${escapeHtml(otp)}</p>
  <p>This code expires in ${minutes} minutes. If you did not request a reset, you can ignore this email.</p>
  <p style="color: #64748b; font-size: 13px;">ACCC Risk Management System</p>
</body>
</html>`;
  return { subject: 'Your password reset code', text, html };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendMail, passwordResetOtpEmail };
