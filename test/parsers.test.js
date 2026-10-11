/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const toml = require('../src/parsers/toml');
const { parseRedirects, parseHeadersFile } = require('../src/parsers/redirects');
const { parseNetlifyToml } = require('../src/parsers/netlify');
const { parseVercelJson } = require('../src/parsers/vercel');
const { parseFirebaseJson } = require('../src/parsers/firebase');
const { parseStaticWebAppConfig } = require('../src/parsers/swa');
const { parseHtaccess } = require('../src/parsers/htaccess');

const url = (rule, p, q = '') => rule.exec(p, new URLSearchParams(q));

test('_redirects: status, force flag, comments, default 301', () => {
  const { rules, warnings } = parseRedirects(`
# comment
/a  /b
/c  /d  302
/e  /f  200!
/api/*  https://api.example.com/:splat  200
`);
  assert.deepEqual(warnings, []);
  assert.deepEqual(rules.map((r) => [r.status, r.force, r.kind]), [
    [301, false, 'redirect'],
    [302, false, 'redirect'],
    [200, true, 'rewrite'],
    [200, false, 'proxy'],
  ]);
});

test('_redirects: query parameter matching', () => {
  const { rules } = parseRedirects('/store id=:id /products/:id 301');
  assert.equal(url(rules[0], '/store'), null);
  assert.equal(url(rules[0], '/store', 'id=7').named.id, '7');
});

test('_redirects: unsupported conditions are kept but never match', () => {
  const { rules } = parseRedirects('/fr/* /fr/index.html 200 Language=fr');
  assert.match(rules[0].unsupported, /Language/);
  assert.equal(url(rules[0], '/fr/x'), null);
});

test('_redirects: invalid lines produce warnings, not crashes', () => {
  const { rules, warnings } = parseRedirects('/only-from\nnot-a-path /x');
  assert.equal(rules.length, 0);
  assert.equal(warnings.length, 2);
});

test('_headers: groups headers by path and merges duplicates', () => {
  const { headers } = parseHeadersFile('/*\n  X-A: 1\n  X-A: 2\n/assets/*\n  Cache-Control: max-age=60\n');
  assert.equal(headers.length, 2);
  assert.equal(headers[0].values['X-A'], '1, 2');
  assert.ok(headers[1].matches('/assets/app.js'));
  assert.ok(!headers[1].matches('/other'));
});

test('toml: tables, arrays of tables, inline tables, multi-line arrays', () => {
  const { data, warnings } = toml.parse(`
[build]
publish = "dist"   # comment
[[redirects]]
from = "/a"
to = "/b"
status = 301
force = true
query = { id = ":id" }
[[redirects]]
from = "/c"
to = "/d"
[redirects.conditions]
Language = ["fr", "en"]
[[headers]]
for = "/*"
  [headers.values]
  "X-Frame-Options" = "DENY"
list = [
  "a",
  "b",
]
`);
  assert.deepEqual(warnings, []);
  assert.equal(data.build.publish, 'dist');
  assert.equal(data.redirects.length, 2);
  assert.deepEqual(data.redirects[0].query, { id: ':id' });
  assert.deepEqual(data.redirects[1].conditions.Language, ['fr', 'en']);
  assert.equal(data.headers[0].values['X-Frame-Options'], 'DENY');
});

test('toml: a broken line is reported and skipped', () => {
  const { data, warnings } = toml.parse('a = 1\nbroken line\nb = 2');
  assert.equal(data.a, 1);
  assert.equal(data.b, 2);
  assert.equal(warnings.length, 1);
});

test('toml: multi-line strings and escapes', () => {
  const { data } = toml.parse('cmd = """\nnpm run build\n"""\ns = "a\\tb"\n');
  assert.equal(data.cmd, 'npm run build\n');
  assert.equal(data.s, 'a\tb');
});

test('netlify.toml: redirects and headers become rules', () => {
  const { rules, headers, warnings } = parseNetlifyToml(`
[[redirects]]
from = "/old/*"
to = "/new/:splat"
status = 302
[[headers]]
for = "/*"
[headers.values]
X-Test = "1"
`);
  assert.deepEqual(warnings, []);
  assert.equal(rules[0].status, 302);
  assert.equal(headers[0].values['X-Test'], '1');
});

