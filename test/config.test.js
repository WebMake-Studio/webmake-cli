/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { makeSite, cleanup } = require('./helpers');
const { resolveSettings, DEFAULTS } = require('../src/config');

test('defaults: port 8888, IPv4 wildcard host, open browser', (t) => {
  const dir = makeSite();
  t.after(() => cleanup(dir));
  const s = resolveSettings({ cwd: dir });
  assert.equal(s.port, 8888);
  assert.equal(s.host, '0.0.0.0');
  assert.equal(s.open, true);
  assert.equal(s.spa, false);
  assert.equal(s.root, dir);
  assert.deepEqual(s.watch, [dir]);
  assert.equal(s.configFile, null);
  assert.equal(DEFAULTS.out, './dist');
});

test('loads the exact webmake.dev format from the project brief', (t) => {
  const dir = makeSite({
    'webmake.dev': `module.exports = {
    dir: './',
    out: './',
    port: 8888,
    host: '192.168.1.24',
    watch: '.',
    poll: false,
    spa: true,
    open: true,
};`,
  });
  t.after(() => cleanup(dir));
  const s = resolveSettings({ cwd: dir });
  assert.equal(s.configFile, path.join(dir, 'webmake.dev'));
  assert.equal(s.host, '192.168.1.24');
  assert.equal(s.spa, true);
  assert.deepEqual(s.watch, [dir]);
  assert.deepEqual(s.warnings, []);
});

test('command line flags override the file; paths resolve against the right base', (t) => {
  const dir = makeSite({ 'webmake.dev': "module.exports = { port: 3000, dir: './site' };", 'site/index.html': 'x' });
  t.after(() => cleanup(dir));
  const s = resolveSettings({ cwd: dir, flags: { port: 4000 } });
  assert.equal(s.port, 4000);
  assert.equal(s.root, path.join(dir, 'site'));
});

test('function export and JSON config are supported', (t) => {
  const a = makeSite({ 'webmake.dev': "module.exports = () => ({ port: 1234 });" });
  const b = makeSite({ 'webmake.config.json': '{ "port": 4321 }' });
  t.after(() => { cleanup(a); cleanup(b); });
  assert.equal(resolveSettings({ cwd: a }).port, 1234);
  assert.equal(resolveSettings({ cwd: b }).port, 4321);
});

test('invalid values are reported together, with exit code 2', (t) => {
  const dir = makeSite({ 'webmake.dev': "module.exports = { port: 'abc', spa: 5, watch: 12 };" });
  t.after(() => cleanup(dir));
  assert.throws(() => resolveSettings({ cwd: dir }), (err) => {
    assert.equal(err.exitCode, 2);
    assert.match(err.message, /"port"/);
    assert.match(err.message, /"spa"/);
    assert.match(err.message, /"watch"/);
    return true;
  });
});

test('unknown options produce a "did you mean" warning', (t) => {
  const dir = makeSite({ 'webmake.dev': "module.exports = { prot: 9000 };" });
  t.after(() => cleanup(dir));
  const s = resolveSettings({ cwd: dir });
  assert.match(s.warnings[0], /did you mean "port"/);
});

test('syntax errors and ES module syntax give actionable messages', (t) => {
  const a = makeSite({ 'webmake.dev': 'module.exports = {' });
  const b = makeSite({ 'webmake.dev': 'export default { port: 1 };' });
  t.after(() => { cleanup(a); cleanup(b); });
  assert.throws(() => resolveSettings({ cwd: a }), /Could not load webmake\.dev/);
  let loaded = null;
  try { loaded = resolveSettings({ cwd: b }); } catch (err) { assert.match(err.hint, /module\.exports/); }
  if (loaded) assert.equal(loaded.port, 1);
});

test('poll accepts a number and a missing --config file is a usage error', (t) => {
  const dir = makeSite({ 'webmake.dev': 'module.exports = { poll: 750 };' });
  t.after(() => cleanup(dir));
  const s = resolveSettings({ cwd: dir });
  assert.deepEqual([s.poll, s.pollInterval], [true, 750]);
  assert.throws(() => resolveSettings({ cwd: dir, flags: { config: 'nope.js' } }), (e) => e.exitCode === 2);
});

test('port as numeric string and range validation', (t) => {
  const dir = makeSite();
  t.after(() => cleanup(dir));
  assert.equal(resolveSettings({ cwd: dir, flags: { port: '3001' } }).port, 3001);
  assert.throws(() => resolveSettings({ cwd: dir, flags: { port: 70000 } }), /"port"/);
});
