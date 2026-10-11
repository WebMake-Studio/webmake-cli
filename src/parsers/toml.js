/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\' && quote === '"') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '#') return line.slice(0, i);
  }
  return line;
}

function depthOf(text) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\' && quote === '"') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
  }
  return depth;
}

function findEquals(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\' && quote === '"') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '=') return i;
  }
  return -1;
}

function splitKey(text) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (const ch of text.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '.') { parts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  parts.push(cur.trim());
  if (parts.some((p) => p === '')) throw new Error(`invalid key "${text.trim()}"`);
  return parts;
}

const ESCAPES = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };

function readValue(state) {
  const s = state.s;
  skipSpace(state);
  const ch = s[state.i];
  if (ch === '"') return readBasicString(state);
  if (ch === "'") {
    const end = s.indexOf("'", state.i + 1);
    if (end < 0) throw new Error('unterminated string');
    const value = s.slice(state.i + 1, end);
    state.i = end + 1;
    return value;
  }
  if (ch === '[') {
    state.i++;
    const items = [];
    for (;;) {
      skipSpace(state, true);
      if (s[state.i] === ']') { state.i++; return items; }
      if (state.i >= s.length) throw new Error('unterminated array');
      items.push(readValue(state));
      skipSpace(state, true);
      if (s[state.i] === ',') state.i++;
    }
  }
  if (ch === '{') {
    state.i++;
    const table = {};
    for (;;) {
      skipSpace(state, true);
      if (s[state.i] === '}') { state.i++; return table; }
      if (state.i >= s.length) throw new Error('unterminated inline table');
      const eq = findEquals(s.slice(state.i));
      if (eq < 0) throw new Error('expected key = value in inline table');
      const key = splitKey(s.slice(state.i, state.i + eq));
      state.i += eq + 1;
      setPath(table, key, readValue(state));
      skipSpace(state, true);
      if (s[state.i] === ',') state.i++;
    }
  }
  const start = state.i;
  while (state.i < s.length && !/[,\]}\s]/.test(s[state.i])) state.i++;
  const token = s.slice(start, state.i);
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (/^[+-]?\d[\d_]*$/.test(token)) return parseInt(token.replace(/_/g, ''), 10);
  if (/^[+-]?\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?$/.test(token)) return parseFloat(token.replace(/_/g, ''));
  if (token === '') throw new Error('missing value');
  return token;
}

function readBasicString(state) {
  const s = state.s;
  let i = state.i + 1;
  let out = '';
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\') {
      const next = s[++i];
      if (next === 'u' || next === 'U') {
        const len = next === 'u' ? 4 : 8;
        out += String.fromCodePoint(parseInt(s.slice(i + 1, i + 1 + len), 16));
        i += len;
      } else if (next in ESCAPES) out += ESCAPES[next];
      else out += next;
    } else if (ch === '"') {
      state.i = i + 1;
      return out;
    } else out += ch;
  }
  throw new Error('unterminated string');
}

function skipSpace(state, newlines = false) {
  const re = newlines ? /\s/ : /[ \t]/;
  while (state.i < state.s.length && re.test(state.s[state.i])) state.i++;
}

function parseValue(src) {
  const state = { s: src, i: 0 };
  const value = readValue(state);
  skipSpace(state, true);
  if (state.i < src.length) throw new Error('unexpected characters after value');
  return value;
}

function setPath(obj, keys, value) {
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] === undefined || typeof cur[k] !== 'object') cur[k] = {};
    cur = Array.isArray(cur[k]) ? cur[k][cur[k].length - 1] : cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}

function ensureTable(root, keys) {
  let cur = root;
  for (const k of keys) {
    if (cur[k] === undefined) cur[k] = {};
    cur = Array.isArray(cur[k]) ? cur[k][cur[k].length - 1] : cur[k];
  }
  return cur;
}

function ensureArrayTable(root, keys) {
  const parent = ensureTable(root, keys.slice(0, -1));
  const last = keys[keys.length - 1];
  if (!Array.isArray(parent[last])) parent[last] = [];
  const entry = {};
  parent[last].push(entry);
  return entry;
}

function parse(text) {
  const data = {};
  const warnings = [];
  const lines = String(text).split(/\r?\n/);
  let cur = data;

  for (let n = 0; n < lines.length; n++) {
    const startLine = n + 1;
    const line = stripComment(lines[n]).trim();
    if (!line) continue;
    try {
      if (line.startsWith('[[')) {
        if (!line.endsWith(']]')) throw new Error('malformed array-of-tables header');
        cur = ensureArrayTable(data, splitKey(line.slice(2, -2)));
      } else if (line.startsWith('[')) {
        if (!line.endsWith(']')) throw new Error('malformed table header');
        cur = ensureTable(data, splitKey(line.slice(1, -1)));
      } else {
        const eq = findEquals(line);
        if (eq < 0) throw new Error('expected "key = value"');
        const key = splitKey(line.slice(0, eq));
        let valueSrc = line.slice(eq + 1).trim();
        const rawAfterEq = lines[n].slice(findEquals(lines[n]) + 1).trim();

        const delim = ['"""', "'''"].find((d) => rawAfterEq.startsWith(d));
        if (delim) {
          let body = rawAfterEq.slice(3);
          let end = body.indexOf(delim);
          while (end < 0 && n + 1 < lines.length) {
            body += `\n${lines[++n]}`;
            end = body.indexOf(delim);
          }
          if (end < 0) throw new Error('unterminated multi-line string');
          setPath(cur, key, body.slice(0, end).replace(/^\r?\n/, ''));
          continue;
        }

        while (depthOf(valueSrc) > 0 && n + 1 < lines.length) {
          valueSrc += `\n${stripComment(lines[++n])}`;
        }
        setPath(cur, key, parseValue(valueSrc));
      }
    } catch (err) {
      warnings.push(`line ${startLine}: ${err.message}`);
    }
  }
  return { data, warnings };
}

module.exports = { parse, parseValue };
