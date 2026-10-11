/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const { compile } = require('./patterns');

const EXTERNAL = /^[a-z][a-z0-9+.-]*:\/\//i;

class Rule {
  constructor(def) {
    this.from = def.from;
    this.to = def.to || '';
    this.status = def.status ?? 301;
    this.force = !!def.force;
    this.style = def.style || 'netlify';
    this.query = def.query || {};
    this.unsupported = def.unsupported || null;
    this.origin = def.origin || '';
    this.file = def.file || '';
    this.display = def.display || def.from;
    const ignoreCase = def.ignoreCase ?? this.style === 'netlify';
    this.matcher = compile(def.from, { style: this.style, ignoreCase, stripSlash: !!def.stripSlash });
  }

  get kind() {
    if (this.status >= 300 && this.status < 400) return 'redirect';
    if (!this.to) return 'status';
    if (this.status >= 400) return 'page';
    return EXTERNAL.test(this.to) ? 'proxy' : 'rewrite';
  }

  exec(pathname, query) {
    if (this.unsupported) return null;
    const m = this.matcher.exec(pathname);
    if (!m) return null;
    for (const [key, expected] of Object.entries(this.query)) {
      const actual = query ? query.get(key) : null;
      if (actual === null) return null;
      if (String(expected).startsWith(':')) m.named[String(expected).slice(1)] = actual;
      else if (actual !== expected) return null;
    }
    return m;
  }
}

class HeaderRule {
  constructor({ pattern, values, style = 'netlify', origin = '', file = '' }) {
    this.pattern = pattern;
    this.values = values;
    this.style = style;
    this.origin = origin;
    this.file = file;
    this.matcher = compile(pattern, { style, ignoreCase: style === 'netlify' });
  }

  matches(pathname) {
    return this.matcher.exec(pathname) !== null;
  }
}

function tryRule(def, warnings) {
  try {
    return new Rule(def);
  } catch (err) {
    warnings.push(`${def.origin || def.file}: ${err.message}`);
    return null;
  }
}

function tryHeaderRule(def, warnings) {
  try {
    return new HeaderRule(def);
  } catch (err) {
    warnings.push(`${def.origin || def.file}: ${err.message}`);
    return null;
  }
}

module.exports = { Rule, HeaderRule, tryRule, tryHeaderRule, EXTERNAL };
