// Sends email over SMTP (any provider: Brevo, Resend, Mailgun, Google Workspace, your own server).
// With no SMTP_HOST set, emails are saved to DATA_DIR/outbox as .html/.txt files so you can see them.
import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';

export function createMailer(cfg, { transport } = {}) {
  const outbox = path.join(cfg.dataDir, 'outbox');
  const mode = transport ? 'custom' : cfg.smtp ? 'smtp' : 'outbox';
  const tx = transport || (cfg.smtp
    ? nodemailer.createTransport({ ...cfg.smtp, pool: true, maxConnections: 2 })
    : nodemailer.createTransport({ jsonTransport: true }));

  return {
    mode,
    from: cfg.mailFrom,
    async send({ to, subject, html, text, headers }) {
      const msg = { from: cfg.mailFrom, to, subject, html, text, headers };
      if (cfg.mailReplyTo) msg.replyTo = cfg.mailReplyTo;
      const info = await tx.sendMail(msg);
      if (mode === 'outbox') {
        fs.mkdirSync(outbox, { recursive: true });
        const base = path.join(outbox, new Date().toISOString().replace(/[:.]/g, '-') + '_' + String(to).replace(/[^\w@.-]/g, '_'));
        fs.writeFileSync(base + '.html', html || '');
        fs.writeFileSync(base + '.txt', `To: ${to}\nSubject: ${subject}\n${Object.entries(headers || {}).map(([k, v]) => k + ': ' + v).join('\n')}\n\n${text || ''}`);
        console.log('[mail] saved to outbox:', path.relative(process.cwd(), base) + '.html');
      }
      return info;
    },
    async verify() { if (mode === 'smtp') await tx.verify(); return true; },
  };
}
