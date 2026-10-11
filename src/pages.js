/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const pkg = require('../package.json');

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const CSS = `
:root{--bg:#ece9fe;--ink:#14123a;--soft:#5b5885;--accent:#3333e6;--card:rgba(255,255,255,.72);--line:#d6d1f5;--blob1:rgba(124,108,240,.38);--blob2:rgba(150,120,250,.28);--ok:#10b981;--warn:#f59e0b;--bad:#ef4444;--chip:#f3f1ff}
@media (prefers-color-scheme:dark){:root{--bg:#0c0b1d;--ink:#f2f0ff;--soft:#a8a4cf;--accent:#8c8cff;--card:rgba(255,255,255,.06);--line:rgba(255,255,255,.14);--blob1:rgba(91,91,240,.35);--blob2:rgba(139,92,246,.25);--chip:rgba(255,255,255,.07)}}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{font-family:"Outfit","Quicksand","Poppins",ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,-apple-system,sans-serif;color:var(--ink);background:radial-gradient(60vmax 60vmax at 4% 8%,var(--blob1),transparent 62%),radial-gradient(52vmax 52vmax at 98% 86%,var(--blob2),transparent 62%),var(--bg);background-attachment:fixed;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1040px;margin:0 auto;padding:28px 24px 56px}
.brand{display:inline-flex;align-items:center;gap:.6rem;padding:.55rem 1.1rem;border-radius:999px;background:var(--card);border:1px solid var(--line);font-weight:600;font-size:.95rem;text-decoration:none;color:var(--ink);backdrop-filter:blur(8px)}
.brand svg{width:22px;height:22px;stroke:var(--accent)}
h1{font-size:clamp(2.4rem,7vw,4.6rem);line-height:1.04;letter-spacing:-.025em;font-weight:600;margin:3.2rem 0 1rem}
h1 .accent,.accent{color:var(--accent)}
h2{font-size:1.1rem;margin:2rem 0 .8rem;letter-spacing:-.01em}
p.lead{font-size:1.15rem;color:var(--soft);max-width:34rem;margin:0 0 2rem}
.actions{display:flex;flex-wrap:wrap;gap:.8rem;margin-bottom:2.4rem}
.btn{display:inline-flex;align-items:center;padding:.85rem 1.6rem;border-radius:999px;background:var(--accent);color:#fff;font-weight:600;text-decoration:none;border:1px solid var(--accent);transition:transform .15s,box-shadow .15s}
.btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(51,51,230,.3)}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.stats{display:flex;flex-wrap:wrap;gap:0;margin-top:.5rem}
.stat{padding:0 1.4rem;border-left:1px solid var(--line)}
.stat:first-child{padding-left:0;border-left:0}
.stat b{display:block;font-size:1.5rem;font-weight:600}
.stat span{font-size:.8rem;color:var(--soft)}
.window{border-radius:16px;background:var(--card);border:1px solid var(--line);box-shadow:0 18px 50px rgba(60,50,160,.14);overflow:hidden;backdrop-filter:blur(10px);margin-top:1.6rem}
.bar{display:flex;align-items:center;gap:7px;padding:.7rem 1rem;border-bottom:1px solid var(--line);background:var(--chip)}
.bar i{width:11px;height:11px;border-radius:50%;display:block}
.bar i:nth-child(1){background:#ff5f57}.bar i:nth-child(2){background:#febc2e}.bar i:nth-child(3){background:#28c840}
.bar span{margin-left:.7rem;font-size:.82rem;color:var(--soft);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.body{padding:.4rem 0}
table{width:100%;border-collapse:collapse;font-size:.92rem}
th{text-align:left;font-weight:500;color:var(--soft);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;padding:.7rem 1.1rem}
td{padding:.62rem 1.1rem;border-top:1px solid var(--line);vertical-align:top}
td a{color:var(--ink);text-decoration:none;font-weight:500}
td a:hover{color:var(--accent)}
td.num,th.num{text-align:right;white-space:nowrap}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em}
.chip{display:inline-block;padding:.12rem .6rem;border-radius:999px;background:var(--chip);border:1px solid var(--line);font-size:.78rem;color:var(--soft)}
.chip.ok{color:var(--ok)}.chip.warn{color:var(--warn)}.chip.bad{color:var(--bad)}
.muted{color:var(--soft)}
footer{margin-top:3rem;font-size:.82rem;color:var(--soft)}
@media (max-width:640px){.wrap{padding:18px 16px 40px}td,th{padding:.55rem .7rem}.stat{padding:0 .9rem}}
`;

