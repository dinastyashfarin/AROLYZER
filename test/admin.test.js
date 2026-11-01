import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, person, linkFrom, signIn } from './helpers.js';

async function confirmed(ctx, list) {
  for (const p of list) {
    await ctx.http.post('/api/waitlist').send(person(p)).expect(200);
    const mail = ctx.sent.filter(m => m.to === p.email).pop();
    await ctx.http.get(linkFrom(mail, 'confirm')).expect(200);
  }
}

test('admin API needs the password', async () => {
  const { http, agent } = setup();
  await http.get('/api/admin/overview').expect(401);
  await http.post('/api/admin/login').send({ password: 'nope' }).expect(401);
  await signIn(agent);
  await agent.get('/api/admin/overview').expect(200);
  await agent.post('/api/admin/logout').expect(200);
  await agent.get('/api/admin/overview').expect(401);
});

test('admin writes without the app header are refused (blocks cross-site form posts)', async () => {
  const { app, agent } = setup();
  await signIn(agent);
  const cookie = (await agent.post('/api/admin/login').send({ password: 'secret-pass' })).headers['set-cookie'];
  const request = (await import('supertest')).default;
  await request(app).post('/api/admin/newsletters').set('Cookie', cookie).type('form').send({ subject_en: 'x' }).expect(403);
});

test('waitlist list, search and CSV export', async () => {
  const ctx = setup();
  await confirmed(ctx, [{ email: 'a@x.co' }, { email: 'b@x.co', name: 'Budi', company: '=HYPERLINK("x")' }]);
  await signIn(ctx.agent);
  const all = await ctx.agent.get('/api/admin/signups').expect(200);
  assert.equal(all.body.total, 2);
  const found = await ctx.agent.get('/api/admin/signups?q=budi').expect(200);
  assert.equal(found.body.total, 1);
  const csv = await ctx.agent.get('/api/admin/signups.csv').expect(200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.text, /'=HYPERLINK/); // formulas are neutralised
});

test('newsletter: draft, test, send to confirmed only, in each person’s language', async () => {
  const ctx = setup();
  await confirmed(ctx, [{ email: 'en@x.co' }, { email: 'id@x.co', lang: 'id' }]);
  await ctx.http.post('/api/waitlist').send(person({ email: 'pending@x.co' })).expect(200); // never confirms
  await signIn(ctx.agent);
  const nl = (await ctx.agent.post('/api/admin/newsletters').send({}).expect(201)).body;
  await ctx.agent.put('/api/admin/newsletters/' + nl.id).send({ subject_en: 'Hello', body_en: '# Hi\n\nNews.', subject_id: 'Halo', body_id: '# Hai\n\nKabar.' }).expect(200);

  const before = ctx.sent.length;
  await ctx.agent.post(`/api/admin/newsletters/${nl.id}/test`).send({ email: 'me@x.co', lang: 'both' }).expect(200);
  assert.equal(ctx.sent.length - before, 2);
  assert.match(ctx.sent[ctx.sent.length - 1].subject, /^\[TEST\]/);

  await ctx.agent.post(`/api/admin/newsletters/${nl.id}/send`).send({}).expect(400); // must confirm
  const s = await ctx.agent.post(`/api/admin/newsletters/${nl.id}/send`).send({ confirm: true }).expect(200);
  assert.equal(s.body.total, 2);
  await ctx.sender.drain();

  const got = ctx.sent.slice(-2);
  const en = got.find(m => m.to === 'en@x.co'), id = got.find(m => m.to === 'id@x.co');
  assert.equal(en.subject, 'Hello');
  assert.equal(id.subject, 'Halo');
  assert.equal(id.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(!ctx.sent.some(m => m.to === 'pending@x.co' && m.subject === 'Hello'));

  const after = (await ctx.agent.get('/api/admin/newsletters/' + nl.id).expect(200)).body;
  assert.equal(after.status, 'sent');
  assert.equal(after.stats.sent, 2);
  await ctx.agent.put('/api/admin/newsletters/' + nl.id).send({ subject_en: 'changed' }).expect(409);
});

test('people who leave before their turn are skipped', async () => {
  const ctx = setup();
  await confirmed(ctx, [{ email: 'a@x.co' }, { email: 'b@x.co' }]);
  await signIn(ctx.agent);
  const nl = (await ctx.agent.post('/api/admin/newsletters').send({ subject_en: 'S', body_en: 'B' }).expect(201)).body;
  await ctx.agent.post(`/api/admin/newsletters/${nl.id}/send`).send({ confirm: true }).expect(200);
  ctx.sender.stop();
  ctx.db.prepare("UPDATE subscribers SET status='unsubscribed' WHERE email='b@x.co'").run();
  await ctx.sender.drain();
  const r = (await ctx.agent.get('/api/admin/newsletters/' + nl.id).expect(200)).body;
  assert.equal(r.stats.sent, 1);
  assert.equal(r.stats.skipped, 1);
});

test('deleting a subscriber erases them', async () => {
  const ctx = setup();
  await confirmed(ctx, [{ email: 'a@x.co' }]);
  await signIn(ctx.agent);
  const list = (await ctx.agent.get('/api/admin/subscribers').expect(200)).body;
  await ctx.agent.delete('/api/admin/subscribers/' + list.rows[0].id).expect(200);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) n FROM subscribers').get().n, 0);
});
