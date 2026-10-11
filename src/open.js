/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const { spawn } = require('node:child_process');

function openBrowser(url) {
  return new Promise((resolve) => {
    if (!/^https?:\/\//i.test(url)) return resolve(false);
    let cmd;
    let args;
    if (process.platform === 'darwin') { cmd = 'open'; args = [url]; }
    else if (process.platform === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '""', url.replace(/&/g, '^&')]; }
    else { cmd = 'xdg-open'; args = [url]; }

    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: process.platform === 'win32' });
      child.once('error', () => resolve(false));
      child.once('spawn', () => { child.unref(); resolve(true); });
    } catch {
      resolve(false);
    }
  });
}

module.exports = { openBrowser };
