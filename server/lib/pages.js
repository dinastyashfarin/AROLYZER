// Small pages for the links inside emails (confirm, unsubscribe), in the site's look.
import { esc } from './html.js';

export function page({ lang = 'en', title, body, actions = '', nonce = '', script = '' }) {
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · AROLYZER</title>
<link rel="icon" type="image/webp" href="/assets/icon.webp">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=EB+Garamond:wght@400;500;600&display=swap">
<style>
:root{--bg:#EFFAF3;--card:#fff;--ink:#041B12;--ink2:#41594D;--act:#86D02E;--act-h:#76BE22;--line:rgba(4,27,18,.12)}
@media (prefers-color-scheme:dark){:root{--bg:#05140E;--card:#10271D;--ink:#E7F2EB;--ink2:#A2B7AA;--line:rgba(231,242,235,.14)}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;padding:24px 16px;background:var(--bg);color:var(--ink);font:19px/1.5 "EB Garamond",Georgia,serif}
main{width:100%;max-width:520px;background:var(--card);border-radius:14px;padding:40px 32px}
.mark{display:block;width:40px;height:auto;margin-bottom:24px}
h1{margin:0 0 12px;font:400 44px/1 "Bebas Neue","Arial Narrow",Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em;text-wrap:balance}
p{margin:0 0 24px;color:var(--ink2)}
.acts{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.btn{display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:10px;border:0;font:600 18px "EB Garamond",Georgia,serif;cursor:pointer;text-decoration:none;transition:background-color .2s cubic-bezier(.23,1,.32,1)}
.btn-act{background:var(--act);color:#041B12}.btn-act:hover{background:var(--act-h)}
.btn-line{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)}
form{margin:0}
</style></head>
<body><main>
<img class="mark" src="/assets/icon.webp" alt="AROLYZER" width="40" height="65">
<h1>${esc(title)}</h1>
<p>${esc(body)}</p>
<div class="acts">${actions}</div>
</main>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`;
}
