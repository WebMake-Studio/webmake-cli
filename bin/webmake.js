#!/usr/bin/env node
/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 18 || (major === 18 && minor < 17)) {
  process.stderr.write(`WebMake CLI needs Node.js 18.17 or newer (you are running ${process.version}).\nDownload the latest LTS from https://nodejs.org\n`);
  process.exit(1);
}

require('../src/cli')
  .run(process.argv.slice(2))
  .then((code) => {
    if (code) process.exitCode = code;
  });
