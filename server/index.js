// Starts the AROLYZER server: API, admin and the built website on one port.
import path from 'node:path';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createContent } from './lib/content.js';
import { createMailer } from './lib/mailer.js';
import { createSender } from './lib/sender.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const db = openDb(path.join(cfg.dataDir, 'arolyzer.db'));
const content = createContent(cfg.contentDir);
const mailer = createMailer(cfg);
const sender = createSender({ db, cfg, content, mailer });
const app = createApp({ db, cfg, content, mailer, sender });

const server = app.listen(cfg.port, () => {
  console.log(`[arolyzer] listening on ${cfg.publicUrl} (port ${cfg.port})`);
  console.log(`[arolyzer] email: ${mailer.mode === 'smtp' ? 'SMTP ' + cfg.smtp.host : 'saved to ' + path.join(cfg.dataDir, 'outbox') + ' (no SMTP_HOST set)'}`);
  if (!cfg.adminPassword) console.log('[arolyzer] admin panel is off: set ADMIN_PASSWORD to turn it on');
  sender.kick(); // finish any newsletter that was sending when the server stopped
});
if (mailer.mode === 'smtp') mailer.verify().then(() => console.log('[mail] SMTP connection OK')).catch(e => console.error('[mail] SMTP check failed:', e.message));

function shutdown() {
  sender.stop();
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
