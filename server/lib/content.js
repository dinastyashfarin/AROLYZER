// Reads email and page copy from content/<lang>/email.json and content/site.json.
// Files are re-read when they change, so copy edits apply without a restart.
import fs from 'node:fs';
import path from 'node:path';

export function createContent(dir) {
  const cache = new Map();
  const read = file => {
    const p = path.join(dir, file);
    let st; try { st = fs.statSync(p); } catch (e) { return {}; }
    const hit = cache.get(p);
    if (hit && hit.mtime === st.mtimeMs) return hit.data;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    cache.set(p, { mtime: st.mtimeMs, data });
    return data;
  };
  const get = (o, key) => key.split('.').reduce((c, k) => (c == null ? undefined : c[k]), o);
  return {
    site: () => read('site.json'),
    /** copy('id', 'confirm.subject', { name }) with English as the fallback */
    copy(lang, key, vars) {
      let v = get(read(`${lang === 'id' ? 'id' : 'en'}/email.json`), key);
      if (v == null) v = get(read('en/email.json'), key);
      if (v == null) return key;
      return String(v).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
    },
  };
}
