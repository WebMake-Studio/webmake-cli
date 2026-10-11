/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const { makeSite, cleanup } = require('./helpers');
const { parseArgs } = require('../src/cli');
const pkg = require('../package.json');

const BIN = path.join(__dirname, '..', 'bin', 'webmake.js');
const run = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });

test('parseArgs: commands, long/short options, negation, inline values', () => {
  const a = parseArgs(['dev', './site', '--port', '3000', '-H', '127.0.0.1', '--no-open', '--spa=app.html', '--poll=500', '-q']);
  assert.equal(a.command, 'dev');
  assert.deepEqual(a.positionals, ['./site']);
  assert.deepEqual(a.flags, { port: 3000, host: '127.0.0.1', open: false, spa: 'app.html', poll: 500, quiet: true });
  assert.deepEqual(parseArgs(['dev', '-p3001']).flags, { port: 3001 });
  assert.deepEqual(parseArgs(['dev', '--strict-port', '--watch', 'a', '--watch=b']).flags, { strictPort: true, watch: ['a', 'b'] });
  assert.deepEqual(parseArgs(['dev', '--spa']).flags, { spa: true });
});

test('parseArgs: helpful usage errors', () => {
  assert.throws(() => parseArgs(['dev', '--prot', '1']), (e) => e.exitCode === 2 && /--port/.test(e.hint));
  assert.throws(() => parseArgs(['dev', '--port', 'abc']), /expects a number/);
  assert.throws(() => parseArgs(['dev', '--host']), /needs a value/);
  assert.throws(() => parseArgs(['dev', '-Z']), /Unknown option/);
});

test('--version prints the package version', () => {
  const r = run(['--version']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test('help screens and unknown commands', () => {
  const help = run(['dev', '--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--port/);
  const bad = run(['sever']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Did you mean "webmake serve"|Did you mean "webmake dev"/);
  assert.equal(run([]).status, 0);
});

test('init creates webmake.dev that loads, and refuses to overwrite', (t) => {
  const dir = makeSite();
  t.after(() => cleanup(dir));
  assert.equal(run(['init'], dir).status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'webmake.dev')));
  const again = run(['init'], dir);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
  assert.equal(run(['init', '--force'], dir).status, 0);
  const routes = run(['routes', '--json'], dir);
  assert.equal(routes.status, 0, routes.stderr);
  assert.deepEqual(JSON.parse(routes.stdout).warnings, []);
});

test('routes --json lists detected files and rules', (t) => {
  const dir = makeSite({ '_redirects': '/a /b 301\n/fr/* /fr 200 Language=fr', 'vercel.json': '{"rewrites":[{"source":"/x","destination":"/y"}]}' });
  t.after(() => cleanup(dir));
  const out = JSON.parse(run(['routes', '--json'], dir).stdout);
  assert.deepEqual(out.files.map((f) => f.type), ['redirects', 'vercel']);
  assert.equal(out.rules.length, 3);
  assert.ok(out.rules[1].skipped);
  const text = run(['routes'], dir).stdout;
  assert.match(text, /_redirects/);
  assert.match(text, /skipped/);
});

test('build: copies the site, skips dev files, exports normalized redirects', (t) => {
  const dir = makeSite({
    'webmake.dev': "module.exports = { out: './dist' };",
    'index.html': 'home', 'css/a.css': 'a{}', '.env': 'SECRET=1', 'node_modules/x/index.js': 'x',
    '_redirects': '/old /new 301\n',
    'vercel.json': JSON.stringify({ redirects: [{ source: '/docs/:path*', destination: '/help/:path*', permanent: false }, { source: '/re/(\\d+)', destination: '/x/$1', permanent: true }] }),
    '_headers': '/*\n  X-B: 1\n',
  });
  t.after(() => cleanup(dir));
  const r = run(['build'], dir);
  assert.equal(r.status, 0, r.stderr);
  const dist = path.join(dir, 'dist');
  assert.ok(fs.existsSync(path.join(dist, 'index.html')));
  assert.ok(fs.existsSync(path.join(dist, 'css/a.css')));
  assert.ok(!fs.existsSync(path.join(dist, '.env')));
  assert.ok(!fs.existsSync(path.join(dist, 'node_modules')));
  assert.ok(!fs.existsSync(path.join(dist, 'webmake.dev')));
  const redirects = fs.readFileSync(path.join(dist, '_redirects'), 'utf8');
  assert.match(redirects, /^\/old \/new 301!?$/m);
  assert.match(redirects, /^\/docs\/\* \/help\/:splat 307!$/m);
  assert.doesNotMatch(redirects, /\/re\//, 'regex rules cannot be expressed and are not exported');
  assert.match(r.stderr, /not exported/);
  assert.match(fs.readFileSync(path.join(dist, '_headers'), 'utf8'), /\/\*\n {2}X-B: 1/);
  assert.equal(run(['build'], dir).status, 0);
  assert.ok(!fs.existsSync(path.join(dist, 'dist')));
});

test('build refuses dangerous output folders', (t) => {
  const dir = makeSite({ 'index.html': 'x' });
  t.after(() => cleanup(dir));
  const same = run(['build', '--out', '.'], dir);
  assert.equal(same.status, 1);
  assert.match(same.stderr, /same as the source/);
  const outside = run(['build', '--out', '../elsewhere'], dir);
  assert.equal(outside.status, 1);
  assert.match(outside.stderr, /outside the current directory|contains your source/);
  assert.ok(fs.existsSync(path.join(dir, 'index.html')));
});

test('dev: starts, serves requests, and stops when terminated', async (t) => {
  const dir = makeSite({ 'index.html': '<body>cli</body>' });
  t.after(() => cleanup(dir));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [BIN, 'dev', '--port', String(port), '--host', '127.0.0.1', '--no-open'], { cwd: dir, env: { ...process.env, NO_COLOR: '1', CI: '1' } });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const done = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
  t.after(() => child.kill('SIGKILL'));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`dev did not start:\n${log}`)), 8000);
    const check = () => { if (/Ready in/.test(log)) { clearTimeout(timer); resolve(); } };
    child.stdout.on('data', check);
    check();
  });
  const res = await fetch(`http://127.0.0.1:${port}/`);
  assert.match(await res.text(), /cli/);
  assert.match(log, /Local\s+http:\/\/localhost:/);

  child.kill('SIGTERM');
  const { code, signal } = await done;
  if (process.platform === 'win32') assert.ok(code === 0 || code === null || signal === 'SIGTERM');
  else assert.equal(code, 0);
});
