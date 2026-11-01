import { phraseTable, phrasePatterns } from '../content.jsx';

// English -> Indonesian for text the page builds while it runs (built from content/id/landing.json)
export var I18N_ID = phraseTable('landing');
export var I18N_PAT = phrasePatterns('landing');

export var I18N_ATTRS = ['aria-label', 'alt', 'aria-valuetext', 'title'];

export function i18nId(t) {
  var k = t.trim(); if (!k) return null;
  var v = Object.prototype.hasOwnProperty.call(I18N_ID, k) ? I18N_ID[k] : null;
  if (v == null) for (var i = 0; i < I18N_PAT.length; i++) { var m = k.match(I18N_PAT[i][0]); if (m) { v = I18N_PAT[i][1].replace(/\$(\d)/g, function (_, n) { return m[+n]; }); break; } }
  if (v == null) return null;
  var lead = t.match(/^\s*/)[0], tail = t.match(/\s*$/)[0];
  return lead + v + tail;
}

export function i18nSkip(n) { var e = n.nodeType === 1 ? n : n.parentElement; return !e || !!e.closest('script,style,svg,.odo,.tr,[data-nt]'); }

export function i18nApply(root, lang) {
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
  while ((n = w.nextNode())) {
    if (i18nSkip(n)) continue;
    var cur = n.nodeValue;
    if (lang === 'id') { if (cur === n.__id) continue; var t = i18nId(cur); if (t != null) { n.__en = cur; n.__id = t; n.nodeValue = t; } }
    else if (n.__id != null && cur === n.__id) { n.nodeValue = n.__en; n.__id = null; }
  }
  root.querySelectorAll('[aria-label],[alt],[aria-valuetext],[title]').forEach(function (e) {
    if (e.closest('[data-nt]')) return;
    I18N_ATTRS.forEach(function (a) {
      var v = e.getAttribute(a); if (v == null) return; var st = e.__i18n || (e.__i18n = {});
      if (lang === 'id') { if (st[a] && v === st[a].id) return; var t = i18nId(v); if (t != null) { st[a] = { en: v, id: t }; e.setAttribute(a, t); } }
      else if (st[a] && v === st[a].id) { e.setAttribute(a, st[a].en); delete st[a]; }
    });
  });
}
