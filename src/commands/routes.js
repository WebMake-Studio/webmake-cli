/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const ui = require('../ui');
const { c } = ui;
const { resolveSettings } = require('../config');
const { loadRuleset } = require('../detect');
const { plural } = require('../util');

function describe(rule) {
  return {
    from: rule.display,
    to: rule.to || null,
    status: rule.status,
    force: rule.force,
    kind: rule.kind,
    origin: rule.origin,
    query: rule.query,
    skipped: rule.unsupported || null,
  };
}

async function routes({ flags, positionals, cwd }) {
  if (positionals[0]) flags.dir = positionals[0];
  const settings = resolveSettings({ cwd, flags });
  const ruleset = loadRuleset(settings);

  if (flags.json) {
    const payload = {
      root: settings.root,
      spa: settings.spa,
      cleanUrls: settings.cleanUrls,
      files: ruleset.files.map((f) => ({ file: f.rel, type: f.type, format: f.label, rules: f.rules, headers: f.headers })),
      rules: ruleset.rules.map(describe),
      headers: ruleset.headers.map((h) => ({ path: h.pattern, values: h.values, origin: h.origin })),
      notFound: ruleset.notFound,
      fallback: ruleset.fallback ? { to: ruleset.fallback.to, origin: ruleset.fallback.origin } : null,
      warnings: [...settings.warnings, ...ruleset.warnings],
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const out = (s = '') => process.stdout.write(`${s}\n`);
  out('');
  out(`  ${c.bold('Detected files')}`);
  if (!ruleset.files.length) {
    out(`  ${c.muted('No redirect or header file found (looked for _redirects, _headers, netlify.toml, vercel.json,')}`);
    out(`  ${c.muted('firebase.json, staticwebapp.config.json and .htaccess).')}`);
  } else {
    for (const f of ruleset.files) {
      const parts = [];
      if (f.rules) parts.push(plural(f.rules, 'rule'));
      if (f.headers) parts.push(plural(f.headers, 'header block'));
      out(`  ${c.ok('✔')} ${ui.padEnd(f.rel, 28)} ${c.muted(ui.padEnd(f.label, 48))} ${parts.join(', ') || c.muted('empty')}`);
    }
  }

  if (ruleset.rules.length) {
    out('');
    out(`  ${c.bold('Rules')} ${c.muted('(first match wins; "!" = applies even if a file exists)')}`);
    const rows = ruleset.rules.map((r, i) => {
      const status = r.unsupported ? c.warn('skipped') : `${r.status >= 400 ? c.warn(r.status) : c.ok(r.status)}${r.force ? c.accent('!') : ''}`;
      const query = Object.keys(r.query).length ? c.muted(` ?${Object.entries(r.query).map(([k, v]) => `${k}=${v}`).join('&')}`) : '';
      return { n: c.muted(i + 1), from: r.display + query, to: r.to || c.muted('-'), status, kind: r.kind, origin: c.muted(r.origin) };
    });
    out(ui.table(rows, [
      { key: 'n', title: '#', align: 'right' },
      { key: 'from', title: 'FROM' },
      { key: 'to', title: 'TO' },
      { key: 'status', title: 'STATUS' },
      { key: 'kind', title: 'TYPE' },
      { key: 'origin', title: 'SOURCE' },
    ]));
    for (const r of ruleset.skipped) out(`  ${c.warn('▲')} ${c.muted(`${r.origin}: skipped - ${r.unsupported}`)}`);
  }

  if (ruleset.headers.length) {
    out('');
    out(`  ${c.bold('Headers')}`);
    for (const h of ruleset.headers) {
      out(`  ${c.soft(h.pattern)} ${c.muted(`(${h.origin})`)}`);
      for (const [k, v] of Object.entries(h.values)) out(`    ${c.muted(`${k}:`)} ${v}`);
    }
  }

  out('');
  out(`  ${c.bold('404 handling')}`);
  const nf = settings.notFound ? `${settings.notFound} (webmake.dev)` : ruleset.notFound ? `${ruleset.notFound.to} (${ruleset.notFound.origin})` : 'nearest 404.html, otherwise the built-in WebMake page';
  out(`  ${nf}`);
  if (settings.spa) out(`  ${c.muted('SPA fallback:')} ${typeof settings.spa === 'string' ? settings.spa : '200.html or index.html'}`);
  if (ruleset.fallback) out(`  ${c.muted('Navigation fallback:')} ${ruleset.fallback.to} ${c.muted(`(${ruleset.fallback.origin})`)}`);

  for (const w of [...settings.warnings, ...ruleset.warnings]) out(`  ${c.warn('▲')} ${c.warn(w)}`);
  out('');
}

module.exports = { routes };
