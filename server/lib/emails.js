// Email templates. Words come from content/<lang>/email.json; the newsletter body is Markdown
// written in the admin panel. Table layout and inline styles keep it readable in Gmail and Outlook.
import { marked } from 'marked';
import { esc } from './html.js';

const C = { bg: '#EFFAF3', card: '#FFFFFF', ink: '#041B12', ink2: '#41594D', teal: '#044B39', lime: '#86D02E', line: '#D7E9DE' };
const FONT = "Georgia,'Times New Roman',serif";

function layout({ cfg, site, lang, preheader, inner, footer }) {
  const logo = cfg.publicUrl + '/assets/email-wordmark-light.png';
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(site.name || 'AROLYZER')}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 8px 20px;"><a href="${esc(cfg.publicUrl)}"><img src="${logo}" width="180" alt="${esc(site.name || 'AROLYZER')}" style="display:block;border:0;height:auto;"></a></td></tr>
<tr><td style="background:${C.card};border-radius:14px;padding:36px 32px;font-family:${FONT};font-size:18px;line-height:1.55;color:${C.ink};">
${inner}
</td></tr>
<tr><td style="padding:20px 8px;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.ink2};">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="background:${C.lime};border-radius:10px;">
<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:18px;font-weight:bold;color:${C.ink};text-decoration:none;">${esc(label)}</a></td></tr></table>`;

const companyLine = site => [site.company && site.company.name, site.company && site.company.address].filter(Boolean).map(esc).join(' · ');

export function confirmEmail({ cfg, content, sub }) {
  const lang = sub.lang, c = (k, v) => content.copy(lang, 'confirm.' + k, v), site = content.site();
  const url = `${cfg.publicUrl}/confirm?token=${encodeURIComponent(sub.confirm_token)}`;
  const first = (sub.name || '').trim().split(/\s+/)[0] || (lang === 'id' ? 'Kak' : 'there');
  const inner = `<h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:${C.ink};">${esc(c('heading'))}</h1>
<p style="margin:0 0 12px;">${esc(c('greeting', { name: first }))}</p>
<p style="margin:0;">${esc(c('body'))}</p>
${button(url, c('button'))}
<p style="margin:0;font-size:15px;color:${C.ink2};">${esc(c('ignore'))}</p>`;
  return {
    subject: c('subject'),
    html: layout({ cfg, site, lang, preheader: c('preheader'), inner, footer: companyLine(site) }),
    text: `${c('greeting', { name: first })}\n\n${c('body')}\n\n${c('button')}: ${url}\n\n${c('ignore')}\n`,
  };
}

/** Markdown -> email HTML with brand styles applied inline */
export function renderMarkdown(md) {
  const html = marked.parse(md || '', { gfm: true, breaks: false });
  return html
    .replace(/<h1>/g, `<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:${C.ink};">`)
    .replace(/<h2>/g, `<h2 style="margin:28px 0 12px;font-size:22px;line-height:1.25;color:${C.ink};">`)
    .replace(/<h3>/g, `<h3 style="margin:24px 0 8px;font-size:19px;color:${C.ink};">`)
    .replace(/<p>/g, '<p style="margin:0 0 16px;">')
    .replace(/<ul>/g, '<ul style="margin:0 0 16px;padding-left:22px;">')
    .replace(/<ol>/g, '<ol style="margin:0 0 16px;padding-left:22px;">')
    .replace(/<li>/g, '<li style="margin:0 0 6px;">')
    .replace(/<a href=/g, `<a style="color:${C.teal};text-decoration:underline;" href=`)
    .replace(/<img /g, '<img style="max-width:100%;height:auto;border-radius:10px;display:block;margin:8px 0 16px;" ')
    .replace(/<blockquote>/g, `<blockquote style="margin:0 0 16px;padding:4px 0 4px 16px;border-left:3px solid ${C.lime};color:${C.ink2};">`)
    .replace(/<hr>/g, `<hr style="border:0;border-top:1px solid ${C.line};margin:28px 0;">`);
}

const toText = md => String(md || '')
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
  .replace(/^#{1,6}\s*/gm, '')
  .replace(/(\*\*|__)(.*?)\1/g, '$2');

/** Picks the Indonesian version for Indonesian subscribers when one was written */
export function pickVersion(nl, lang) {
  const useId = lang === 'id' && nl.subject_id && nl.subject_id.trim() && nl.body_id && nl.body_id.trim();
  return useId ? { lang: 'id', subject: nl.subject_id, body: nl.body_id } : { lang: 'en', subject: nl.subject_en, body: nl.body_en };
}

export function newsletterEmail({ cfg, content, nl, lang, token }) {
  const v = pickVersion(nl, lang), site = content.site();
  const unsub = `${cfg.publicUrl}/unsubscribe?token=${encodeURIComponent(token || 'preview')}`;
  const c = k => content.copy(v.lang, 'newsletter.' + k);
  const footer = `${esc(c('footer'))}<br><a href="${esc(unsub)}" style="color:${C.ink2};">${esc(c('unsubscribe'))}</a>${companyLine(site) ? '<br>' + companyLine(site) : ''}`;
  const firstPara = (v.body.split(/\n\s*\n/).find(p => p.trim() && !/^#|^!\[/.test(p.trim())) || '').replace(/[*_#>\[\]]/g, '').slice(0, 140);
  return {
    subject: v.subject,
    lang: v.lang,
    html: layout({ cfg, site, lang: v.lang, preheader: firstPara, inner: renderMarkdown(v.body), footer }),
    text: `${toText(v.body)}\n\n--\n${c('footer')}\n${c('unsubscribe')}: ${unsub}\n`,
    headers: {
      'List-Unsubscribe': `<${unsub}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
