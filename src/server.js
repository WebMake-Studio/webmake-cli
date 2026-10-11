/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const pkg = require('../package.json');
const { Router } = require('./router');
const { mimeFor, isHtml } = require('./mime');
const { isConfigFileName } = require('./detect');
const pages = require('./pages');
const { WebMakeError } = require('./errors');
const { isLocalAddress } = require('./net');

const NS = '/__webmake';
const HOP_BY_HOP = ['connection', 'proxy-connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'te', 'trailer'];

const CLIENT_JS = `(function(){
  if (window.__webmakeLive) return;
  window.__webmakeLive = true;
  var down = false;
  function swapCss(changed){
    var links = document.querySelectorAll('link[rel~="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var url;
      try { url = new URL(link.href, location.href); } catch (e) { continue; }
      if (url.origin !== location.origin) continue;
      if (changed && url.pathname !== changed && !changed.endsWith(url.pathname)) continue;
      var next = link.cloneNode();
      url.searchParams.set('_wm', Date.now());
      next.href = url.toString();
      (function(old, fresh){
        fresh.onload = function(){ old.remove(); };
        fresh.onerror = function(){ fresh.remove(); };
        old.parentNode.insertBefore(fresh, old.nextSibling);
      })(link, next);
    }
  }
  function connect(){
    var es = new EventSource('${NS}/events');
    es.addEventListener('open', function(){ if (down) location.reload(); });
    es.addEventListener('reload', function(){ location.reload(); });
    es.addEventListener('css', function(e){
      var path = null;
      try { path = JSON.parse(e.data).path; } catch (err) {}
      swapCss(path);
    });
    es.onerror = function(){ down = true; };
  }
  connect();
  console.log('%c WebMake %c live reload connected', 'background:#5b5bf0;color:#fff;border-radius:4px;padding:1px 4px', 'color:inherit');
})();
`;

const SNIPPET = `<script src="${NS}/client.js" defer></script>`;

function injectLiveReload(html) {
  const re = /<\/body\s*>/gi;
  let idx = -1;
  let m;
  while ((m = re.exec(html))) idx = m.index;
  return idx >= 0 ? `${html.slice(0, idx)}${SNIPPET}\n${html.slice(idx)}` : `${html}\n${SNIPPET}`;
}

function createDevServer({ settings, getRuleset, onRequest = () => {} }) {
  const router = new Router(settings, getRuleset);
  const clients = new Set();
  let heartbeat = null;

  function send(res, status, headers, body) {
    if (res.headersSent) { res.end(); return; }
    const extra = res.__extra || {};
    res.writeHead(status, { ...headers, ...extra });
    res.end(body);
  }

  function sendHtml(req, res, status, html) {
    const buf = Buffer.from(html);
    send(res, status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length }, req.method === 'HEAD' ? undefined : buf);
  }

  function sendError(req, res, status, opts = {}) {
    sendHtml(req, res, status, pages.errorPage({ status, method: req.method, ...opts }));
  }

  async function sendFile(req, res, file, status = 200) {
    let st;
    try { st = await fsp.stat(file); } catch { return sendError(req, res, 404, { pathname: req.__path }); }

    const headers = { 'Content-Type': mimeFor(file) };

    if (settings.livereload && isHtml(file)) {
      const html = injectLiveReload(await fsp.readFile(file, 'utf8'));
      const buf = Buffer.from(html);
      return send(res, status, { ...headers, 'Content-Length': buf.length }, req.method === 'HEAD' ? undefined : buf);
    }

    headers['Accept-Ranges'] = 'bytes';
    let start = 0;
    let end = st.size - 1;
    let code = status;
    const range = req.headers.range;
    if (range && status === 200) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m && (m[1] || m[2])) {
        if (m[1] === '') {
          start = Math.max(st.size - parseInt(m[2], 10), 0);
        } else {
          start = parseInt(m[1], 10);
          if (m[2]) end = Math.min(parseInt(m[2], 10), st.size - 1);
        }
        if (start > end || start >= st.size) {
          return send(res, 416, { 'Content-Range': `bytes */${st.size}` });
        }
        code = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
      }
    }
    headers['Content-Length'] = st.size === 0 ? 0 : end - start + 1;

    if (req.method === 'HEAD' || st.size === 0) return send(res, code, headers);

    res.writeHead(code, { ...headers, ...(res.__extra || {}) });
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  }

  function sendRedirect(req, res, status, location) {
    const body = `Redirecting to ${location}\n`;
    send(res, status, { Location: location, 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }, req.method === 'HEAD' ? undefined : body);
  }

  async function sendListing(req, res, dir, urlPath) {
    let names = [];
    try { names = await fsp.readdir(dir); } catch { return sendError(req, res, 404, { pathname: urlPath }); }
    const entries = [];
    for (const name of names) {
      if (name.startsWith('.') || isConfigFileName(name)) continue;
      try {
        const st = await fsp.stat(path.join(dir, name));
        entries.push({ name, dir: st.isDirectory(), size: st.size, mtime: st.mtime.toISOString().slice(0, 16).replace('T', ' ') });
      } catch { }
    }
    entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
    sendHtml(req, res, 200, pages.listingPage({ urlPath, entries }));
  }

  function proxy(req, res, target) {
    let url;
    try { url = new URL(target); } catch { return sendError(req, res, 502, { pathname: req.__path, detail: `Invalid proxy target: ${target}` }); }
    const lib = url.protocol === 'https:' ? https : http;
    const headers = { ...req.headers, host: url.host };
    for (const h of HOP_BY_HOP) delete headers[h];
    headers['x-forwarded-for'] = req.socket.remoteAddress || '';
    headers['x-forwarded-host'] = req.headers.host || '';
    headers['x-forwarded-proto'] = 'http';

    const upstream = lib.request(
      { protocol: url.protocol, hostname: url.hostname, port: url.port || undefined, path: `${url.pathname}${url.search}`, method: req.method, headers, timeout: 30000 },
      (up) => {
        const out = { ...up.headers };
        for (const h of HOP_BY_HOP) delete out[h];
        res.writeHead(up.statusCode || 502, { ...out, ...(res.__extra || {}) });
        up.pipe(res);
      },
    );
    upstream.on('timeout', () => upstream.destroy(new Error('the upstream server did not answer within 30 seconds')));
    upstream.on('error', (err) => {
      if (!res.headersSent) sendError(req, res, 502, { pathname: req.__path, detail: `${url.origin}: ${err.message}` });
      else res.destroy();
    });
    req.pipe(upstream);
  }

  function handleInternal(req, res, pathname) {
    if (pathname === `${NS}/client.js`) {
      return send(res, 200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }, CLIENT_JS);
    }
    if (pathname === `${NS}/events`) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 800\n\n');
      clients.add(res);
      res.on('close', () => clients.delete(res));
      return undefined;
    }
    if (pathname === `${NS}/routes`) {
      return sendHtml(req, res, 200, pages.routesPage({ settings, ruleset: getRuleset() }));
    }
    return sendError(req, res, 404, { pathname });
  }

  async function handle(req, res) {
    const started = process.hrtime.bigint();
    const notes = [];
    let internal = false;

    const raw = req.url || '/';
    const q = raw.indexOf('?');
    let rawPath = q < 0 ? raw : raw.slice(0, q);
    let search = q < 0 ? '' : raw.slice(q);
    if (!rawPath.startsWith('/')) {
      try { const u = new URL(raw); rawPath = u.pathname; search = u.search; } catch { rawPath = '/'; }
    }
    req.__path = rawPath;
    const method = (req.method || 'GET').toUpperCase();
    let logNote = '';

    res.once('finish', () => {
      if (internal) return;
      const ms = Number((process.hrtime.bigint() - started) / 1000000n);
      onRequest({ method, url: rawPath + search, status: res.statusCode, ms, note: [logNote, ...notes].filter(Boolean).join(' · ') });
    });

    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    if (settings.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
    }

    if (rawPath.startsWith(`${NS}/`)) { internal = true; return handleInternal(req, res, rawPath); }

    if (method === 'OPTIONS') return send(res, 204, { Allow: 'GET, HEAD, OPTIONS', 'Content-Length': 0 });

    let decoded = rawPath;
    try { decoded = decodeURIComponent(rawPath); } catch { }
    res.__extra = router.headersFor(decoded);

    const result = await router.resolve({ method, pathname: rawPath, search, accept: req.headers.accept || '', notes });
    logNote = result.note || '';
    const readOnly = method === 'GET' || method === 'HEAD';

    switch (result.action) {
      case 'file':
      case 'notfound':
        if (!readOnly && result.action === 'file') return sendError(req, res, 405, { pathname: decoded });
        if (result.action === 'notfound') {
          if (result.file) return sendFile(req, res, result.file, 404);
          return sendError(req, res, 404, { pathname: decoded });
        }
        return sendFile(req, res, result.file, result.status);
      case 'redirect':
        return sendRedirect(req, res, result.status, result.location);
      case 'proxy':
        return proxy(req, res, result.target);
      case 'dir':
        if (!readOnly) return sendError(req, res, 405, { pathname: decoded });
        return sendListing(req, res, result.dir, result.urlPath);
      case 'status':
        return sendError(req, res, result.status, { pathname: decoded });
      case 'error':
      default:
        return sendError(req, res, result.status || 500, { pathname: decoded, title: result.title, message: result.message });
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) {
        try { sendError(req, res, 500, { pathname: req.__path || '/', detail: err.message }); } catch { res.destroy(); }
      } else res.destroy();
      onRequest({ method: req.method, url: req.url, status: 500, ms: 0, note: `internal error: ${err.message}` });
    });
  });
  server.keepAliveTimeout = 5000;

  function listenOnce(port, host) {
    return new Promise((resolve, reject) => {
      const onError = (err) => { server.removeListener('listening', onListening); reject(err); };
      const onListening = () => { server.removeListener('error', onError); resolve(server.address().port); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    });
  }

  async function listen() {
    const notices = [];
    let host = settings.host;
    let port = settings.port;

    if (!isLocalAddress(host)) {
      notices.push(`Host ${host} is not an address of this computer, listening on 0.0.0.0 instead.`);
      host = '0.0.0.0';
    }

    const first = port;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const actual = await listenOnce(port, host);
        if (actual !== first && first !== 0) notices.push(`Port ${first} is already in use, using ${actual} instead.`);
        heartbeat = setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 20000);
        heartbeat.unref?.();
        return { port: actual, host, notices };
      } catch (err) {
        if (err.code === 'EADDRINUSE' && !settings.strictPort && first !== 0 && port < 65535) { port++; continue; }
        if (err.code === 'EADDRINUSE') {
          throw new WebMakeError(`Port ${port} is already in use.`, { hint: 'Stop the other program, choose another port with --port, or remove "strictPort" to pick a free one automatically.' });
        }
        if (err.code === 'EADDRNOTAVAIL' && host !== '0.0.0.0') {
          notices.push(`Cannot bind to ${host}, listening on 0.0.0.0 instead.`);
          host = '0.0.0.0';
          continue;
        }
        if (err.code === 'EACCES') {
          throw new WebMakeError(`Permission denied for port ${port}.`, { hint: 'Ports below 1024 need administrator rights. Try --port 8888.' });
        }
        throw err;
      }
    }
    throw new WebMakeError(`No free port found starting at ${first}.`, { hint: 'Free a port or choose another one with --port.' });
  }

  function broadcast(event, data = {}) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) c.write(payload);
  }

  function close() {
    return new Promise((resolve) => {
      clearInterval(heartbeat);
      for (const c of clients) c.end();
      clients.clear();
      server.close(() => resolve());
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    });
  }

  return { server, router, listen, broadcast, close, clientCount: () => clients.size };
}

module.exports = { createDevServer, injectLiveReload, CLIENT_JS };
