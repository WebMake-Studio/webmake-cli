/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const { resolveSettings } = require('./config');
const { loadRuleset } = require('./detect');
const { createDevServer } = require('./server');
const { createWatcher, createIgnore } = require('./watcher');
const { buildUrls } = require('./net');
const { Router } = require('./router');

async function startServer(options = {}) {
  const { cwd = process.cwd(), ...flags } = options;
  const settings = resolveSettings({ cwd, flags: { livereload: true, ...flags } });
  let ruleset = loadRuleset(settings);
  const app = createDevServer({ settings, getRuleset: () => ruleset });
  const { port, host, notices } = await app.listen();

  let watcher = null;
  if (settings.watch.length) {
    watcher = createWatcher({
      paths: settings.watch,
      ignore: createIgnore({ extra: settings.ignore, out: settings.out, base: settings.cwd, roots: settings.watch }),
      poll: settings.poll,
      interval: settings.pollInterval,
      onChange: () => { ruleset = loadRuleset(settings); app.broadcast('reload'); },
    });
  }

  return {
    settings,
    port,
    host,
    notices,
    urls: buildUrls(host, port),
    reloadRules: () => { ruleset = loadRuleset(settings); return ruleset; },
    reload: () => app.broadcast('reload'),
    close: async () => { if (watcher) watcher.close(); await app.close(); },
  };
}

module.exports = { startServer, resolveSettings, loadRuleset, createDevServer, createWatcher, Router };
