/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const pkg = require('../package.json');

const ANSI_RE = /\u001b\[[0-9;]*m/g;

function detectLevel(stream = process.stdout, env = process.env) {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 0;
  if (env.FORCE_COLOR !== undefined) {
    if (env.FORCE_COLOR === '0' || env.FORCE_COLOR === 'false') return 0;
    const n = parseInt(env.FORCE_COLOR, 10);
    return Number.isNaN(n) ? 1 : Math.min(3, Math.max(1, n));
  }
  if (!stream || !stream.isTTY) return 0;
  if (env.TERM === 'dumb') return 0;
  if (env.COLORTERM === 'truecolor' || env.COLORTERM === '24bit') return 3;
  if (process.platform === 'win32') return 3;
  if (/256color/i.test(env.TERM || '')) return 2;
  return 1;
}

let level = detectLevel();
let quiet = false;

const setLevel = (n) => { level = n; };
const getLevel = () => level;
const setQuiet = (q) => { quiet = !!q; };
const isQuiet = () => quiet;

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbTo256([r, g, b]) {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  return 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
}

function rgbTo16([r, g, b]) {
  const v = Math.round((Math.max(r, g, b) / 255) * 2);
  if (v === 0) return 30;
  let code = 30 + ((Math.round(b / 255) << 2) | (Math.round(g / 255) << 1) | Math.round(r / 255));
  if (v === 2) code += 60;
  return code;
}

function fgCode(rgb) {
  if (level === 3) return `38;2;${rgb[0]};${rgb[1]};${rgb[2]}`;
  if (level === 2) return `38;5;${rgbTo256(rgb)}`;
  return String(rgbTo16(rgb));
}

function bgCode(rgb) {
  if (level === 3) return `48;2;${rgb[0]};${rgb[1]};${rgb[2]}`;
  if (level === 2) return `48;5;${rgbTo256(rgb)}`;
  return String(rgbTo16(rgb) + 10);
}

const paint = (open, close, text) => (level > 0 ? `\u001b[${open}m${text}\u001b[${close}m` : String(text));

const fg = (hex) => {
  const rgb = hexToRgb(hex);
  return (t) => (level > 0 ? paint(fgCode(rgb), 39, t) : String(t));
};

const bg = (hex) => {
  const rgb = hexToRgb(hex);
  return (t) => (level > 0 ? paint(bgCode(rgb), 49, t) : String(t));
};

const PALETTE = {
  indigo: '#5b5bf0',
  indigoDeep: '#3d3df0',
  violet: '#9b8cff',
  lavender: '#cfc9ff',
  mint: '#34d399',
  amber: '#fbbf24',
  rose: '#f87171',
  gray: '#8b88a8',
};

const c = {
  brand: fg(PALETTE.indigo),
  accent: fg(PALETTE.violet),
  soft: fg(PALETTE.lavender),
  ok: fg(PALETTE.mint),
  warn: fg(PALETTE.amber),
  err: fg(PALETTE.rose),
  muted: fg(PALETTE.gray),
  bold: (t) => paint(1, 22, t),
  dim: (t) => paint(2, 22, t),
  italic: (t) => paint(3, 23, t),
  underline: (t) => paint(4, 24, t),
  badge: (t) => (level > 0 ? paint('1', 22, bg(PALETTE.indigo)(fg('#ffffff')(` ${t} `))) : `[${t}]`),
};

function gradient(text, from = PALETTE.indigoDeep, to = PALETTE.violet) {
  if (level === 0) return String(text);
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const chars = [...String(text)];
  const span = Math.max(chars.length - 1, 1);
  return chars
    .map((ch, i) => {
      if (ch === ' ') return ch;
      const t = i / span;
      const rgb = a.map((v, k) => Math.round(v + (b[k] - v) * t));
      return paint(fgCode(rgb), 39, ch);
    })
    .join('');
}

const stripAnsi = (s) => String(s).replace(ANSI_RE, '');
const width = (s) => [...stripAnsi(s)].length;
const padEnd = (s, n) => String(s) + ' '.repeat(Math.max(0, n - width(s)));
const padStart = (s, n) => ' '.repeat(Math.max(0, n - width(s))) + String(s);

function box(lines, { padX = 2, minWidth = 0, color = c.soft } = {}) {
  const inner = Math.max(minWidth, ...lines.map(width));
  const bar = '─'.repeat(inner + padX * 2);
  const pad = ' '.repeat(padX);
  const out = [color(`╭${bar}╮`)];
  for (const line of lines) out.push(color('│') + pad + padEnd(line, inner) + pad + color('│'));
  out.push(color(`╰${bar}╯`));
  return out.join('\n');
}

function table(rows, columns, { indent = 2 } = {}) {
  const widths = columns.map((col) =>
    Math.max(width(col.title), ...rows.map((r) => width(r[col.key] === undefined ? '' : r[col.key]))),
  );
  const sp = ' '.repeat(indent);
  const fmt = (cells) =>
    sp +
    cells
      .map((cell, i) => (columns[i].align === 'right' ? padStart(cell, widths[i]) : padEnd(cell, widths[i])))
      .join('   ')
      .trimEnd();
  const lines = [fmt(columns.map((col) => c.muted(col.title)))];
  lines.push(sp + c.muted(widths.map((w) => '─'.repeat(w)).join('───')));
  for (const r of rows) lines.push(fmt(columns.map((col) => (r[col.key] === undefined ? '' : r[col.key]))));
  return lines.join('\n');
}

function banner() {
  const dots = `${fg(PALETTE.rose)('●')} ${fg(PALETTE.amber)('●')} ${fg(PALETTE.mint)('●')}`;
  const mark1 = gradient('╲  ╱╲  ╱', PALETTE.indigoDeep, PALETTE.violet);
  const mark2 = gradient(' ╲╱  ╲╱ ', PALETTE.indigoDeep, PALETTE.violet);
  const title = `${c.bold(gradient('WebMake CLI', '#ffffff', PALETTE.lavender))} ${c.muted(`v${pkg.version}`)}`;
  const lines = [
    dots,
    '',
    `${mark1}   ${title}`,
    `${mark2}   ${c.soft('Build the extraordinary on the web.')}`,
    '',
  ];
  return box(lines, { padX: 2, minWidth: 46 });
}

function printBanner() {
  if (quiet) return;
  process.stdout.write(`\n${banner().split('\n').map((l) => `  ${l}`).join('\n')}\n\n`);
}

const out = (s = '') => process.stdout.write(`${s}\n`);
const errOut = (s = '') => process.stderr.write(`${s}\n`);
const clock = () => new Date().toTimeString().slice(0, 8);

const log = {
  raw: (s = '') => { if (!quiet) out(s); },
  blank: () => { if (!quiet) out(''); },
  info: (msg) => { if (!quiet) out(`  ${c.accent('●')} ${msg}`); },
  success: (msg) => { if (!quiet) out(`  ${c.ok('✔')} ${msg}`); },
  step: (msg) => { if (!quiet) out(`  ${c.brand('➜')} ${msg}`); },
  warn: (msg) => errOut(`  ${c.warn('▲')} ${c.warn('warning')} ${msg}`),
  error: (msg, hint) => {
    errOut(`  ${c.err('✖')} ${c.err('error')} ${msg}`);
    if (hint) errOut(`    ${c.muted('→')} ${c.muted(hint)}`);
  },
  request({ method, url, status, ms, note }) {
    if (quiet) return;
    const color = status >= 500 ? c.err : status >= 400 ? c.warn : status >= 300 ? c.accent : c.ok;
    const shownUrl = url.length > 70 ? `${url.slice(0, 69)}…` : url;
    out(
      `  ${c.muted(clock())}  ${c.soft(padEnd(method, 5))} ${shownUrl} ${color(String(status))} ${c.muted(`${ms}ms`)}` +
        (note ? `  ${c.muted(note)}` : ''),
    );
  },
  event(msg) {
    if (!quiet) out(`  ${c.muted(clock())}  ${c.brand('↻')} ${msg}`);
  },
};

module.exports = {
  c, fg, bg, PALETTE, gradient, box, table, banner, printBanner, log,
  stripAnsi, width, padEnd, padStart, setLevel, getLevel, setQuiet, isQuiet, detectLevel,
};
