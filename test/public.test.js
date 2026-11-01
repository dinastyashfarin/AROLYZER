import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, person, linkFrom } from './helpers.js';

test('joining the waitlist stores the sign-up and sends a confirmation email', async () => {
  const { http, sent, db } = setup();
  const r = await http.post('/api/waitlist').send(person()).expect(200);
  assert.equal(r.body.position, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Confirm/);
  assert.ok(linkFrom(sent[0], 'confirm'));
  assert.equal(db.prepare('SELECT status FROM subscribers').get().status, 'pending');
});

test('Indonesian sign-ups get the Indonesian email', async () => {
  const { http, sent } = setup();
  await http.post('/api/waitlist').send(person({ lang: 'id' })).expect(200);
  assert.match(sent[0].subject, /Konfirmasi/);
  assert.match(sent[0].html, /lang="id"/);
});

test('bad input is rejected with field messages', async () => {
  const { http, sent } = setup();
  const r = await http.post('/api/waitlist').send(person({ email: 'nope', consent: false, name: '' })).expect(400);
  assert.ok(r.body.fields.email && r.body.fields.consent && r.body.fields.name);
  assert.equal(sent.length, 0);
});

test('the hidden bot field fakes success and stores nothing', async () => {
  const { http, db, sent } = setup();
  await http.post('/api/waitlist').send(person({ website: 'http://spam' })).expect(200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM signups').get().n, 0);
  assert.equal(sent.length, 0);
});

test('signing up twice keeps the place in line and does not spam', async () => {
  const { http, sent } = setup();
  await http.post('/api/waitlist').send(person()).expect(200);
  await http.post('/api/waitlist').send(person({ email: 'budi@mill.co.id', name: 'Budi' })).expect(200);
  const again = await http.post('/api/waitlist').send(person({ company: 'PT Baru' })).expect(200);
  assert.equal(again.body.position, 1);
  assert.equal(sent.filter(m => m.to === 'siti@sawit.co.id').length, 1);
});

test('confirm link confirms once; old links show the "doesn’t work" page', async () => {
  const { http, sent, db } = setup();
  await http.post('/api/waitlist').send(person()).expect(200);
  const link = linkFrom(sent[0], 'confirm');
  const ok = await http.get(link).expect(200);
  assert.match(ok.text, /confirmed/i);
  assert.equal(db.prepare('SELECT status FROM subscribers').get().status, 'confirmed');
  await http.get(link).expect(404);
});

test('unsubscribe page, one-click POST and undo', async () => {
  const { http, db } = setup();
  await http.post('/api/waitlist').send(person()).expect(200);
  const token = db.prepare('SELECT token FROM subscribers').get().token;
  db.prepare("UPDATE subscribers SET status='confirmed'").run();
  const page = await http.get('/unsubscribe?token=' + token).expect(200);
  assert.match(page.text, /<form id="u"/);
  assert.match(page.headers['content-security-policy'], /nonce-/);
  await http.post('/unsubscribe?token=' + token).type('form').send({ 'List-Unsubscribe': 'One-Click' }).expect(200);
  assert.equal(db.prepare('SELECT status FROM subscribers').get().status, 'unsubscribed');
  await http.post('/unsubscribe/undo').type('form').send({ token }).expect(200);
  assert.equal(db.prepare('SELECT status FROM subscribers').get().status, 'confirmed');
  await http.get('/unsubscribe?token=wrong').expect(404);
});

test('someone who unsubscribed and joins again must confirm again', async () => {
  const { http, db, sent } = setup();
  await http.post('/api/waitlist').send(person()).expect(200);
  db.prepare("UPDATE subscribers SET status='unsubscribed', confirm_sent_at=NULL").run();
  await http.post('/api/waitlist').send(person()).expect(200);
  assert.equal(db.prepare('SELECT status FROM subscribers').get().status, 'pending');
  assert.equal(sent.length, 2);
});
