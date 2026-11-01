// SQLite database (one file in DATA_DIR). Schema changes go in server/migrations as numbered .sql files;
// each runs once, in order, and the file number is stored in PRAGMA user_version.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

export function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  const files = fs.readdirSync(MIGRATIONS).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
  for (const f of files) {
    const n = parseInt(f, 10);
    if (n <= current) continue;
    db.transaction(() => { db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')); db.pragma('user_version = ' + n); })();
    console.log('[db] applied migration', f);
  }
}

export const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
