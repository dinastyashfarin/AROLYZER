// Reads the editable content in /content and turns it into text for the pages.
// Editors change the JSON files; nothing in this file needs to change for copy updates.
import React from 'react';
import site from '../content/site.json';
import enLanding from '../content/en/landing.json';
import idLanding from '../content/id/landing.json';
import enWaitlist from '../content/en/waitlist.json';
import idWaitlist from '../content/id/waitlist.json';

export { site };

const PAGES = {
  landing: { en: enLanding, id: idLanding },
  waitlist: { en: enWaitlist, id: idWaitlist },
};

export function pageContent(page, lang) {
  return PAGES[page][lang] || PAGES[page].en;
}

function lookup(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function fill(str, vars) {
  if (!vars || typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
}

/**
 * t('section.key') returns the text in the chosen language.
 * Missing Indonesian falls back to English, and a missing key shows the key itself
 * so it is easy to spot on the page.
 */
export function translator(page, lang) {
  const en = PAGES[page].en, cur = PAGES[page][lang] || en;
  return function t(key, vars) {
    let v = lookup(cur, key);
    if (v == null) v = lookup(en, key);
    if (v == null) {
      if (import.meta.env && import.meta.env.DEV) console.warn('[content] missing key', page + '.' + key);
      return key;
    }
    return fill(v, vars);
  };
}

const TAG = /<(\/?)(b|strong|em|br|a)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/gi;

/**
 * Renders text that may hold a little markup: <b>, <strong>, <em>, <a href="..." class="...">, <br>.
 * Anything else is shown as plain text, so content files can't inject scripts or styles.
 */
export function rich(str, vars) {
  if (typeof str !== 'string') return str;
  const root = { children: [] }, stack = [root];
  let last = 0, m, key = 0;
  const text = s => { if (s) stack[stack.length - 1].children.push(fill(s, vars)); };
  TAG.lastIndex = 0;
  while ((m = TAG.exec(str))) {
    text(str.slice(last, m.index)); last = TAG.lastIndex;
    const [, close, name] = m, tag = name.toLowerCase();
    if (tag === 'br') { stack[stack.length - 1].children.push(<br key={key++} />); continue; }
    if (close) { if (stack.length > 1 && stack[stack.length - 1].tag === tag) { const n = stack.pop(); stack[stack.length - 1].children.push(n.build()); } continue; }
    const props = { key: key++ };
    (m[3].match(/[a-z-]+="[^"]*"/gi) || []).forEach(a => {
      const i = a.indexOf('='), k = a.slice(0, i), v = a.slice(i + 2, -1);
      if (tag === 'a' && k === 'href' && !/^\s*javascript:/i.test(v)) props.href = v;
      if (k === 'class') props.className = v;
    });
    const n = { tag, children: [], build: () => React.createElement(tag, props, ...n.children) };
    stack.push(n);
  }
  text(str.slice(last));
  while (stack.length > 1) { const n = stack.pop(); stack[stack.length - 1].children.push(n.build()); }
  return root.children;
}

/** Splits a line into the word-by-word reveal spans used in the hero. */
export function words(text, start, step) {
  const out = [];
  String(text).split(/\s+/).filter(Boolean).forEach((w, i) => {
    if (i) out.push(' ');
    out.push(
      <span className="tr-c" key={i}>
        <span className="tr-w" style={{ '--rd': (start + step * i).toFixed(3) + 's' }}>{w}</span>
      </span>
    );
  });
  return out;
}

// ---- run-time dictionary for text the pages build in code (tooltips, counters, labels) ----
function pairs(en, id, out) {
  if (typeof en === 'string' && typeof id === 'string') {
    if (en === id || /\{\w+\}/.test(en)) return;
    const a = en.split(/<[^>]+>/), b = id.split(/<[^>]+>/);
    if (a.length !== b.length) return;
    a.forEach((s, i) => { const k = s.trim(), v = b[i].trim(); if (k && v && k !== v && /[A-Za-z]/.test(k)) out[k] = v; });
  } else if (en && id && typeof en === 'object' && typeof id === 'object') {
    Object.keys(en).forEach(k => { if (k !== 'phrases' && k !== 'patterns') pairs(en[k], id[k], out); });
  }
}

export function phraseTable(page) {
  const out = {};
  pairs(PAGES[page].en, PAGES[page].id, out);
  return Object.assign(out, PAGES[page].id.phrases || {});
}

export function phrasePatterns(page) {
  return (PAGES[page].id.patterns || []).map(p => [new RegExp(p[0]), p[1]]);
}