test('vercel.json: redirects are forced, rewrites are not, has/missing are skipped', () => {
  const { rules, headers } = parseVercelJson(JSON.stringify({
    redirects: [{ source: '/a', destination: '/b', permanent: true }, { source: '/c', destination: '/d', permanent: false }],
    rewrites: [{ source: '/app/:path*', destination: '/index.html' }, { source: '/x', destination: '/y', has: [{ type: 'host', value: 'a.com' }] }],
    headers: [{ source: '/(.*)', headers: [{ key: 'X-V', value: '1' }] }],
  }));
  assert.deepEqual(rules.map((r) => [r.status, r.force]), [[308, true], [307, true], [200, false], [200, false]]);
  assert.ok(rules[3].unsupported);
  assert.ok(headers[0].matches('/anything'));
  assert.ok(url(rules[2], '/app/a/b'));
});

test('vercel.json: invalid JSON yields a warning', () => {
  assert.match(parseVercelJson('{oops').warnings[0], /invalid JSON/);
});

test('firebase.json: redirects, rewrites, headers and unsupported function rewrites', () => {
  const { rules, headers } = parseFirebaseJson(JSON.stringify({
    hosting: {
      redirects: [{ source: '/old', destination: '/new', type: 301 }],
      rewrites: [{ source: '**', destination: '/index.html' }, { source: '/api/**', function: 'api' }],
      headers: [{ source: '**/*.js', headers: [{ key: 'Cache-Control', value: 'max-age=1' }] }],
    },
  }));
  assert.equal(rules[0].force, true);
  assert.ok(url(rules[1], '/anything/deep'));
  assert.match(rules[2].unsupported, /Function/);
  assert.ok(headers[0].matches('/a/b.js'));
});

test('staticwebapp.config.json: routes, navigationFallback, 404 override', () => {
  const { rules, fallback, notFound, headers } = parseStaticWebAppConfig(JSON.stringify({
    routes: [{ route: '/login', redirect: '/.auth/login', statusCode: 302 }, { route: '/app/*', rewrite: '/app.html' }],
    navigationFallback: { rewrite: '/index.html', exclude: ['/images/*.{png,gif}', '/css/*'] },
    responseOverrides: { 404: { rewrite: '/notfound.html' } },
    globalHeaders: { 'X-G': '1' },
  }));
  assert.deepEqual(rules.map((r) => r.status), [302, 200]);
  assert.equal(fallback.to, '/index.html');
  assert.equal(fallback.exclude.length, 3);
  assert.ok(fallback.exclude.some((m) => m.exec('/images/a.png')));
  assert.equal(notFound.to, '/notfound.html');
  assert.equal(headers[0].values['X-G'], '1');
});

test('.htaccess: Redirect, RedirectMatch, RewriteRule with conditions, ErrorDocument, Header', () => {
  const { rules, notFound, headers, warnings } = parseHtaccess(`
RewriteEngine On
<IfModule mod_rewrite.c>
Redirect 301 /old /new
Redirect gone /removed
RedirectMatch 302 ^/blog/(\\d+)$ /posts/$1
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L]
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://example.com/$1 [R=301,L]
</IfModule>
<FilesMatch "\\.(jpg)$">
Header set Ignored yes
</FilesMatch>
ErrorDocument 404 /404.html
Header always set X-Frame-Options "SAMEORIGIN"
`);
  assert.deepEqual(warnings, []);
  const old = url(rules[0], '/old/page');
  assert.ok(old);
  assert.equal(rules[0].status, 301);
  assert.equal(rules[1].status, 410);
  assert.equal(url(rules[2], '/blog/12').list[0], '12');
  assert.equal(rules[3].force, false, '!-f / !-d conditions make the rewrite non-forced');
  assert.ok(url(rules[3], '/anything'));
  assert.ok(rules[4].unsupported, 'HTTPS conditions cannot be evaluated in dev');
  assert.equal(notFound.to, '/404.html');
  assert.equal(headers.length, 1);
  assert.equal(headers[0].values['X-Frame-Options'], 'SAMEORIGIN');
});
