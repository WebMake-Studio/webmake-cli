/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { Rule, HeaderRule, tryRule, tryHeaderRule } = require('./rules');
const { parseRedirects, parseHeadersFile } = require('./parsers/redirects');
const { parseNetlifyToml } = require('./parsers/netlify');
const { parseVercelJson } = require('./parsers/vercel');
const { parseFirebaseJson } = require('./parsers/firebase');
const { parseStaticWebAppConfig } = require('./parsers/swa');
const { parseHtaccess } = require('./parsers/htaccess');

const MAX_CONFIG_BYTES = 2 * 1024 * 1024;

const NAMES = {
  redirects: ['_redirects', 'redirects', '.redirects', '_redirect', 'redirect', 'redirects.txt', '_redirects.txt', '.redirects.txt'],
  headers: ['_headers', 'headers', '.headers', '_header', '_headers.txt', 'headers.txt', '.headers.txt'],
  netlify: ['netlify.toml'],
  vercel: ['vercel.json', 'now.json'],
  firebase: ['firebase.json'],
  swa: ['staticwebapp.config.json'],
  htaccess: ['.htaccess'],
};

const LABELS = {
  redirects: '_redirects (Netlify / Cloudflare Pages)',
  headers: '_headers (Netlify / Cloudflare Pages)',
  netlify: 'netlify.toml (Netlify)',
  vercel: 'vercel.json (Vercel)',
  firebase: 'firebase.json (Firebase Hosting)',
  swa: 'staticwebapp.config.json (Azure Static Web Apps)',
  htaccess: '.htaccess (Apache)',
};

const ORDER = ['redirects', 'netlify', 'vercel', 'firebase', 'swa', 'htaccess', 'headers'];

const WEBMAKE_FILES = ['webmake.dev', 'webmake.dev.js', 'webmake.config.js', 'webmake.config.json'];

const TYPE_BY_NAME = new Map();
for (const [type, names] of Object.entries(NAMES)) for (const n of names) TYPE_BY_NAME.set(n, type);

const classify = (name) => TYPE_BY_NAME.get(String(name).toLowerCase()) || null;

function isConfigFileName(name) {
  const lower = String(name).toLowerCase();
  return TYPE_BY_NAME.has(lower) || WEBMAKE_FILES.includes(lower);
}

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

function discover(settings) {
  const candidates = [settings.root, settings.cwd, path.join(settings.cwd, 'public'), path.join(settings.cwd, 'static')];
  const roots = [...new Set(candidates)].filter(isDir);
  const seen = new Set();
  const found = [];
  for (const root of roots) {
    let names;
    try { names = fs.readdirSync(root); } catch { continue; }
    for (const name of names) {
      const type = classify(name);
      if (!type) continue;
      const abs = path.join(root, name);
      if (!isFile(abs)) continue;
      let key = abs;
      try { key = fs.realpathSync(abs); } catch { }
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ abs, rel: path.relative(settings.cwd, abs) || name, type });
    }
  }
  return found.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
}

class RuleSet {
  constructor() {
    this.rules = [];
    this.headers = [];
    this.notFound = null;
    this.fallback = null;
    this.files = [];
    this.warnings = [];
  }

  get skipped() {
    return this.rules.filter((r) => r.unsupported);
  }
}

function parseByType(type, text, rel) {
  switch (type) {
    case 'redirects': return parseRedirects(text, { file: rel });
    case 'headers': return parseHeadersFile(text, { file: rel });
    case 'netlify': return parseNetlifyToml(text, { file: rel });
    case 'vercel': return parseVercelJson(text, { file: rel });
    case 'firebase': return parseFirebaseJson(text, { file: rel });
    case 'swa': return parseStaticWebAppConfig(text, { file: rel });
    case 'htaccess': return parseHtaccess(text, { file: rel });
    default: return { rules: [], headers: [], warnings: [] };
  }
}

function loadRuleset(settings) {
  const rs = new RuleSet();

  (settings.redirects || []).forEach((r, idx) => {
    const origin = `webmake.dev redirects[${idx}]`;
    if (!r || typeof r.from !== 'string' || typeof r.to !== 'string') {
      rs.warnings.push(`${origin}: "from" and "to" are required`);
      return;
    }
    const rule = tryRule({ from: r.from, to: r.to, status: r.status, force: r.force, origin, file: 'webmake.dev', style: 'netlify' }, rs.warnings);
    if (rule) rs.rules.push(rule);
  });
  (settings.headers || []).forEach((h, idx) => {
    const origin = `webmake.dev headers[${idx}]`;
    if (!h || typeof h.for !== 'string' || !h.values || typeof h.values !== 'object') {
      rs.warnings.push(`${origin}: "for" and "values" are required`);
      return;
    }
    const hr = tryHeaderRule({ pattern: h.for, values: h.values, origin, file: 'webmake.dev', style: 'netlify' }, rs.warnings);
    if (hr) rs.headers.push(hr);
  });

  for (const file of discover(settings)) {
    let text;
    try {
      const size = fs.statSync(file.abs).size;
      if (size > MAX_CONFIG_BYTES) { rs.warnings.push(`${file.rel}: file is larger than 2 MB, ignored`); continue; }
      text = fs.readFileSync(file.abs, 'utf8').replace(/^﻿/, '');
    } catch (err) {
      rs.warnings.push(`${file.rel}: cannot be read (${err.message})`);
      continue;
    }
    const parsed = parseByType(file.type, text, file.rel);
    const rules = parsed.rules || [];
    const headers = parsed.headers || [];
    rs.rules.push(...rules);
    rs.headers.push(...headers);
    rs.warnings.push(...(parsed.warnings || []));
    if (parsed.notFound && !rs.notFound) rs.notFound = parsed.notFound;
    if (parsed.fallback && !rs.fallback) rs.fallback = parsed.fallback;
    rs.files.push({ ...file, label: LABELS[file.type], rules: rules.length, headers: headers.length });
  }

  return rs;
}

module.exports = { loadRuleset, discover, classify, isConfigFileName, RuleSet, NAMES, LABELS, WEBMAKE_FILES, Rule, HeaderRule };
