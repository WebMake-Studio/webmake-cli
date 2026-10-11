/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const { tryRule, tryHeaderRule } = require('../rules');

function dialect(entry) {
  if (typeof entry.regex === 'string') return { pattern: entry.regex, style: 'regex' };
  const source = entry.source || '';
  return { pattern: source, style: source.includes(':') ? 'vercel' : 'firebase' };
}

function parseFirebaseJson(text, { file = 'firebase.json' } = {}) {
  const rules = [];
  const headers = [];
  const warnings = [];
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch (err) {
    return { rules, headers, warnings: [`${file}: invalid JSON (${err.message})`] };
  }
  const hostingList = cfg && cfg.hosting ? (Array.isArray(cfg.hosting) ? cfg.hosting : [cfg.hosting]) : [];
  if (hostingList.length > 1) warnings.push(`${file}: multiple hosting targets found, rules from all of them are merged`);

  hostingList.forEach((hosting, h) => {
    const prefix = hostingList.length > 1 ? `${file} hosting[${h}]` : file;

    (Array.isArray(hosting.redirects) ? hosting.redirects : []).forEach((r, idx) => {
      const origin = `${prefix} redirects[${idx}]`;
      const { pattern, style } = dialect(r || {});
      if (!pattern || !r.destination) { warnings.push(`${origin}: "source" (or "regex") and "destination" are required`); return; }
      const rule = tryRule(
        { from: pattern, to: r.destination, status: Number.isInteger(r.type) ? r.type : 301, force: true, style, origin, file },
        warnings,
      );
      if (rule) rules.push(rule);
    });

    (Array.isArray(hosting.rewrites) ? hosting.rewrites : []).forEach((r, idx) => {
      const origin = `${prefix} rewrites[${idx}]`;
      const { pattern, style } = dialect(r || {});
      if (!pattern) { warnings.push(`${origin}: "source" (or "regex") is required`); return; }
      const unsupported = r.destination
        ? null
        : r.function ? 'Cloud Function rewrites cannot run in dev'
          : r.run ? 'Cloud Run rewrites cannot run in dev'
            : r.dynamicLinks ? 'Dynamic Links rewrites cannot run in dev' : 'rewrite without a destination';
      const rule = tryRule(
        { from: pattern, to: r.destination || '', status: 200, force: false, style, unsupported, origin, file },
        warnings,
      );
      if (rule) rules.push(rule);
    });

    (Array.isArray(hosting.headers) ? hosting.headers : []).forEach((hd, idx) => {
      const origin = `${prefix} headers[${idx}]`;
      const { pattern, style } = dialect(hd || {});
      if (!pattern) { warnings.push(`${origin}: "source" (or "regex") is required`); return; }
      const values = {};
      for (const e of Array.isArray(hd.headers) ? hd.headers : []) if (e && e.key) values[e.key] = String(e.value);
      const rule = tryHeaderRule({ pattern, values, style, origin, file }, warnings);
      if (rule) headers.push(rule);
    });
  });

  return { rules, headers, warnings };
}

module.exports = { parseFirebaseJson };
