const crypto = require('crypto');
const { findUserRecord, resetUserPassword } = require('./store');
const { sendMail, passwordResetOtpEmail } = require('./mail');

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const pending = new Map();
const rateHits = new Map();

function hashOtp(otp) {
  const secret = process.env.SESSION_SECRET || 'rms-dev-session-change-in-production';
  return crypto.createHmac('sha256', secret).update(String(otp)).digest('hex');
}

function tooMany(key, max, windowMs) {
  const now = Date.now();
  const hits = (rateHits.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    rateHits.set(key, hits);
    return true;
  }
  hits.push(now);
  rateHits.set(key, hits);
  return false;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function requestPasswordResetOtp(username, ip) {
  const normalized = String(username || '').trim().toLowerCase();
  if (tooMany(`ip:${ip || 'unknown'}`, 5, 15 * 60 * 1000)) {
    return { error: 'Too many reset requests. Please wait a few minutes and try again.' };
  }
  if (!normalized) return { ok: true };
  if (tooMany(`user:${normalized}`, 3, 15 * 60 * 1000)) {
    return { error: 'Too many reset requests. Please wait a few minutes and try again.' };
  }

  const user = findUserRecord(normalized);
  if (!user || !isValidEmail(user.email)) {
    return { ok: true };
  }

  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  pending.set(normalized, {
    hash: hashOtp(otp),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });

  const content = passwordResetOtpEmail({
    name: user.displayName || user.username,
    otp,
    minutes: 10,
  });
  await sendMail({ to: user.email, ...content });
  return { ok: true };
}

function consumePasswordResetOtp(username, otp, password, confirmPassword) {
  const normalized = String(username || '').trim().toLowerCase();
  const code = String(otp || '').replace(/\D+/g, '');
  const record = pending.get(normalized);
  if (!record || record.expiresAt < Date.now()) {
    pending.delete(normalized);
    return { error: 'Invalid or expired code. Request a new one.' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    pending.delete(normalized);
    return { error: 'Too many incorrect codes. Request a new one.' };
  }
  if (!code || record.hash !== hashOtp(code)) {
    record.attempts += 1;
    pending.set(normalized, record);
    return { error: 'Invalid or expired code.' };
  }

  const result = resetUserPassword(normalized, password, confirmPassword);
  if (result.error) return result;
  pending.delete(normalized);
  return result;
}

module.exports = { requestPasswordResetOtp, consumePasswordResetOtp };
