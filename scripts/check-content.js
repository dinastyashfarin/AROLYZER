// Checks the files in /content before you build or deploy:  npm run check:content
// Errors (exit 1): broken JSON, Indonesian keys that don't exist in English, {placeholders} or
// <b>/<a> tags that don't match, wrong number of steps or parts. Warnings: text not yet translated.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = path.join(ROOT, 'content');
const errors = [], warnings = [];
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(C, f), 'utf8')); } catch (e) { errors.push(`${f}: ${e.message}`); return null; } };
const holes = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
const tags = s => (s.match(/<\/?(b|strong|em|a)\b/gi) || []).map(t => t.toLowerCase().replace(/\s.*/, '')).join(',');
const SKIP = new Set(['phrases', 'patterns']);

function walk(en, id, where, file) {
  if (typeof en === 'string') {
    if (id == null) { if (/[A-Za-z]{3}/.test(en) && !/^[A-Z0-9 .&-]+$/.test(en)) warnings.push(`${file}: ${where} has no Indonesian yet ("${en.slice(0, 60)}")`); return; }
    if (typeof id !== 'string') return errors.push(`${file}: ${where} should be text`);
    if (holes(en) !== holes(id)) errors.push(`${file}: ${where} placeholders differ: EN {${holes(en)}} vs ID {${holes(id)}}`);
    if (tags(en) !== tags(id)) errors.push(`${file}: ${where} formatting tags differ between EN and ID`);
    return;
  }
  if (Array.isArray(en)) {
    if (id != null && (!Array.isArray(id) || id.length !== en.length)) errors.push(`${file}: ${where} should have ${en.length} items in Indonesian too`);
    en.forEach((v, i) => walk(v, id && id[i], `${where}[${i}]`, file));
    return;
  }
  if (en && typeof en === 'object') {
    Object.keys(en).forEach(k => walk(en[k], id && id[k], where ? where + '.' + k : k, file));
    if (id && typeof id === 'object') Object.keys(id).forEach(k => { if (!SKIP.has(k) && !(k in en)) errors.push(`${file}: "${where ? where + '.' + k : k}" is in Indonesian but not in English (typo?)`); });
  }
}

for (const page of ['landing', 'waitlist', 'email']) {
  const en = read(`en/${page}.json`), id = read(`id/${page}.json`);
  if (en && id) walk(en, id, '', `id/${page}.json`);
  if (id && id.patterns) id.patterns.forEach((p, i) => { try { new RegExp(p[0]); } catch (e) { errors.push(`id/${page}.json: patterns[${i}] is not a valid pattern`); } });
}

const site = read('site.json');
const landing = read('en/landing.json');
const data = fs.readFileSync(path.join(ROOT, 'src/landing/data.js'), 'utf8');
const count = name => { const m = data.match(new RegExp(`var ${name} = (\\[.*\\]);`)); return m ? JSON.parse(m[1]).length : null; };
if (landing) {
  const steps = count('STEP_RIGS'), parts = count('FEAT_RIGS');
  if (steps != null && landing.steps.length !== steps) errors.push(`en/landing.json: "steps" needs exactly ${steps} items (one per 3D step)`);
  if (parts != null && landing.upclose.parts.length !== parts) errors.push(`en/landing.json: "upclose.parts" needs exactly ${parts} items (one per 3D view)`);
}
if (site) {
  (site.logos || []).forEach((l, i) => {
    if (!l.src || !l.alt) errors.push(`site.json: logos[${i}] needs "src" and "alt"`);
    else if (l.src.startsWith('/') && !fs.existsSync(path.join(ROOT, 'public', l.src))) errors.push(`site.json: logos[${i}] file public${l.src} doesn't exist`);
  });
  for (const k of ['workingVolumeL', 'bulkDensity', 'yieldPct', 'batchHours']) if (typeof (site.calculator || {})[k] !== 'number') errors.push(`site.json: calculator.${k} must be a number`);
}

warnings.forEach(w => console.log('warning:', w));
errors.forEach(e => console.log('ERROR:  ', e));
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
