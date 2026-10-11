/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { makeSite, cleanup } = require('./helpers');
const { resolveSettings } = require('../src/config');
const { loadRuleset } = require('../src/detect');
const { Router } = require('../src/router');

function setup(files, flags = {}) {
  const dir = makeSite(files);
  const settings = resolveSettings({ cwd: dir, flags });
  const ruleset = loadRuleset(settings);
  const router = new Router(settings, () => ruleset);
  const get = (p, extra = {}) => router.resolve({ method: 'GET', pathname: p.split('?')[0], search: p.includes('?') ? `?${p.split('?')[1]}` : '', accept: 'text/html', ...extra });
  return { dir, get, router, ruleset, settings };
}

test('serves files, directory indexes and clean URLs', async (t) => {
  const s = setup({ 'index.html': 'home', 'about.html': 'about', 'docs/index.html': 'docs', 'img/a.png': 'x' });
  t.after(() => cleanup(s.dir));
  assert.equal((await s.get('/')).file, path.join(s.dir, 'index.html'));
  assert.equal((await s.get('/about')).file, path.join(s.dir, 'about.html'));
  assert.equal((await s.get('/about.html')).file, path.join(s.dir, 'about.html'));
  assert.equal((await s.get('/docs/')).file, path.join(s.dir, 'docs/index.html'));
  const slash = await s.get('/docs');
  assert.equal(slash.action, 'redirect');
  assert.equal(slash.location, '/docs/');
  assert.equal((await s.get('/img/a.png')).action, 'file');
});

test('cleanUrls: false disables extension-less URLs', async (t) => {
  const s = setup({ 'about.html': 'about' }, { cleanUrls: false });
  t.after(() => cleanup(s.dir));
  assert.equal((await s.get('/about')).action, 'notfound');
});

test('_redirects: redirect, splat, rewrite and shadowing semantics', async (t) => {
  const s = setup({
    '_redirects': '/old /new 301\n/blog/* /posts/:splat 302\n/app/* /app.html 200\n/exists /elsewhere 301\n/forced /elsewhere 301!\n',
    'app.html': 'app', 'exists': 'a real file', 'forced': 'real file too', 'elsewhere': 'e',
  });
  t.after(() => cleanup(s.dir));
  assert.deepEqual([(await s.get('/old')).status, (await s.get('/old')).location], [301, '/new']);
  assert.equal((await s.get('/blog/a/b')).location, '/posts/a/b');
  const rewrite = await s.get('/app/x/y');
  assert.deepEqual([rewrite.action, rewrite.status, rewrite.file], ['file', 200, path.join(s.dir, 'app.html')]);
  assert.equal((await s.get('/exists')).action, 'file', 'a normal rule never hides a real file');
  assert.equal((await s.get('/forced')).action, 'redirect', '"!" forces the rule');
});

test('redirect keeps the query string; external rewrites become proxies', async (t) => {
  const s = setup({ '_redirects': '/a /b 301\n/api/* https://api.example.com/:splat 200\n' });
  t.after(() => cleanup(s.dir));
  assert.equal((await s.get('/a?x=1')).location, '/b?x=1');
  const p = await s.get('/api/v1/users?limit=2');
  assert.deepEqual([p.action, p.target], ['proxy', 'https://api.example.com/v1/users?limit=2']);
});

test('captured values can never create an open redirect', async (t) => {
  const s = setup({ '_redirects': '/go/* /:splat 301\n' });
  t.after(() => cleanup(s.dir));
  const r = await s.get('/go//evil.com/path');
  assert.equal(r.location, '/evil.com/path');
});

test('404 handling: rule page, nearest 404.html, built-in', async (t) => {
  const a = setup({ 'index.html': 'x', '404.html': 'root 404', 'docs/404.html': 'docs 404' });
  t.after(() => cleanup(a.dir));
  assert.equal((await a.get('/missing')).file, path.join(a.dir, '404.html'));
  assert.equal((await a.get('/docs/missing')).file, path.join(a.dir, 'docs/404.html'));

  const b = setup({ 'index.html': 'x' });
  t.after(() => cleanup(b.dir));
  const nf = await b.get('/missing');
  assert.deepEqual([nf.action, nf.status, nf.file], ['notfound', 404, null]);

  const c = setup({ '_redirects': '/* /errors/nope.html 404\n', 'errors/nope.html': 'custom' });
  t.after(() => cleanup(c.dir));
  const r = await c.get('/anything');
  assert.deepEqual([r.action, r.status], ['file', 404]);
});

