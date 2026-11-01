// All settings come from environment variables (see .env.example).
import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const bool = (v, d) => (v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(v));
const num = (v, d) => (v == null || v === '' || isNaN(+v) ? d : +v);

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const publicUrl = (env.PUBLIC_URL || `http://localhost:${num(env.PORT, 3000)}`).replace(/\/+$/, '');
  const cfg = {
    production,
    port: num(env.PORT, 3000),
    publicUrl,
    dataDir: path.resolve(ROOT, env.DATA_DIR || 'data'),
    distDir: path.resolve(ROOT, env.DIST_DIR || 'dist'),
    contentDir: path.resolve(ROOT, env.CONTENT_DIR || 'content'),
    trustProxy: env.TRUST_PROXY ? (isNaN(+env.TRUST_PROXY) ? bool(env.TRUST_PROXY, false) : +env.TRUST_PROXY) : false,
    adminPassword: env.ADMIN_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
    sessionHours: num(env.SESSION_HOURS, 12),
    smtp: env.SMTP_HOST ? {
      host: env.SMTP_HOST,
      port: num(env.SMTP_PORT, 587),
      secure: bool(env.SMTP_SECURE, num(env.SMTP_PORT, 587) === 465),
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } : undefined,
    } : null,
    mailFrom: env.MAIL_FROM || 'AROLYZER <hello@localhost>',
    mailReplyTo: env.MAIL_REPLY_TO || '',
    sendPerSecond: Math.max(0.1, num(env.SEND_PER_SECOND, 2)),
    secureCookies: bool(env.SECURE_COOKIES, publicUrl.startsWith('https://')),
  };
  if (production) {
    const missing = [];
    if (!cfg.adminPassword) missing.push('ADMIN_PASSWORD');
    if (!cfg.sessionSecret || cfg.sessionSecret.length < 32) missing.push('SESSION_SECRET (32+ characters)');
    if (!env.PUBLIC_URL) missing.push('PUBLIC_URL');
    if (missing.length) throw new Error('Missing settings for production: ' + missing.join(', '));
    if (!cfg.smtp) console.warn('[config] SMTP_HOST is not set: emails are written to data/outbox instead of being sent.');
  }
  if (!cfg.sessionSecret) cfg.sessionSecret = crypto.randomBytes(32).toString('hex'); // dev only: admin logins reset on restart
  return cfg;
}
