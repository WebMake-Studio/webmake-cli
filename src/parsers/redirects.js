/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const { tryRule, tryHeaderRule } = require('../rules');

const isQueryToken = (tok) => /^[A-Za-z0-9_\-[\]]+=/.test(tok);

function parseRedirects(text, { file = '_redirects' } = {}) {
  const rules = [];
  const warnings = [];

  String(text).split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const origin = `${file}:${idx + 1}`;
    const tokens = line.split(/\s+/);

    const from = tokens[0];
    let i = 1;
    const query = {};
    while (i < tokens.length && isQueryToken(tokens[i])) {
      const eq = tokens[i].indexOf('=');
      query[tokens[i].slice(0, eq)] = tokens[i].slice(eq + 1);
      i++;
    }
    const to = tokens[i++];
    if (!to) {
      warnings.push(`${origin}: missing destination (expected "from to [status]")`);
      return;
    }

    let status = 301;
    let force = false;
    if (i < tokens.length && /^\d{3}!?$/.test(tokens[i])) {
      force = tokens[i].endsWith('!');
      status = parseInt(tokens[i], 10);
      i++;
    }

    const conditions = {};
    for (; i < tokens.length; i++) {
      const m = /^(\w+)=(.*)$/.exec(tokens[i]);
      if (m) conditions[m[1]] = m[2];
    }

    let unsupported = null;
    if (/^https?:\/\//i.test(from)) {
      unsupported = 'domain-level rule (host matching is not available in dev)';
    } else if (!from.startsWith('/')) {
      warnings.push(`${origin}: source "${from}" must start with "/"`);
      return;
    } else if (Object.keys(conditions).length) {
      unsupported = `condition ${Object.keys(conditions).join(', ')} is not evaluated in dev`;
    }

    const rule = tryRule({ from, to, status, force, query, unsupported, origin, file, style: 'netlify' }, warnings);
    if (rule) rules.push(rule);
  });

  return { rules, warnings };
}

function parseHeadersFile(text, { file = '_headers' } = {}) {
  const headers = [];
  const warnings = [];
  let current = null;

  String(text).split(/\r?\n/).forEach((raw, idx) => {
    if (!raw.trim() || raw.trim().startsWith('#')) return;
    const origin = `${file}:${idx + 1}`;
    if (/^\s/.test(raw)) {
      const t = raw.trim();
      if (!current) { warnings.push(`${origin}: header line without a path`); return; }
      if (t.startsWith('!')) return;
      const colon = t.indexOf(':');
      if (colon < 1) { warnings.push(`${origin}: expected "Name: value"`); return; }
      const name = t.slice(0, colon).trim();
      const value = t.slice(colon + 1).trim();
      current.values[name] = current.values[name] ? `${current.values[name]}, ${value}` : value;
    } else {
      current = { pattern: raw.trim(), values: {}, origin, file };
      headers.push(current);
    }
  });

  const out = [];
  for (const h of headers) {
    const rule = tryHeaderRule({ ...h, style: 'netlify' }, warnings);
    if (rule) out.push(rule);
  }
  return { headers: out, warnings };
}

module.exports = { parseRedirects, parseHeadersFile };
