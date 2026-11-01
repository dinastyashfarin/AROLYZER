// Admin API (everything under /api/admin needs the admin session cookie).
import express from 'express';
import rateLimit from 'express-rate-limit';
import { now } from '../db.js';
import { toCsv } from '../lib/csv.js';
import { newsletterEmail } from '../lib/emails.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PAGE = 50;

export function adminRoutes({ db, cfg, content, mailer, auth, sender }) {
  const r = express.Router();
  r.use(express.json({ limit: '1mb' }));

  // ---- session ----
  r.post('/login', rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many tries. Wait 15 minutes.' } }), (req, res) => {
    if (!auth.enabled) return res.status(503).json({ error: 'Admin is off. Set ADMIN_PASSWORD on the server.' });
    if (!auth.checkPassword(req.body && req.body.password)) return res.status(401).json({ error: 'Wrong password.' });
    auth.login(res); res.json({ ok: true });
  });
  r.post('/logout', (req, res) => { auth.logout(res); res.json({ ok: true }); });
  r.get('/me', (req, res) => res.json({ signedIn: auth.isAdmin(req), enabled: auth.enabled }));

  r.use(auth.require);

  // ---- overview ----
  r.get('/overview', (req, res) => {
    const subs = Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM subscribers GROUP BY status').all().map(x => [x.status, x.n]));
    res.json({
      signups: db.prepare('SELECT COUNT(*) n FROM signups').get().n,
      signupsWeek: db.prepare("SELECT COUNT(*) n FROM signups WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-7 days')").get().n,
      subscribers: { pending: subs.pending || 0, confirmed: subs.confirmed || 0, unsubscribed: subs.unsubscribed || 0 },
      byLang: db.prepare("SELECT lang, COUNT(*) n FROM subscribers WHERE status='confirmed' GROUP BY lang").all(),
      recent: db.prepare('SELECT id, name, email, company, operation, created_at FROM signups ORDER BY id DESC LIMIT 5').all(),
      mail: { mode: mailer.mode, from: mailer.from },
      publicUrl: cfg.publicUrl,
    });
  });

  // ---- waitlist ----
  const SIGNUP_COLS = [
    { key: 'id', label: 'Position' }, { key: 'created_at', label: 'Joined (UTC)' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
    { key: 'phone', label: 'WhatsApp' }, { key: 'company', label: 'Company' }, { key: 'role', label: 'Role' }, { key: 'operation', label: 'Operation' },
    { key: 'tonnage', label: 'Waste per month' }, { key: 'location', label: 'Location' }, { key: 'lang', label: 'Language' }, { key: 'newsletter', label: 'Newsletter' },
  ];
  const signupWhere = qs => {
    const w = [], p = {};
    if (qs.q) { w.push('(s.name LIKE @q OR s.email LIKE @q OR s.company LIKE @q OR s.location LIKE @q)'); p.q = '%' + String(qs.q).trim() + '%'; }
    if (qs.operation) { w.push('s.operation = @op'); p.op = String(qs.operation); }
    return { sql: w.length ? 'WHERE ' + w.join(' AND ') : '', p };
  };
  const signupSelect = `SELECT s.*, COALESCE(sub.status, 'none') AS newsletter FROM signups s LEFT JOIN subscribers sub ON sub.email = s.email`;
  r.get('/signups', (req, res) => {
    const { sql, p } = signupWhere(req.query), page = Math.max(1, +req.query.page || 1);
    res.json({
      total: db.prepare(`SELECT COUNT(*) n FROM signups s ${sql}`).get(p).n, page, pageSize: PAGE,
      rows: db.prepare(`${signupSelect} ${sql} ORDER BY s.id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`).all(p),
      operations: db.prepare('SELECT operation, COUNT(*) n FROM signups GROUP BY operation ORDER BY n DESC').all(),
    });
  });
  r.get('/signups.csv', (req, res) => {
    const { sql, p } = signupWhere(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="arolyzer-waitlist-${now().slice(0, 10)}.csv"`);
    res.send(toCsv(SIGNUP_COLS, db.prepare(`${signupSelect} ${sql} ORDER BY s.id`).all(p)));
  });
  r.delete('/signups/:id', (req, res) => {
    const row = db.prepare('SELECT email FROM signups WHERE id = ?').get(+req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found.' });
    db.transaction(() => {
      db.prepare('DELETE FROM signups WHERE id = ?').run(+req.params.id);
      if (req.query.subscriber === '1') db.prepare('DELETE FROM subscribers WHERE email = ?').run(row.email);
    })();
    res.json({ ok: true });
  });

  // ---- subscribers ----
  const SUB_COLS = [
    { key: 'email', label: 'Email' }, { key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'lang', label: 'Language' },
    { key: 'source', label: 'Source' }, { key: 'consent_at', label: 'Consent given (UTC)' }, { key: 'confirmed_at', label: 'Confirmed (UTC)' },
    { key: 'unsubscribed_at', label: 'Unsubscribed (UTC)' }, { key: 'created_at', label: 'Added (UTC)' },
  ];
  const subWhere = qs => {
    const w = [], p = {};
    if (qs.q) { w.push('(email LIKE @q OR name LIKE @q)'); p.q = '%' + String(qs.q).trim() + '%'; }
    if (['pending', 'confirmed', 'unsubscribed'].includes(qs.status)) { w.push('status = @st'); p.st = qs.status; }
    return { sql: w.length ? 'WHERE ' + w.join(' AND ') : '', p };
  };
  const SUB_FIELDS = 'id, email, name, lang, status, source, consent_at, confirmed_at, unsubscribed_at, created_at';
  r.get('/subscribers', (req, res) => {
    const { sql, p } = subWhere(req.query), page = Math.max(1, +req.query.page || 1);
    res.json({
      total: db.prepare(`SELECT COUNT(*) n FROM subscribers ${sql}`).get(p).n, page, pageSize: PAGE,
      rows: db.prepare(`SELECT ${SUB_FIELDS} FROM subscribers ${sql} ORDER BY id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`).all(p),
    });
  });
  r.get('/subscribers.csv', (req, res) => {
    const { sql, p } = subWhere(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="arolyzer-subscribers-${now().slice(0, 10)}.csv"`);
    res.send(toCsv(SUB_COLS, db.prepare(`SELECT ${SUB_FIELDS} FROM subscribers ${sql} ORDER BY id`).all(p)));
  });
  r.post('/subscribers/:id/unsubscribe', (req, res) => {
    const n = db.prepare("UPDATE subscribers SET status='unsubscribed', unsubscribed_at=? WHERE id=? AND status != 'unsubscribed'").run(now(), +req.params.id).changes;
    res.json({ ok: true, changed: n });
  });
  r.delete('/subscribers/:id', (req, res) => {
    const n = db.prepare('DELETE FROM subscribers WHERE id = ?').run(+req.params.id).changes;
    if (!n) return res.status(404).json({ error: 'Not found.' });
    res.json({ ok: true });
  });

  // ---- newsletters ----
  const nlStats = id => Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM deliveries WHERE newsletter_id = ? GROUP BY status').all(id).map(x => [x.status, x.n]));
  const getNl = id => db.prepare('SELECT * FROM newsletters WHERE id = ?').get(id);
  const withStats = nl => nl && ({ ...nl, stats: nlStats(nl.id) });
  const audience = () => db.prepare("SELECT lang, COUNT(*) n FROM subscribers WHERE status='confirmed' GROUP BY lang").all();
  const fields = b => ({
    subject_en: String(b.subject_en || '').slice(0, 200), body_en: String(b.body_en || '').slice(0, 100000),
    subject_id: String(b.subject_id || '').slice(0, 200), body_id: String(b.body_id || '').slice(0, 100000),
  });

  r.get('/newsletters', (req, res) => {
    res.json({ rows: db.prepare('SELECT id, subject_en, subject_id, status, total, created_at, updated_at, sent_at FROM newsletters ORDER BY id DESC').all().map(withStats), audience: audience() });
  });
  r.post('/newsletters', (req, res) => {
    const id = db.prepare('INSERT INTO newsletters (subject_en, body_en, subject_id, body_id) VALUES (@subject_en, @body_en, @subject_id, @body_id)').run(fields(req.body || {})).lastInsertRowid;
    res.status(201).json(withStats(getNl(id)));
  });
  r.get('/newsletters/:id', (req, res) => {
    const nl = getNl(+req.params.id);
    if (!nl) return res.status(404).json({ error: 'Not found.' });
    res.json({ ...withStats(nl), audience: audience(), failures: db.prepare("SELECT email, error FROM deliveries WHERE newsletter_id = ? AND status = 'failed' LIMIT 50").all(nl.id) });
  });
  r.put('/newsletters/:id', (req, res) => {
    const nl = getNl(+req.params.id);
    if (!nl) return res.status(404).json({ error: 'Not found.' });
    if (nl.status !== 'draft') return res.status(409).json({ error: 'This newsletter was already sent. Duplicate it to make changes.' });
    db.prepare('UPDATE newsletters SET subject_en=@subject_en, body_en=@body_en, subject_id=@subject_id, body_id=@body_id, updated_at=@now WHERE id=@id').run({ ...fields(req.body || {}), now: now(), id: nl.id });
    res.json(withStats(getNl(nl.id)));
  });
  r.delete('/newsletters/:id', (req, res) => {
    const nl = getNl(+req.params.id);
    if (!nl) return res.status(404).json({ error: 'Not found.' });
    if (nl.status === 'sending') return res.status(409).json({ error: 'Wait until sending finishes.' });
    db.prepare('DELETE FROM newsletters WHERE id = ?').run(nl.id);
    res.json({ ok: true });
  });
  r.post('/newsletters/:id/duplicate', (req, res) => {
    const nl = getNl(+req.params.id);
    if (!nl) return res.status(404).json({ error: 'Not found.' });
    const id = db.prepare('INSERT INTO newsletters (subject_en, body_en, subject_id, body_id) VALUES (@subject_en, @body_en, @subject_id, @body_id)').run(fields(nl)).lastInsertRowid;
    res.status(201).json(withStats(getNl(id)));
  });
  // live preview of unsaved text
  r.post('/preview', (req, res) => {
    const lang = req.body && req.body.lang === 'id' ? 'id' : 'en';
    const mail = newsletterEmail({ cfg, content, nl: fields(req.body || {}), lang, token: 'preview' });
    res.json({ subject: mail.subject, html: mail.html, lang: mail.lang });
  });
  r.post('/newsletters/:id/test', async (req, res) => {
    const nl = getNl(+req.params.id), to = String((req.body && req.body.email) || '').trim();
    if (!nl) return res.status(404).json({ error: 'Not found.' });
    if (!EMAIL.test(to)) return res.status(400).json({ error: 'Enter a valid email for the test.' });
    if (!(nl.subject_en || '').trim() || !(nl.body_en || '').trim()) return res.status(400).json({ error: 'Add an English subject and text first.' });
    const langs = req.body.lang === 'both' ? ['en', 'id'] : [req.body.lang === 'id' ? 'id' : 'en'];
    try {
      for (const lang of langs) {
        const m = newsletterEmail({ cfg, content, nl, lang, token: 'test' });
        await mailer.send({ to, ...m, subject: '[TEST] ' + m.subject });
      }
      res.json({ ok: true, sent: langs.length, mode: mailer.mode });
    } catch (e) { res.status(502).json({ error: 'The email server refused it: ' + e.message }); }
  });
  r.post('/newsletters/:id/send', (req, res) => {
    const nl = getNl(+req.params.id);
    if (!nl) return res.status(404).json({ error: 'Not found.' });
    if (nl.status !== 'draft') return res.status(409).json({ error: 'This newsletter was already sent.' });
    if (!nl.subject_en.trim() || !nl.body_en.trim()) return res.status(400).json({ error: 'Add an English subject and text first.' });
    if (!req.body || req.body.confirm !== true) return res.status(400).json({ error: 'Confirm the send.' });
    const total = db.transaction(() => {
      const n = db.prepare(`INSERT OR IGNORE INTO deliveries (newsletter_id, subscriber_id, email, lang)
        SELECT ?, id, email, lang FROM subscribers WHERE status = 'confirmed'`).run(nl.id).changes;
      db.prepare("UPDATE newsletters SET status = 'sending', total = ?, started_at = ?, updated_at = ? WHERE id = ?").run(n, now(), now(), nl.id);
      return n;
    })();
    sender.kick();
    res.json({ ...withStats(getNl(nl.id)), total });
  });
  r.post('/newsletters/:id/retry', (req, res) => {
    const nl = getNl(+req.params.id);
    if (!nl) return res.status(404).json({ error: 'Not found.' });
    const n = db.transaction(() => {
      const c = db.prepare("UPDATE deliveries SET status = 'queued', error = NULL WHERE newsletter_id = ? AND status = 'failed'").run(nl.id).changes;
      if (c) db.prepare("UPDATE newsletters SET status = 'sending', sent_at = NULL WHERE id = ?").run(nl.id);
      return c;
    })();
    sender.kick();
    res.json({ ok: true, requeued: n });
  });

  return r;
}
