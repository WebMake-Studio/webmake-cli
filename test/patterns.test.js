/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compile, fill } = require('../src/patterns');

test('netlify: exact path, trailing slash and case are tolerated', () => {
  const m = compile('/about', { style: 'netlify', ignoreCase: true });
  assert.ok(m.exec('/about'));
  assert.ok(m.exec('/about/'));
  assert.ok(m.exec('/ABOUT'));
  assert.equal(m.exec('/about/x'), null);
});

test('netlify: splat and placeholders', () => {
  const splat = compile('/blog/*', { style: 'netlify' });
  assert.equal(splat.exec('/blog/a/b').named.splat, 'a/b');
  assert.equal(splat.exec('/blog/').named.splat, '');
  const ph = compile('/users/:id/posts/:post', { style: 'netlify' });
  const m = ph.exec('/users/42/posts/hello');
  assert.deepEqual({ ...m.named }, { id: '42', post: 'hello' });
  assert.equal(ph.exec('/users/42'), null);
});

test('netlify: "/*" matches everything', () => {
  const m = compile('/*', { style: 'netlify' });
  assert.ok(m.exec('/'));
  assert.ok(m.exec('/a/b/c'));
});

test('vercel: path-to-regexp modifiers', () => {
  const star = compile('/docs/:path*', { style: 'vercel' });
  assert.equal(star.exec('/docs/a/b').named.path, 'a/b');
  assert.ok(star.exec('/docs'), 'zero segments are allowed');
  const plus = compile('/docs/:path+', { style: 'vercel' });
  assert.ok(plus.exec('/docs/a'));
  assert.equal(plus.exec('/docs'), null);
  const custom = compile('/item/:id(\\d+)', { style: 'vercel' });
  assert.equal(custom.exec('/item/12').named.id, '12');
  assert.equal(custom.exec('/item/abc'), null);
  const raw = compile('/(.*)', { style: 'vercel' });
  assert.equal(raw.exec('/x/y').list[0], 'x/y');
});

test('firebase: glob syntax', () => {
  assert.ok(compile('/**', { style: 'firebase' }).exec('/a/b/c'));
  assert.ok(compile('**/*.html', { style: 'firebase' }).exec('/deep/page.html'));
  assert.equal(compile('/a/*', { style: 'firebase' }).exec('/a/b/c'), null);
  assert.ok(compile('/img/*.{png,jpg}', { style: 'firebase' }).exec('/img/x.jpg'));
  assert.equal(compile('/img/*.{png,jpg}', { style: 'firebase' }).exec('/img/x.gif'), null);
});

test('regex style with stripSlash (.htaccess)', () => {
  const m = compile('^blog/(.*)$', { style: 'regex', stripSlash: true });
  assert.equal(m.exec('/blog/hello').list[0], 'hello');
});

test('invalid patterns raise a readable error', () => {
  assert.throws(() => compile('/(unclosed', { style: 'vercel' }), /invalid pattern/);
});

test('fill: placeholders, splat and positional groups are substituted and encoded', () => {
  const m = compile('/old/*', { style: 'netlify' }).exec('/old/a b/c');
  assert.equal(fill('/new/:splat', m), '/new/a%20b/c');
  const r = compile('^/x/(\\d+)$', { style: 'regex' }).exec('/x/7');
  assert.equal(fill('/y/$1', r), '/y/7');
  assert.equal(fill('https://example.com:8080/:unknown', { named: {}, list: [] }), 'https://example.com:8080/:unknown');
});

test('fill: query characters in a capture cannot inject a query string', () => {
  const m = compile('/go/*', { style: 'netlify' }).exec('/go/a?b=1#x');
  assert.equal(fill('/t/:splat', m), '/t/a%3Fb=1%23x');
});
