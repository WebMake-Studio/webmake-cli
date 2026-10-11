/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function makeSite(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webmake-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });

module.exports = { makeSite, cleanup };