test('SPA mode: page-like URLs fall back, assets and non-HTML requests do not', async (t) => {
  const s = setup({ 'index.html': 'spa' }, { spa: true });
  t.after(() => cleanup(s.dir));
  const page = await s.get('/some/deep/route');
  assert.deepEqual([page.action, page.status, page.file], ['file', 200, path.join(s.dir, 'index.html')]);
  assert.equal((await s.get('/missing.js')).action, 'notfound');
  assert.equal((await s.get('/api/data', { accept: 'application/json' })).action, 'notfound');
  assert.equal((await s.get('/x', { method: 'POST' })).action, 'notfound');
});

test('SPA mode prefers 200.html and accepts a custom file', async (t) => {
  const a = setup({ 'index.html': 'i', '200.html': 'two hundred' }, { spa: true });
  t.after(() => cleanup(a.dir));
  assert.equal((await a.get('/route')).file, path.join(a.dir, '200.html'));
  const b = setup({ 'index.html': 'i', 'app.html': 'app' }, { spa: 'app.html' });
  t.after(() => cleanup(b.dir));
  assert.equal((await b.get('/route')).file, path.join(b.dir, 'app.html'));
});

test('security: traversal, hidden files, config files and bad encodings', async (t) => {
  const s = setup({ 'index.html': 'x', '.env': 'SECRET=1', '.git/config': 'c', '_redirects': '/a /b', 'webmake.dev': 'module.exports = {}' });
  t.after(() => cleanup(s.dir));
  for (const p of ['/.env', '/.git/config', '/_redirects', '/webmake.dev', '/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fetc/passwd']) {
    assert.equal((await s.get(p)).action, 'notfound', `${p} must not be served`);
  }
  assert.equal((await s.get('/%E0%A4%A')).status, 400);
  assert.equal((await s.get('/..%5Cwindows')).status, 400);
  assert.equal((await s.get('/a%00b')).status, 400);
});

test('directory listing is used only when there is no index and no fallback', async (t) => {
  const s = setup({ 'files/a.txt': 'a' });
  t.after(() => cleanup(s.dir));
  assert.equal((await s.get('/files/')).action, 'dir');
  const off = setup({ 'files/a.txt': 'a' }, { listing: false });
  t.after(() => cleanup(off.dir));
  assert.equal((await off.get('/files/')).action, 'notfound');
});

test('headers are collected from every matching header rule', async (t) => {
  const s = setup({ '_headers': '/*\n  X-All: 1\n/css/*\n  X-Css: 1\n' });
  t.after(() => cleanup(s.dir));
  assert.deepEqual(s.router.headersFor('/css/a.css'), { 'X-All': '1', 'X-Css': '1' });
  assert.deepEqual(s.router.headersFor('/index.html'), { 'X-All': '1' });
});

test('detection: alternative file names and several platforms at once', async (t) => {
  const s = setup({
    'redirects.txt': '/a /b 301',
    'headers': '/*\n  X-H: 1',
    'vercel.json': JSON.stringify({ redirects: [{ source: '/v', destination: '/x', permanent: true }] }),
    'firebase.json': JSON.stringify({ hosting: { redirects: [{ source: '/f', destination: '/y', type: 302 }] } }),
    '.htaccess': 'Redirect 301 /h /z',
  });
  t.after(() => cleanup(s.dir));
  assert.equal(s.ruleset.files.length, 5);
  assert.deepEqual(s.ruleset.rules.map((r) => r.display), ['/a', '/v', '/f', '/h/*']);
  assert.equal((await s.get('/h/page')).location, '/z/page');
});

test('inline redirects from webmake.dev are evaluated first', async (t) => {
  const s = setup({ '_redirects': '/a /from-file 301' }, { redirects: [{ from: '/a', to: '/from-config', status: 302 }] });
  t.after(() => cleanup(s.dir));
  const r = await s.get('/a');
  assert.deepEqual([r.status, r.location], [302, '/from-config']);
});
