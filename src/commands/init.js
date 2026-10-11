/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ui = require('../ui');
const { c, log } = ui;
const { WebMakeError } = require('../errors');

const TEMPLATE = `/**
 * webmake.dev - WebMake CLI configuration
 * Copyright (c) 2026 Rafael ISTE
 *
 * Every option is optional: delete what you do not need.
 * Command line flags always win over this file (example: webmake dev --port 3000).
 */
module.exports = {
  // Folder to serve.
  dir: './',

  // Folder written by "webmake build".
  out: './dist',

  // Port to listen on. If it is busy, the next free port is used
  // (set strictPort: true to fail instead).
  port: 8888,

  // IPv4 address to bind. "0.0.0.0" = every network interface (reachable
  // from your phone / other computers); "127.0.0.1" = this computer only.
  host: '0.0.0.0',

  // Path(s) watched for changes (live reload). Defaults to "dir".
  watch: '.',

  // Use polling instead of native file events (network drives, Docker, WSL).
  // true or an interval in milliseconds, e.g. 500.
  poll: false,

  // Single-page app mode: unknown URLs without a file extension serve
  // index.html (or 200.html). You can also give a file: spa: 'app.html'.
  spa: false,

  // Open the browser on start. true, false or a path such as '/docs/'.
  open: true,

  // More options (defaults shown):
  // cleanUrls: true,      // /about serves about.html
  // livereload: true,     // refresh the browser when files change
  // listing: true,        // list folders that have no index.html
  // cors: false,          // send "Access-Control-Allow-Origin: *"
  // strictPort: false,
  // ignore: ['tmp', 'src/generated'],   // paths the watcher must ignore
  // notFound: '404.html', // custom 404 page
  //
  // Extra redirects, evaluated BEFORE _redirects / netlify.toml / ...
  // redirects: [
  //   { from: '/old', to: '/new', status: 301 },
  //   { from: '/app/*', to: '/index.html', status: 200 },
  // ],
  //
  // Extra response headers:
  // headers: [
  //   { for: '/*', values: { 'X-Frame-Options': 'DENY' } },
  // ],
};
`;

async function init({ flags, cwd }) {
  const target = path.join(cwd, 'webmake.dev');
  if (fs.existsSync(target) && !flags.force) {
    throw new WebMakeError('webmake.dev already exists.', { hint: 'Use "webmake init --force" to overwrite it.' });
  }
  fs.writeFileSync(target, TEMPLATE, 'utf8');
  log.success(`Created ${c.bold('webmake.dev')}`);
  log.raw(`  ${c.muted('Edit it, then run')} ${c.soft('webmake dev')}`);
}

module.exports = { init, TEMPLATE };
