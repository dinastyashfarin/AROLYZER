import { phraseTable, phrasePatterns } from '../content.jsx';

// English -> Indonesian for text the form builds while it runs (built from content/id/waitlist.json)
export var WL_ID = phraseTable('waitlist');
export var WL_PAT = phrasePatterns('waitlist');

export var WL_ATTRS = ['aria-label', 'alt', 'title'];

export function wlTr(t) { var k = t.trim(); if (!k) return null; var v = Object.prototype.hasOwnProperty.call(WL_ID, k) ? WL_ID[k] : null; if (v == null) for (var i = 0; i < WL_PAT.length; i++) { var m = k.match(WL_PAT[i][0]); if (m) { v = WL_PAT[i][1].replace(/\$(\d)/g, function (_, n) { return m[+n]; }); break; } } if (v == null) return null; return t.match(/^\s*/)[0] + v + t.match(/\s*$/)[0]; }

export function wlApply(root, lang) {
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
  while ((n = w.nextNode())) {
    var e = n.parentElement; if (!e || e.closest('script,style,svg,[data-nt],input')) continue;
    var cur = n.nodeValue;
    if (lang === 'id') { if (cur === n.__id) continue; var t = wlTr(cur); if (t != null) { n.__en = cur; n.__id = t; n.nodeValue = t; } }
    else if (n.__id != null && cur === n.__id) { n.nodeValue = n.__en; n.__id = null; }
  }
  root.querySelectorAll('[aria-label],[alt],[title]').forEach(function (e) {
    if (e.closest('[data-nt]')) return;
    WL_ATTRS.forEach(function (a) { var v = e.getAttribute(a); if (v == null) return; var st = e.__i18n || (e.__i18n = {});
      if (lang === 'id') { if (st[a] && v === st[a].id) return; var t = wlTr(v); if (t != null) { st[a] = { en: v, id: t }; e.setAttribute(a, t); } }
      else if (st[a] && v === st[a].id) { e.setAttribute(a, st[a].en); delete st[a]; } });
  });
}
