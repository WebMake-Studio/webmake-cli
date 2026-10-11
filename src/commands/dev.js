/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ui = require('../ui');
const { c, log } = ui;
const { resolveSettings } = require('../config');
const { loadRuleset, isConfigFileName, WEBMAKE_FILES } = require('../detect');
const { createDevServer } = require('../server');
const { createWatcher, createIgnore } = require('../watcher');
const { buildUrls } = require('../net');
const { openBrowser } = require('../open');
const { WebMakeError } = require('../errors');
const { displayPath, plural } = require('../util');

function bindKeys(handlers) {
  const stdin = process.stdin;
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') return () => {};
  readline.emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  const onKey = (str, key = {}) => {
    if (key.ctrl && key.name === 'c') return handlers.quit();
    if (key.ctrl || key.meta) return undefined;
    switch (key.name) {
      case 'o': return handlers.open();
      case 'r': return handlers.reload();
      case 'u': return handlers.urls();
      case 'c': return handlers.clear();
      case 'q': return handlers.quit();
      case 'h': return handlers.help();
      default: return undefined;
    }
  };
  stdin.on('keypress', onKey);
  return () => {
    stdin.off('keypress', onKey);
    try { stdin.setRawMode(false); } catch { }
    stdin.pause();
  };
}

function routingSummary(ruleset) {
  if (!ruleset.files.length) return c.muted('no redirect file detected');
  return ruleset.files
    .map((f) => {
      const parts = [];
      if (f.rules) parts.push(plural(f.rules, 'rule'));
      if (f.headers) parts.push(plural(f.headers, 'header block'));
      return `${path.basename(f.rel)} ${c.muted(`(${parts.join(', ') || 'empty'})`)}`;
    })
    .join(c.muted(' · '));
}

