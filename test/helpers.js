import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { loadConfig, ROOT } from '../server/config.js';
import { openDb } from '../server/db.js';
import { createContent } from '../server/lib/content.js';
import { createMailer } from '../server/lib/mailer.js';
import { createSender } from '../server/lib/sender.js';
import { createApp } from '../server/app.js';

/** A fresh app with an in-memory database and a mailbox that just collects messages */
export function setup() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arz-test-'));
  const cfg = loadConfig({ ADMIN_PASSWORD: 'secret-pass', PUBLIC_URL: 'https://arolyzer.test', DATA_DIR: dataDir, SEND_PER_SECOND: '1000', SECURE_COOKIES: 'false', DIST_DIR: path.join(dataDir, 'nodist') });
  const sent = [];
  const transport = { sendMail: async m => { sent.push(m); return { messageId: String(sent.length) }; } };
  const db = openDb(':memory:');
  const content = createContent(path.join(ROOT, 'content'));
  const mailer = createMailer(cfg, { transport });
  const sender = createSender({ db, cfg, content, mailer, log: { error() {} } });
  const app = createApp({ db, cfg, content, mailer, sender, log: { error() {} } });
  return { app, db, sent, sender, cfg, http: request(app), agent: request.agent(app).set('X-Arolyzer', '1') };
}

export const person = (o = {}) => ({ name: 'Siti Rahma', email: 'siti@sawit.co.id', company: 'PT Sawit Jaya', operation: 'Palm oil mill', role: 'Owner', tonnage: '10–50 t', consent: true, lang: 'en', ...o });

export const linkFrom = (mail, kind) => {
  const m = mail.html.match(new RegExp(`href="(https://arolyzer\\.test/${kind}\\?token=[^"]+)"`));
  return m && m[1].replace('https://arolyzer.test', '');
};

export async function signIn(agent) {
  await agent.post('/api/admin/login').send({ password: 'secret-pass' }).expect(200);
}
