/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const toml = require('./toml');
const { tryRule, tryHeaderRule } = require('../rules');

function parseNetlifyToml(text, { file = 'netlify.toml' } = {}) {
  const { data, warnings: tomlWarnings } = toml.parse(text);
  const warnings = tomlWarnings.map((w) => `${file}: ${w}`);
  const rules = [];
  const headers = [];

  (Array.isArray(data.redirects) ? data.redirects : []).forEach((r, idx) => {
    const origin = `${file} [[redirects]] #${idx + 1}`;
    if (!r || typeof r.from !== 'string' || typeof r.to !== 'string') {
      warnings.push(`${origin}: "from" and "to" are required`);
      return;
    }
    const conditions = r.conditions && typeof r.conditions === 'object' ? Object.keys(r.conditions) : [];
    const rule = tryRule(
      {
        from: r.from,
        to: r.to,
        status: Number.isInteger(r.status) ? r.status : 301,
        force: r.force === true,
        query: r.query && typeof r.query === 'object' ? r.query : {},
        unsupported: conditions.length ? `condition ${conditions.join(', ')} is not evaluated in dev` : null,
        origin,
        file,
        style: 'netlify',
      },
      warnings,
    );
    if (rule) rules.push(rule);
  });

  (Array.isArray(data.headers) ? data.headers : []).forEach((h, idx) => {
    const origin = `${file} [[headers]] #${idx + 1}`;
    if (!h || typeof h.for !== 'string' || !h.values || typeof h.values !== 'object') {
      warnings.push(`${origin}: "for" and [headers.values] are required`);
      return;
    }
    const values = {};
    for (const [k, v] of Object.entries(h.values)) values[k] = String(v);
    const rule = tryHeaderRule({ pattern: h.for, values, origin, file, style: 'netlify' }, warnings);
    if (rule) headers.push(rule);
  });

  return { rules, headers, warnings };
}

module.exports = { parseNetlifyToml };
