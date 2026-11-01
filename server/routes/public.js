// Public endpoints: waitlist sign-up, email confirmation and unsubscribe.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { now } from '../db.js';
import { newToken } from '../lib/tokens.js';
import { confirmEmail } from '../lib/emails.js';
import { page } from '../lib/pages.js';
import { esc } from '../lib/html.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clip = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const RESEND_AFTER_MS = 2 * 60 * 1000;

export function publicRoutes({ db, cfg, content, mailer, log = console }) {
  const r = express.Router();
  const limiter = (max, windowMin) => rateLimit({ windowMs: windowMin * 60000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Too many tries. Wait a few minutes and try again.' } });

  const q = {
    signupByEmail: db.prepare('SELECT * FROM signups WHERE email = ?'),
    insertSignup: db.prepare(`INSERT INTO signups (email, name, phone, company, location, role, operation, tonnage, lang)
      VALUES (@email, @name, @phone, @company, @location, @role, @operation, @tonnage, @lang)`),
    updateSignup: db.prepare(`UPDATE signups SET name=@name, phone=@phone, company=@company, location=@location, role=@role,
      operation=@operation, tonnage=@tonnage, lang=@lang, updated_at=@now WHERE id=@id`),
    position: db.prepare('SELECT COUNT(*) AS n FROM signups WHERE id <= ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM signups'),
    subByEmail: db.prepare('SELECT * FROM subscribers WHERE email = ?'),
    subByToken: db.prepare('SELECT * FROM subscribers WHERE token = ?'),
    subByConfirm: db.prepare('SELECT * FROM subscribers WHERE confirm_token = ?'),
    insertSub: db.prepare(`INSERT INTO subscribers (email, name, lang, status, token, confirm_token, source, consent_at)
      VALUES (@email, @name, @lang, 'pending', @token, @confirm_token, 'waitlist', @now)`),
    repending: db.prepare(`UPDATE subscribers SET status='pending', name=@name, lang=@lang, confirm_token=@confirm_token, consent_at=@now, unsubscribed_at=NULL WHERE id=@id`),
    touchSub: db.prepare('UPDATE subscribers SET name=@name, lang=@lang WHERE id=@id'),
    sentConfirm: db.prepare('UPDATE subscribers SET confirm_sent_at=? WHERE id=?'),
    confirm: db.prepare(`UPDATE subscribers SET status='confirmed', confirmed_at=?, confirm_token=NULL WHERE id=?`),
    unsubscribe: db.prepare(`UPDATE subscribers SET status='unsubscribed', unsubscribed_at=? WHERE id=?`),
    resubscribe: db.prepare(`UPDATE subscribers SET status='confirmed', unsubscribed_at=NULL, confirmed_at=COALESCE(confirmed_at, ?) WHERE id=?`),
  };

  // ---- waitlist ----
  r.post('/api/waitlist', limiter(10, 15), express.json({ limit: '10kb' }), async (req, res) => {
    const b = req.body || {};
    const d = {
      name: clip(b.name, 120), email: clip(b.email, 200).toLowerCase(), phone: clip(b.phone, 40), company: clip(b.company, 160),
      location: clip(b.location, 160), role: clip(b.role, 40), operation: clip(b.operation, 80), tonnage: clip(b.tonnage, 40),
      lang: b.lang === 'id' ? 'id' : 'en',
    };
    // bots fill the hidden "website" field: answer like a success, store nothing
    if (clip(b.website)) return res.json({ position: q.count.get().n + 1 });
    const errors = {};
    if (d.name.length < 2) errors.name = 'Add your name.';
    if (!EMAIL.test(d.email)) errors.email = 'Use an email like name@company.com.';
    if (d.company.length < 2) errors.company = 'Add your company or mill name.';
    if (!d.operation) errors.operation = 'Pick the closest one.';
    if (b.consent !== true) errors.consent = 'Consent is needed to email you.';
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });

    const t = now();
    let sub;
    const signup = db.transaction(() => {
      const old = q.signupByEmail.get(d.email);
      let id;
      if (old) { q.updateSignup.run({ ...d, now: t, id: old.id }); id = old.id; } else id = q.insertSignup.run(d).lastInsertRowid;
      sub = q.subByEmail.get(d.email);
      if (!sub) {
        q.insertSub.run({ email: d.email, name: d.name, lang: d.lang, token: newToken(), confirm_token: newToken(), now: t });
      } else if (sub.status === 'unsubscribed') {
        q.repending.run({ id: sub.id, name: d.name, lang: d.lang, confirm_token: newToken(), now: t });
      } else if (sub.status === 'pending' && !sub.confirm_token) {
        q.repending.run({ id: sub.id, name: d.name, lang: d.lang, confirm_token: newToken(), now: t });
      } else q.touchSub.run({ id: sub.id, name: d.name, lang: d.lang });
      sub = q.subByEmail.get(d.email);
      return id;
    })();

    // send (or re-send) the confirmation email unless they're already confirmed or we just sent one
    const recent = sub.confirm_sent_at && Date.now() - Date.parse(sub.confirm_sent_at) < RESEND_AFTER_MS;
    if (sub.status === 'pending' && !recent) {
      try { await mailer.send({ to: sub.email, ...confirmEmail({ cfg, content, sub }) }); q.sentConfirm.run(now(), sub.id); }
      catch (e) { log.error('[mail] confirmation failed for', sub.email, e.message); }
    }
    res.json({ position: q.position.get(signup).n, confirmed: sub.status === 'confirmed' });
  });

  // ---- double opt-in ----
  r.get('/confirm', limiter(60, 1), (req, res) => {
    const sub = q.subByConfirm.get(String(req.query.token || ''));
    if (!sub) {
      const lang = req.query.lang === 'id' ? 'id' : 'en', c = k => content.copy(lang, 'pages.' + k);
      return res.status(404).send(page({ lang, title: c('invalid_title'), body: c('invalid_body'), actions: `<a class="btn btn-act" href="/waitlist.html">${esc(lang === 'id' ? 'Gabung daftar tunggu' : 'Join the waitlist')}</a>` }));
    }
    q.confirm.run(now(), sub.id);
    const c = (k, v) => content.copy(sub.lang, 'pages.' + k, v);
    res.send(page({ lang: sub.lang, title: c('confirmed_title'), body: c('confirmed_body', { name: (sub.name || '').split(/\s+/)[0] }),
      actions: `<a class="btn btn-act" href="/">${esc(c('back_home'))}</a>` }));
  });

  // ---- unsubscribe: the email link opens this page, which unsubscribes straight away (one click) ----
  const unsubPage = (sub, nonce) => {
    const c = (k, v) => content.copy(sub.lang, 'pages.' + k, v), tok = esc(sub.token);
    if (sub.status === 'unsubscribed') {
      return page({ lang: sub.lang, title: c('unsubscribed_title'), body: c('unsubscribed_body', { email: sub.email }),
        actions: `<form method="post" action="/unsubscribe/undo"><input type="hidden" name="token" value="${tok}"><button class="btn btn-line" type="submit">${esc(c('resubscribe_button'))}</button></form><a class="btn btn-act" href="/">${esc(c('back_home'))}</a>` });
    }
    return page({ lang: sub.lang, title: c('unsubscribe_title'), body: c('unsubscribe_body', { email: sub.email }), nonce,
      actions: `<form id="u" method="post" action="/unsubscribe"><input type="hidden" name="token" value="${tok}"><button class="btn btn-act" type="submit">${esc(c('unsubscribe_button'))}</button></form>`,
      // link scanners in mail servers don't run scripts, so only a real visit unsubscribes
      script: "document.getElementById('u').submit()" });
  };
  const invalid = (res, lang = 'en') => { const c = k => content.copy(lang, 'pages.' + k); res.status(404).send(page({ lang, title: c('invalid_title'), body: c('invalid_body'), actions: `<a class="btn btn-act" href="/">${esc(c('back_home'))}</a>` })); };

  r.get('/unsubscribe', limiter(60, 1), (req, res) => {
    const sub = q.subByToken.get(String(req.query.token || ''));
    if (!sub) return invalid(res);
    res.send(unsubPage(sub, res.locals.nonce));
  });
  // handles the page's form and mail apps' one-click button (List-Unsubscribe-Post)
  r.post('/unsubscribe', limiter(60, 1), express.urlencoded({ extended: false, limit: '2kb' }), (req, res) => {
    const sub = q.subByToken.get(String((req.body && req.body.token) || req.query.token || ''));
    if (!sub) return invalid(res);
    if (sub.status !== 'unsubscribed') q.unsubscribe.run(now(), sub.id);
    if (req.body && req.body['List-Unsubscribe'] === 'One-Click') return res.status(200).send('OK');
    res.send(unsubPage(q.subByToken.get(sub.token), res.locals.nonce));
  });
  r.post('/unsubscribe/undo', limiter(30, 1), express.urlencoded({ extended: false, limit: '2kb' }), (req, res) => {
    const sub = q.subByToken.get(String((req.body && req.body.token) || ''));
    if (!sub) return invalid(res);
    q.resubscribe.run(now(), sub.id);
    const c = (k, v) => content.copy(sub.lang, 'pages.' + k, v);
    res.send(page({ lang: sub.lang, title: c('resubscribed_title'), body: c('resubscribed_body', { email: sub.email }), actions: `<a class="btn btn-act" href="/">${esc(c('back_home'))}</a>` }));
  });

  return r;
}
