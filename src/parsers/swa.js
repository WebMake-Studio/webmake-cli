/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const { tryRule, tryHeaderRule } = require('../rules');
const { compile } = require('../patterns');

function expandBraces(pattern) {
  const m = /\{([^{}]+)\}/.exec(pattern);
  if (!m) return [pattern];
  return m[1].split(',').flatMap((alt) => expandBraces(pattern.slice(0, m.index) + alt.trim() + pattern.slice(m.index + m[0].length)));
}

function parseStaticWebAppConfig(text, { file = 'staticwebapp.config.json' } = {}) {
  const rules = [];
  const headers = [];
  const warnings = [];
  let notFound = null;
  let fallback = null;
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch (err) {
    return { rules, headers, warnings: [`${file}: invalid JSON (${err.message})`], notFound, fallback };
  }
  if (!cfg || typeof cfg !== 'object') return { rules, headers, warnings, notFound, fallback };

  (Array.isArray(cfg.routes) ? cfg.routes : []).forEach((r, idx) => {
    const origin = `${file} routes[${idx}]`;
    if (!r || typeof r.route !== 'string') { warnings.push(`${origin}: "route" is required`); return; }
    if (r.headers && typeof r.headers === 'object') {
      const values = {};
      for (const [k, v] of Object.entries(r.headers)) values[k] = String(v);
      const hr = tryHeaderRule({ pattern: r.route, values, origin, file, style: 'netlify' }, warnings);
      if (hr) headers.push(hr);
    }
    if (r.redirect) {
      const rule = tryRule(
        { from: r.route, to: r.redirect, status: Number.isInteger(r.statusCode) ? r.statusCode : 302, force: true, origin, file, style: 'netlify' },
        warnings,
      );
      if (rule) rules.push(rule);
    } else if (r.rewrite) {
      const rule = tryRule(
        { from: r.route, to: r.rewrite, status: 200, force: true, origin, file, style: 'netlify' },
        warnings,
      );
      if (rule) rules.push(rule);
    }
  });

  if (cfg.globalHeaders && typeof cfg.globalHeaders === 'object') {
    const values = {};
    for (const [k, v] of Object.entries(cfg.globalHeaders)) values[k] = String(v);
    const hr = tryHeaderRule({ pattern: '/*', values, origin: `${file} globalHeaders`, file, style: 'netlify' }, warnings);
    if (hr) headers.push(hr);
  }

  const nav = cfg.navigationFallback;
  if (nav && typeof nav.rewrite === 'string') {
    const exclude = [];
    for (const pattern of Array.isArray(nav.exclude) ? nav.exclude : []) {
      for (const expanded of expandBraces(pattern)) {
        try {
          exclude.push(compile(expanded, { style: 'netlify', ignoreCase: true }));
        } catch (err) {
          warnings.push(`${file} navigationFallback.exclude: ${err.message}`);
        }
      }
    }
    fallback = { to: nav.rewrite, exclude, origin: `${file} navigationFallback` };
  }

  const overrides = cfg.responseOverrides;
  if (overrides && overrides['404']) {
    const o = overrides['404'];
    if (typeof o.rewrite === 'string') notFound = { to: o.rewrite, status: 404, origin: `${file} responseOverrides.404` };
    else if (o.redirect) warnings.push(`${file}: responseOverrides.404.redirect is not emulated in dev (use "rewrite")`);
  }

  return { rules, headers, warnings, notFound, fallback };
}

module.exports = { parseStaticWebAppConfig };