const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 5.5 7 18.5l4-9 4 9 4.5-13"/></svg>';

function layout({ title, body, path = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · WebMake CLI</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<a class="brand" href="/">${LOGO}<span>WebMake CLI</span></a>
${body}
<footer>WebMake CLI v${esc(pkg.version)} · development server${path ? ` · ${esc(path)}` : ''} · © 2026 FarTekTV</footer>
</div>
</body>
</html>`;
}

const REASONS = {
  400: ['Bad', 'request', 'The server could not understand this request.'],
  401: ['Sign-in', 'required', 'This page is protected by a rule in your configuration.'],
  403: ['Access', 'forbidden', 'A rule in your configuration forbids access to this URL.'],
  404: ['Page', 'not found', 'There is no file or rule that matches this URL.'],
  405: ['Method', 'not allowed', 'The development server only serves files with GET, HEAD and OPTIONS.'],
  410: ['Page', 'gone', 'A rule in your configuration marks this URL as permanently removed.'],
  500: ['Server', 'error', 'Something went wrong while handling this request.'],
  502: ['Bad', 'gateway', 'The upstream server of a proxy rule could not be reached.'],
};

function errorPage({ status = 404, method = 'GET', pathname = '/', message, detail, title }) {
  const [first, second, defaultMessage] = REASONS[status] || ['Unexpected', 'response', 'The server answered with an unusual status.'];
  const body = `
<h1>${esc(title || first)} <span class="accent">${esc(title ? '' : second)}</span></h1>
<p class="lead">${esc(message || defaultMessage)}</p>
<div class="actions">
  <a class="btn" href="/">Back to home</a>
  <a class="btn ghost" href="/__webmake/routes">View detected routes</a>
</div>
<div class="stats">
  <div class="stat"><b>${esc(status)}</b><span>Status</span></div>
  <div class="stat"><b>${esc(method)}</b><span>Method</span></div>
  <div class="stat"><b class="mono" style="font-size:1.05rem;word-break:break-all">${esc(pathname)}</b><span>Requested path</span></div>
</div>
${detail ? `<div class="window"><div class="bar"><i></i><i></i><i></i><span>details</span></div><div class="body"><p class="muted" style="padding:.4rem 1.1rem;margin:.6rem 0">${esc(detail)}</p></div></div>` : ''}
<p class="muted" style="margin-top:2rem;font-size:.9rem">Tip: add a <code>404.html</code> to your site (or a rule such as <code>/* /404.html 404</code> in <code>_redirects</code>) to replace this page.</p>`;
  return layout({ title: `${status} ${first} ${second}`, body, path: pathname });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function listingPage({ urlPath, entries }) {
  const base = urlPath.endsWith('/') ? urlPath : `${urlPath}/`;
  const parent = urlPath === '/' ? '' : `<tr><td colspan="3"><a href="${esc(base.replace(/[^/]+\/$/, ''))}">↩ Parent folder</a></td></tr>`;
  const rows = entries
    .map((e) => {
      const href = `${base}${encodeURIComponent(e.name)}${e.dir ? '/' : ''}`;
      return `<tr><td><a href="${esc(href)}">${e.dir ? '📁' : '·'} ${esc(e.name)}${e.dir ? '/' : ''}</a></td><td class="num muted">${e.dir ? '—' : formatSize(e.size)}</td><td class="num muted">${esc(e.mtime)}</td></tr>`;
    })
    .join('');
  const body = `
<h1>Index of <span class="accent">${esc(urlPath)}</span></h1>
<p class="lead">This folder has no <code>index.html</code>, so WebMake lists its content.</p>
<div class="window"><div class="bar"><i></i><i></i><i></i><span>${esc(urlPath)}</span></div>
<div class="body"><table><thead><tr><th>Name</th><th class="num">Size</th><th class="num">Modified</th></tr></thead><tbody>${parent}${rows || '<tr><td colspan="3" class="muted">This folder is empty.</td></tr>'}</tbody></table></div></div>`;
  return layout({ title: `Index of ${urlPath}`, body, path: urlPath });
}

function routesPage({ settings, ruleset }) {
  const files = ruleset.files
    .map((f) => `<tr><td class="mono">${esc(f.rel)}</td><td>${esc(f.label)}</td><td class="num">${f.rules}</td><td class="num">${f.headers}</td></tr>`)
    .join('');
  const rules = ruleset.rules
    .map((r, i) => {
      const status = r.unsupported ? `<span class="chip warn" title="${esc(r.unsupported)}">skipped</span>` : `<span class="chip ${r.status >= 400 ? 'bad' : 'ok'}">${esc(r.status)}${r.force ? '!' : ''}</span>`;
      return `<tr><td class="num muted">${i + 1}</td><td class="mono">${esc(r.display)}</td><td class="mono">${esc(r.to || '—')}</td><td>${status}</td><td>${esc(r.kind)}</td><td class="muted mono">${esc(r.origin)}${r.unsupported ? `<br>${esc(r.unsupported)}` : ''}</td></tr>`;
    })
    .join('');
  const headers = ruleset.headers
    .map((h) => `<tr><td class="mono">${esc(h.pattern)}</td><td class="mono">${Object.entries(h.values).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join('<br>')}</td><td class="muted mono">${esc(h.origin)}</td></tr>`)
    .join('');
  const empty = (cols, text) => `<tr><td colspan="${cols}" class="muted">${text}</td></tr>`;
  const body = `
<h1>Detected <span class="accent">routes</span></h1>
<p class="lead">Rules are evaluated top to bottom, the first match wins. Normal rules only apply when no file exists at the path; forced rules (<code>!</code>) always apply.</p>
<div class="stats">
  <div class="stat"><b>${ruleset.rules.length}</b><span>Rules</span></div>
  <div class="stat"><b>${ruleset.headers.length}</b><span>Header blocks</span></div>
  <div class="stat"><b>${ruleset.files.length}</b><span>Config files</span></div>
  <div class="stat"><b>${settings.spa ? 'on' : 'off'}</b><span>SPA mode</span></div>
</div>
<h2>Configuration files</h2>
<div class="window"><div class="bar"><i></i><i></i><i></i><span>detected files</span></div><div class="body"><table><thead><tr><th>File</th><th>Format</th><th class="num">Rules</th><th class="num">Headers</th></tr></thead><tbody>${files || empty(4, 'No redirect or header file found.')}</tbody></table></div></div>
<h2>Rules</h2>
<div class="window"><div class="bar"><i></i><i></i><i></i><span>redirects &amp; rewrites</span></div><div class="body"><table><thead><tr><th class="num">#</th><th>From</th><th>To</th><th>Status</th><th>Type</th><th>Source</th></tr></thead><tbody>${rules || empty(6, 'No rules.')}</tbody></table></div></div>
<h2>Headers</h2>
<div class="window"><div class="bar"><i></i><i></i><i></i><span>custom headers</span></div><div class="body"><table><thead><tr><th>Path</th><th>Headers</th><th>Source</th></tr></thead><tbody>${headers || empty(3, 'No custom headers.')}</tbody></table></div></div>`;
  return layout({ title: 'Detected routes', body, path: '/__webmake/routes' });
}

module.exports = { errorPage, listingPage, routesPage, esc };