async function dev({ flags, positionals, cwd }) {
  if (positionals[0]) flags.dir = positionals[0];
  const started = Date.now();
  const settings = resolveSettings({ cwd, flags });
  ui.setQuiet(settings.quiet);

  let rootStat = null;
  try { rootStat = fs.statSync(settings.root); } catch { }
  if (!rootStat || !rootStat.isDirectory()) {
    throw new WebMakeError(`Directory not found: ${displayPath(cwd, settings.root)}`, {
      hint: 'Create it, run the command from your project folder, or pass --dir <folder>.',
    });
  }

  ui.printBanner();
  for (const w of settings.warnings) log.warn(w);

  let ruleset = loadRuleset(settings);
  for (const w of ruleset.warnings) log.warn(w);
  if (ruleset.skipped.length) {
    log.warn(`${plural(ruleset.skipped.length, 'rule')} cannot be evaluated in dev and ${ruleset.skipped.length === 1 ? 'was' : 'were'} skipped - run "webmake routes" for details.`);
  }

  const app = createDevServer({
    settings,
    getRuleset: () => ruleset,
    onRequest: (entry) => log.request(entry),
  });

  const { port, host, notices } = await app.listen();
  for (const n of notices) log.warn(n);
  const urls = buildUrls(host, port);

  const label = (t) => c.muted(t.padEnd(9));
  const features = [
    settings.spa ? 'SPA fallback' : null,
    settings.livereload ? 'live reload' : null,
    settings.cleanUrls ? 'clean URLs' : null,
    settings.cors ? 'CORS' : null,
  ].filter(Boolean).join(' · ');

  const printReady = () => {
    log.raw('');
    log.success(`${c.bold('Ready')} in ${Date.now() - started} ms`);
    log.raw('');
    if (urls.local) log.raw(`  ${c.brand('➜')}  ${label('Local')} ${c.bold(c.soft(urls.local))}`);
    for (const n of urls.network) log.raw(`  ${c.brand('➜')}  ${label('Network')} ${c.soft(n)}`);
    log.raw(`  ${c.brand('➜')}  ${label('Serving')} ${displayPath(cwd, settings.root)}${features ? c.muted(`  (${features})`) : ''}`);
    log.raw(`  ${c.brand('➜')}  ${label('Config')} ${settings.configFile ? path.basename(settings.configFile) : c.muted('none (defaults) - run "webmake init" to create webmake.dev')}`);
    log.raw(`  ${c.brand('➜')}  ${label('Routing')} ${routingSummary(ruleset)}`);
    if (process.stdin.isTTY) log.raw(`\n  ${c.muted('press')} ${c.soft('o')} ${c.muted('open ·')} ${c.soft('r')} ${c.muted('reload ·')} ${c.soft('u')} ${c.muted('urls ·')} ${c.soft('c')} ${c.muted('clear ·')} ${c.soft('q')} ${c.muted('quit')}`);
    log.raw('');
  };
  printReady();

  const watchPaths = new Set(settings.watch);
  for (const f of ruleset.files) watchPaths.add(f.abs);
  const ignore = createIgnore({ extra: settings.ignore, out: settings.out, base: settings.cwd, roots: settings.watch });

  let watcher = null;
  const toUrl = (file) => `/${path.relative(settings.root, file).split(path.sep).join('/')}`;
  const inRoot = (file) => !path.relative(settings.root, file).startsWith('..');

  const onChange = (events) => {
    const names = events.slice(0, 3).map((e) => displayPath(cwd, e.file)).join(', ');
    const more = events.length > 3 ? ` +${events.length - 3} more` : '';
    log.event(`${events[0].type === 'add' ? 'added' : events[0].type === 'unlink' ? 'removed' : 'changed'} ${c.soft(names)}${c.muted(more)}`);

    if (events.some((e) => WEBMAKE_FILES.includes(path.basename(e.file).toLowerCase()))) {
      log.warn('Configuration file changed - restart "webmake dev" to apply it.');
    }
    if (events.some((e) => isConfigFileName(path.basename(e.file)))) {
      ruleset = loadRuleset(settings);
      for (const w of ruleset.warnings) log.warn(w);
      log.event(`routing reloaded (${plural(ruleset.rules.length, 'rule')}, ${plural(ruleset.headers.length, 'header block')})`);
    }
    const onlyCss = events.every((e) => e.type === 'change' && /\.css$/i.test(e.file) && inRoot(e.file));
    if (onlyCss) events.forEach((e) => app.broadcast('css', { path: toUrl(e.file) }));
    else app.broadcast('reload', { files: events.map((e) => (inRoot(e.file) ? toUrl(e.file) : null)).filter(Boolean) });
  };

  if (watchPaths.size) {
    watcher = createWatcher({
      paths: [...watchPaths],
      ignore,
      poll: settings.poll,
      interval: settings.pollInterval,
      onChange,
      onWarn: (m) => log.warn(m),
    });
  }

  const openUrl = () => {
    const base = urls.primary;
    const target = typeof settings.open === 'string' ? base + settings.open.replace(/^\/+/, '') : base;
    return openBrowser(target).then((ok) => {
      if (!ok) log.info(`Could not launch a browser automatically. Open ${c.soft(target)} yourself.`);
    });
  };
  if (settings.open && !process.env.CI) openUrl();

  let closing = false;
  let unbindKeys = () => {};
  const shutdown = async (code = 0) => {
    if (closing) return;
    closing = true;
    unbindKeys();
    log.raw(`\n  ${c.muted('Shutting down…')}`);
    if (watcher) watcher.close();
    const force = setTimeout(() => process.exit(code), 1500);
    force.unref();
    await app.close();
    process.exit(code);
  };

  unbindKeys = bindKeys({
    open: openUrl,
    reload: () => { app.broadcast('reload'); log.event('reload sent to browsers'); },
    urls: () => printReady(),
    clear: () => { process.stdout.write('\u001b[2J\u001b[3J\u001b[H'); ui.printBanner(); printReady(); },
    help: () => log.raw(`\n  ${c.muted('o open · r reload · u urls · c clear · q quit')}\n`),
    quit: () => shutdown(0),
  });
  process.once('SIGINT', () => shutdown(0));
  process.once('SIGTERM', () => shutdown(0));

  return { close: () => shutdown(0), app, settings, urls };
}

module.exports = { dev };
