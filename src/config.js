/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { WebMakeError } = require('./errors');
const { closest } = require('./util');

const CONFIG_FILES = ['webmake.dev', 'webmake.dev.js', 'webmake.config.js', 'webmake.config.json'];

const DEFAULTS = Object.freeze({
  dir: './',
  out: './dist',
  port: 8888,
  host: '0.0.0.0',
  watch: null,
  poll: false,
  spa: false,
  open: true,
  cleanUrls: true,
  livereload: true,
  strictPort: false,
  listing: true,
  cors: false,
  ignore: [],
  notFound: null,
  redirects: [],
  headers: [],
  quiet: false,
});

const KNOWN_KEYS = Object.keys(DEFAULTS);

const suggest = (key) => closest(key, KNOWN_KEYS);

function findConfigFile(cwd, explicit) {
  if (explicit) {
    const abs = path.resolve(cwd, explicit);
    if (!fs.existsSync(abs)) {
      throw new WebMakeError(`Configuration file not found: ${explicit}`, {
        hint: 'Check the --config path, or run "webmake init" to create a webmake.dev file.',
        exitCode: 2,
      });
    }
    return abs;
  }
  for (const name of CONFIG_FILES) {
    const abs = path.join(cwd, name);
    try {
      if (fs.statSync(abs).isFile()) return abs;
    } catch { }
  }
  return null;
}

function readConfigFile(file) {
  const rel = path.basename(file);
  let mod;
  try {
    if (file.endsWith('.json')) {
      mod = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      delete require.cache[require.resolve(file)];
      mod = require(file);
    }
  } catch (err) {
    const esm = /Unexpected token 'export'|Cannot use import statement/.test(err.message);
    throw new WebMakeError(`Could not load ${rel}: ${err.message.split('\n')[0]}`, {
      hint: esm
        ? 'Use CommonJS syntax: module.exports = { port: 8888 };'
        : 'Fix the syntax error above, or run "webmake init --force" to regenerate the file.',
    });
  }
  if (mod && typeof mod === 'object' && mod.__esModule && mod.default) mod = mod.default;
  if (typeof mod === 'function') {
    try {
      mod = mod({ command: 'dev', mode: 'development' });
    } catch (err) {
      throw new WebMakeError(`${rel} threw an error: ${err.message}`);
    }
  }
  if (mod === undefined || mod === null) mod = {};
  if (typeof mod !== 'object' || Array.isArray(mod)) {
    throw new WebMakeError(`${rel} must export an object (module.exports = { ... }).`);
  }
  return mod;
}

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isBool = (v) => typeof v === 'boolean';

function validate(cfg, source) {
  const errors = [];
  const warnings = [];
  const bad = (key, expect) => errors.push(`"${key}" must be ${expect} (got ${JSON.stringify(cfg[key])})`);

  for (const key of Object.keys(cfg)) {
    if (!KNOWN_KEYS.includes(key)) {
      const hint = suggest(key);
      warnings.push(`Unknown option "${key}" in ${source}${hint ? ` - did you mean "${hint}"?` : ''}`);
    }
  }

  if (!isStr(cfg.dir)) bad('dir', 'a non-empty string');
  if (!isStr(cfg.out)) bad('out', 'a non-empty string');

  const port = typeof cfg.port === 'string' && /^\d+$/.test(cfg.port) ? Number(cfg.port) : cfg.port;
  if (!Number.isInteger(port) || port < 0 || port > 65535) bad('port', 'an integer between 0 and 65535');
  else cfg.port = port;

  if (!isStr(cfg.host)) bad('host', 'a non-empty string such as "0.0.0.0" or "127.0.0.1"');

  const w = cfg.watch;
  if (!(w === null || w === false || isStr(w) || (Array.isArray(w) && w.every(isStr)))) {
    bad('watch', 'a path, an array of paths, false or null');
  }

  if (!(isBool(cfg.poll) || (Number.isInteger(cfg.poll) && cfg.poll > 0))) bad('poll', 'true, false or an interval in milliseconds');
  if (!(isBool(cfg.spa) || isStr(cfg.spa))) bad('spa', 'true, false or the path of a fallback file');
  if (!(isBool(cfg.open) || isStr(cfg.open))) bad('open', 'true, false or a URL path such as "/about"');

  for (const key of ['cleanUrls', 'livereload', 'strictPort', 'listing', 'cors', 'quiet']) {
    if (!isBool(cfg[key])) bad(key, 'true or false');
  }
  if (!Array.isArray(cfg.ignore) || !cfg.ignore.every(isStr)) bad('ignore', 'an array of strings');
  if (!(cfg.notFound === null || isStr(cfg.notFound))) bad('notFound', 'a file path such as "404.html"');
  if (!Array.isArray(cfg.redirects)) bad('redirects', 'an array of { from, to, status?, force? }');
  if (!Array.isArray(cfg.headers)) bad('headers', 'an array of { for, values }');

  if (errors.length) {
    throw new WebMakeError(`Invalid configuration in ${source}:\n${errors.map((e) => `    - ${e}`).join('\n')}`, {
      hint: 'See docs/DOCUMENTATION.fr.md or the README for every option.',
      exitCode: 2,
    });
  }
  return warnings;
}

function resolveSettings({ cwd, flags = {} }) {
  const file = findConfigFile(cwd, flags.config);
  const fromFile = file ? readConfigFile(file) : {};
  const warnings = [];

  const merged = { ...DEFAULTS, ...fromFile };
  for (const [k, v] of Object.entries(flags)) if (v !== undefined && KNOWN_KEYS.includes(k)) merged[k] = v;

  warnings.push(...validate(merged, file ? path.basename(file) : 'command line'));

  const baseOf = (key) => (flags[key] !== undefined || !file ? cwd : path.dirname(file));
  const resolveFrom = (key, value) => path.resolve(baseOf(key), value);

  const root = resolveFrom('dir', merged.dir);
  const out = resolveFrom('out', merged.out);

  let watch;
  if (merged.watch === false) watch = [];
  else if (merged.watch === null || merged.watch === undefined) watch = [root];
  else watch = (Array.isArray(merged.watch) ? merged.watch : [merged.watch]).map((p) => resolveFrom('watch', p));

  const poll = merged.poll === true || Number.isInteger(merged.poll);

  return {
    cwd,
    configFile: file,
    root,
    out,
    port: merged.port,
    host: merged.host,
    watch,
    poll,
    pollInterval: Number.isInteger(merged.poll) ? merged.poll : 300,
    spa: merged.spa,
    open: merged.open,
    cleanUrls: merged.cleanUrls,
    livereload: merged.livereload,
    strictPort: merged.strictPort,
    listing: merged.listing,
    cors: merged.cors,
    ignore: merged.ignore,
    notFound: merged.notFound,
    redirects: merged.redirects,
    headers: merged.headers,
    quiet: merged.quiet,
    warnings,
  };
}

module.exports = { resolveSettings, loadDefaults: () => ({ ...DEFAULTS }), DEFAULTS, CONFIG_FILES, KNOWN_KEYS, findConfigFile, validate };
