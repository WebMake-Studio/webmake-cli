/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const path = require('node:path');

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function closest(word, candidates, maxDistance = 2) {
  let best = null;
  let bestScore = maxDistance + 1;
  for (const candidate of candidates) {
    const score = levenshtein(word.toLowerCase(), candidate.toLowerCase());
    if (score < bestScore) { best = candidate; bestScore = score; }
  }
  return best;
}

function displayPath(cwd, abs) {
  const rel = path.relative(cwd, abs);
  if (!rel) return '.';
  return rel.startsWith('..') || path.isAbsolute(rel) ? abs : `./${rel.split(path.sep).join('/')}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

module.exports = { levenshtein, closest, displayPath, formatBytes, plural };
