// Newsletter queue. Sending a newsletter creates one "queued" delivery per confirmed subscriber;
// this loop works through them at SEND_PER_SECOND and picks up where it left off after a restart.
import { newsletterEmail } from './emails.js';
import { now } from '../db.js';

export function createSender({ db, cfg, content, mailer, log = console }) {
  let running = false, timer = null, stopped = false;
  const next = db.prepare(`SELECT d.*, s.token FROM deliveries d JOIN newsletters n ON n.id = d.newsletter_id
    LEFT JOIN subscribers s ON s.id = d.subscriber_id WHERE d.status = 'queued' AND n.status = 'sending' ORDER BY d.id LIMIT 1`);
  const mark = db.prepare('UPDATE deliveries SET status = ?, error = ?, sent_at = ? WHERE id = ?');
  const getNl = db.prepare('SELECT * FROM newsletters WHERE id = ?');
  const subStatus = db.prepare('SELECT status FROM subscribers WHERE id = ?');
  const finish = db.prepare(`UPDATE newsletters SET status = 'sent', sent_at = ? WHERE status = 'sending'
    AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.newsletter_id = newsletters.id AND d.status = 'queued')`);
  const gap = () => Math.round(1000 / cfg.sendPerSecond);

  const sleep = ms => new Promise(r => { timer = setTimeout(r, ms); });

  // returns 'done' when the queue is empty, 'skipped' or 'sent'
  async function step() {
    const d = next.get();
    if (!d) { finish.run(now()); return 'done'; }
    const sub = d.subscriber_id ? subStatus.get(d.subscriber_id) : null;
    if (!sub || sub.status !== 'confirmed' || !d.token) { mark.run('skipped', 'left the list before sending', null, d.id); return 'skipped'; }
    try {
      const mail = newsletterEmail({ cfg, content, nl: getNl.get(d.newsletter_id), lang: d.lang, token: d.token });
      await mailer.send({ to: d.email, ...mail });
      mark.run('sent', null, now(), d.id);
    } catch (e) {
      log.error('[send] failed for', d.email, e.message);
      mark.run('failed', String(e.message || e).slice(0, 300), null, d.id);
    }
    return 'sent';
  }
  async function loop() {
    try { while (!stopped) { const r = await step(); if (r === 'done') break; if (r === 'sent') await sleep(gap()); } }
    catch (e) { log.error('[send]', e); }
    running = false;
  }

  return {
    kick() { if (!running && !stopped) { running = true; loop(); } },
    stop() { stopped = true; clearTimeout(timer); running = false; },
    get running() { return running; },
    /** for tests: send everything queued right now */
    async drain() { while ((await step()) !== 'done'); },
  };
}
