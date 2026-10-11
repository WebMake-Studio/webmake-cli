/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { makeSite, cleanup } = require('./helpers');
const { startServer } = require('../src');

async function boot(files, options = {}) {
  const dir = makeSite(files);
  const app = await startServer({ cwd: dir, port: 0, host: '127.0.0.1', open: false, watch: false, ...options });
  const base = `http://127.0.0.1:${app.port}`;
  const get = (p, init = {}) => fetch(base + p, { redirect: 'manual', headers: { accept: 'text/html' }, ...init });
  const stop = async () => { await app.close(); cleanup(dir); };
  return { dir, app, base, get, stop };
}

test('serves HTML with live reload injected, and the client script', async () => {
  const s = await boot({ 'index.html': '<html><body><h1>Hi</h1></body></html>', 'a.txt': 'plain' });
  try {
    const html = await (await s.get('/')).text();
    assert.match(html, /<script src="\/__webmake\/client\.js" defer><\/script>\s*<\/body>/);
    assert.equal(await (await s.get('/a.txt')).text(), 'plain', 'non-HTML files are untouched');
    const js = await s.get('/__webmake/client.js');
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.match(await js.text(), /EventSource/);
  } finally { await s.stop(); }
});

test('livereload: false leaves HTML untouched', async () => {
  const s = await boot({ 'index.html': '<body>x</body>' }, { livereload: false });
  try { assert.equal(await (await s.get('/')).text(), '<body>x</body>'); } finally { await s.stop(); }
});

test('redirects, rewrites, status codes and custom headers', async () => {
  const s = await boot({
    '_redirects': '/old /new 301\n/app/* /app.html 200\n/gone /nothing 410\n',
    '_headers': '/*\n  X-Test: yes\n',
    'app.html': 'APP', '404.html': 'CUSTOM 404',
  });
  try {
    const r = await s.get('/old?x=1');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), '/new?x=1');
    assert.equal(r.headers.get('x-test'), 'yes');
    const rw = await s.get('/app/deep/route');
    assert.equal(rw.status, 200);
    assert.match(await rw.text(), /APP/);
    const nf = await s.get('/missing');
    assert.equal(nf.status, 404);
    assert.match(await nf.text(), /CUSTOM 404/);
  } finally { await s.stop(); }
});

test('built-in 404 page is branded and escapes the requested path (no XSS)', async () => {
  const s = await boot({ 'index.html': 'x' });
  try {
    const res = await s.get('/%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    const body = await res.text();
    assert.equal(res.status, 404);
    assert.match(body, /WebMake CLI/);
    assert.ok(!body.includes('<script>alert(1)'), 'path must be HTML-escaped');
    assert.match(body, /&lt;script&gt;/);
  } finally { await s.stop(); }
});

test('directory listing escapes names and hides config / dot files', async () => {
  const s = await boot({ 'files/a.txt': '1', 'files/.secret': 's', 'files/_redirects': '/a /b', 'files/a&b.txt': 'x', "files/it's.txt": 'y' });
  try {
    const body = await (await s.get('/files/')).text();
    assert.match(body, /a\.txt/);
    assert.ok(!body.includes('.secret'));
    assert.ok(!body.includes('_redirects'));
    assert.ok(!body.includes('a&b.txt'), 'raw ampersand must be escaped');
    assert.match(body, /a&amp;b\.txt/);
    assert.match(body, /it&#39;s\.txt/);
  } finally { await s.stop(); }
});

test('Range requests, HEAD and 405 for unsafe methods on files', async () => {
  const s = await boot({ 'data.bin': '0123456789' });
  try {
    const part = await s.get('/data.bin', { headers: { range: 'bytes=2-5' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await part.text(), '2345');
    const tail = await s.get('/data.bin', { headers: { range: 'bytes=-3' } });
    assert.equal(await tail.text(), '789');
    assert.equal((await s.get('/data.bin', { headers: { range: 'bytes=50-60' } })).status, 416);
    const head = await s.get('/data.bin', { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '10');
    assert.equal((await s.get('/data.bin', { method: 'POST' })).status, 405);
  } finally { await s.stop(); }
});

test('SSE endpoint streams reload events to connected browsers', async () => {
  const s = await boot({ 'index.html': 'x' });
  try {
    const received = await new Promise((resolve, reject) => {
      const req = http.get(`${s.base}/__webmake/events`, (res) => {
        assert.match(res.headers['content-type'], /text\/event-stream/);
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
          if (data.includes('event: reload')) { req.destroy(); resolve(data); }
        });
        setTimeout(() => s.app.reload(), 150);
      });
      req.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e); });
      setTimeout(() => reject(new Error('no SSE event received')), 3000);
    });
    assert.match(received, /event: reload/);
  } finally { await s.stop(); }
});

test('proxy rules forward to an upstream server', async () => {
  const upstream = http.createServer((req, res) => { res.setHeader('x-up', '1'); res.end(`upstream saw ${req.url}`); });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  const up = upstream.address().port;
  const s = await boot({ '_redirects': `/api/* http://127.0.0.1:${up}/:splat 200\n/dead/* http://127.0.0.1:1/:splat 200\n` });
  try {
    const ok = await s.get('/api/users?id=3');
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), 'upstream saw /users?id=3');
    const bad = await s.get('/dead/x');
    assert.equal(bad.status, 502);
  } finally { await s.stop(); upstream.close(); }
});

test('malformed and hostile URLs are rejected safely', async () => {
  const s = await boot({ 'index.html': 'x', '.env': 'SECRET' });
  try {
    assert.equal((await s.get('/%E0%A4%A')).status, 400);
    assert.equal((await s.get('/.env')).status, 404);
    assert.equal((await s.get('/%2e%2e/%2e%2e/etc/passwd')).status, 404);
  } finally { await s.stop(); }
});

test('CORS headers and OPTIONS when cors: true', async () => {
  const s = await boot({ 'index.html': 'x' }, { cors: true });
  try {
    const res = await s.get('/');
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.equal((await s.get('/', { method: 'OPTIONS' })).status, 204);
  } finally { await s.stop(); }
});

test('port fallback: a busy port moves to the next free one (unless strictPort)', async () => {
  const blocker = http.createServer();
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r));
  const busy = blocker.address().port;
  const dir = makeSite({ 'index.html': 'x' });
  try {
    const app = await startServer({ cwd: dir, port: busy, host: '127.0.0.1', open: false, watch: false });
    assert.notEqual(app.port, busy);
    assert.match(app.notices.join(' '), /already in use/);
    await app.close();
    await assert.rejects(startServer({ cwd: dir, port: busy, host: '127.0.0.1', open: false, watch: false, strictPort: true }), /already in use/);
  } finally { blocker.close(); cleanup(dir); }
});

test('a host that is not an address of this machine falls back to 0.0.0.0', async () => {
  const dir = makeSite({ 'index.html': 'x' });
  try {
    const app = await startServer({ cwd: dir, port: 0, host: '203.0.113.77', open: false, watch: false });
    assert.equal(app.host, '0.0.0.0');
    assert.match(app.notices[0], /not an address of this computer/);
    await app.close();
  } finally { cleanup(dir); }
});
