// Safe copy of the database while the server runs:  npm run backup
// Writes DATA_DIR/backups/arolyzer-YYYY-MM-DD-HHMM.db. Copy that folder somewhere off the server.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../server/config.js';

const cfg = loadConfig({ ...process.env, NODE_ENV: 'development' });
const src = path.join(cfg.dataDir, 'arolyzer.db');
if (!fs.existsSync(src)) { console.error('No database at', src); process.exit(1); }
const dir = path.join(cfg.dataDir, 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, m => (m === 'T' ? '-' : m === ':' ? '' : '-'));
const out = path.join(dir, `arolyzer-${stamp}.db`);
const db = new Database(src, { readonly: true });
await db.backup(out);
db.close();
console.log('Backup written to', out);
