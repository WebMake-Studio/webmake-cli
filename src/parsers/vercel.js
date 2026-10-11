/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const { tryRule, tryHeaderRule } = require('../rules');

function conditionNote(entry) {
  const parts = [];
  if (Array.isArray(entry.has) && entry.has.length) parts.push('has');
  if (Array.isArray(entry.missing) && entry.missing.length) parts.push('missing');
  return parts.length ? `"${parts.join('/')}" conditions are not evaluated in dev` : null;
}

function headerValues(list) {
  const values = {};
  for (const h of Array.isArray(list) ? list : []) {
    if (h && h.key) values[h.key] = String(h.value);
  }
  return values;
}

function parseVercelJson(text, { file = 'vercel.json' } = {}) {
  const rules = [];
  const headers = [];
  const warnings = [];
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch (err) {
    return { rules, headers, warnings: [`${file}: invalid JSON (${err.message})`] };
  }
  if (!cfg || typeof cfg !== 'object') return { rules, headers, warnings };

  (Array.isArray(cfg.redirects) ? cfg.redirects : []).forEach((r, idx) => {
    const origin = `${file} redirects[${idx}]`;
    if (!r || !r.source || !r.destination) { warnings.push(`${origin}: "source" and "destination" are required`); return; }
    const status = Number.isInteger(r.statusCode) ? r.statusCode : r.permanent === false ? 307 : 308;
    const rule = tryRule(
      { from: r.source, to: r.destination, status, force: true, style: 'vercel', unsupported: conditionNote(r), origin, file },
      warnings,
    );
    if (rule) rules.push(rule);
  });

  (Array.isArray(cfg.rewrites) ? cfg.rewrites : []).forEach((r, idx) => {
    const origin = `${file} rewrites[${idx}]`;
    if (!r || !r.source || !r.destination) { warnings.push(`${origin}: "source" and "destination" are required`); return; }
    const rule = tryRule(
      { from: r.source, to: r.destination, status: 200, force: false, style: 'vercel', unsupported: conditionNote(r), origin, file },
      warnings,
    );
    if (rule) rules.push(rule);
  });

  (Array.isArray(cfg.headers) ? cfg.headers : []).forEach((h, idx) => {
    const origin = `${file} headers[${idx}]`;
    if (!h || !h.source) { warnings.push(`${origin}: "source" is required`); return; }
    const rule = tryHeaderRule({ pattern: h.source, values: headerValues(h.headers), style: 'vercel', origin, file }, warnings);
    if (rule) headers.push(rule);
  });

  if (Array.isArray(cfg.routes)) {
    let afterFilesystem = false;
    cfg.routes.forEach((r, idx) => {
      const origin = `${file} routes[${idx}]`;
      if (!r) return;
      if (r.handle) { if (r.handle === 'filesystem') afterFilesystem = true; return; }
      if (!r.src) return;
      const src = r.src.startsWith('^') ? r.src : `^${r.src}`;
      const pattern = src.endsWith('$') ? src : `${src}$`;
      if (r.headers && !r.dest) {
        const rule = tryHeaderRule({ pattern: r.src, values: r.headers, style: 'regex', origin, file }, warnings);
        if (rule) headers.push(rule);
        return;
      }
      if (!r.dest) return;
      const status = Number.isInteger(r.status) ? r.status : 200;
      const rule = tryRule(
        {
          from: pattern,
          to: r.dest,
          status,
          force: !afterFilesystem && status >= 300 && status < 400,
          style: 'regex',
          ignoreCase: false,
          display: r.src,
          origin,
          file,
        },
        warnings,
      );
      if (rule) rules.push(rule);
    });
  }

  return { rules, headers, warnings };
}

module.exports = { parseVercelJson };
