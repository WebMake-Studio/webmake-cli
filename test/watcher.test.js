/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { makeSite, cleanup } = require('./helpers');
const { createWatcher, createIgnore } = require('../src/watcher');

const waitFor = (predicate, ms = 4000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const tick = () => {
    if (predicate()) return resolve();
    if (Date.now() - start > ms) return reject(new Error('timeout waiting for watcher event'));
    return setTimeout(tick, 25);
  };
  tick();
});

for (const poll of [false, true]) {
  test(`watcher (${poll ? 'poll' : 'native'}): detects add, change and removal, ignores node_modules`, async (t) => {
    const dir = makeSite({ 'a.txt': '1', 'sub/b.txt': '1', 'node_modules/m/i.js': 'x' });
    t.after(() => cleanup(dir));
    const seen = [];
    const w = createWatcher({
      paths: [dir],
      poll,
      interval: 50,
      debounce: 20,
      ignore: createIgnore({ base: dir, roots: [dir] }),
      onChange: (events) => seen.push(...events),
    });
    t.after(() => w.close());
    await new Promise((r) => setTimeout(r, 150));

    fs.writeFileSync(path.join(dir, 'a.txt'), 'changed');
    await waitFor(() => seen.some((e) => e.file === path.join(dir, 'a.txt')));

    fs.writeFileSync(path.join(dir, 'sub', 'new.txt'), 'n');
    await waitFor(() => seen.some((e) => e.file === path.join(dir, 'sub', 'new.txt')));

    fs.mkdirSync(path.join(dir, 'fresh'));
    await new Promise((r) => setTimeout(r, 200));
    fs.writeFileSync(path.join(dir, 'fresh', 'x.txt'), 'x');
    await waitFor(() => seen.some((e) => e.file === path.join(dir, 'fresh', 'x.txt')));

    fs.rmSync(path.join(dir, 'a.txt'));
    await waitFor(() => seen.some((e) => e.type === 'unlink' && e.file === path.join(dir, 'a.txt')));

    fs.writeFileSync(path.join(dir, 'node_modules', 'm', 'i.js'), 'y');
    await new Promise((r) => setTimeout(r, 300));
    assert.ok(!seen.some((e) => e.file.includes('node_modules')), 'node_modules must be ignored');
  });
}

test('watching a single file does not fire for its siblings', async (t) => {
  const dir = makeSite({ 'config.toml': 'a', 'other.txt': 'b' });
  t.after(() => cleanup(dir));
  const seen = [];
  const w = createWatcher({ paths: [path.join(dir, 'config.toml')], debounce: 20, onChange: (e) => seen.push(...e) });
  t.after(() => w.close());
  await new Promise((r) => setTimeout(r, 100));
  fs.writeFileSync(path.join(dir, 'other.txt'), 'changed');
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(seen.length, 0);
  fs.writeFileSync(path.join(dir, 'config.toml'), 'changed');
  await waitFor(() => seen.length > 0);
});

test('createIgnore: built-ins, user paths and protected roots', () => {
  const base = path.join(path.sep, 'p');
  const ignore = createIgnore({ extra: ['tmp', 'src/generated/'], base, roots: [base], out: path.join(base, 'dist') });
  assert.equal(ignore(path.join(base, 'node_modules')), true);
  assert.equal(ignore(path.join(base, '.git')), true);
  assert.equal(ignore(path.join(base, 'a.txt~')), true);
  assert.equal(ignore(path.join(base, 'tmp')), true);
  assert.equal(ignore(path.join(base, 'src', 'generated', 'x.js')), true);
  assert.equal(ignore(path.join(base, 'dist')), true);
  assert.equal(ignore(path.join(base, 'src', 'app.js')), false);
  assert.equal(ignore(base), false);
});
