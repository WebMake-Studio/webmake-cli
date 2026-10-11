/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function uniqueName(name, used) {
  let candidate = name;
  let i = 2;
  while (used.has(candidate)) candidate = `${name}${i++}`;
  used.add(candidate);
  return candidate;
}

function matchParen(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') { i++; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`unbalanced parenthesis in pattern "${src}"`);
}

function wrap(re, { stripSlash = false } = {}) {
  return {
    source: re.source,
    exec(pathname) {
      const text = stripSlash ? pathname.replace(/^\//, '') : pathname;
      const m = re.exec(text);
      if (!m) return null;
      return { named: { ...(m.groups || {}) }, list: m.slice(1) };
    },
  };
}

function compileNetlify(pattern, flags) {
  let p = pattern;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  const used = new Set();
  let src = '';
  let stars = 0;
  for (let i = 0; i < p.length; ) {
    const ch = p[i];
    if (ch === '*') {
      const name = uniqueName(stars++ === 0 ? 'splat' : 'splat', used);
      src += `(?<${name}>.*)`;
      i++;
    } else if (ch === ':' && /[A-Za-z_]/.test(p[i + 1] || '')) {
      let j = i + 1;
      while (j < p.length && /[A-Za-z0-9_]/.test(p[j])) j++;
      src += `(?<${uniqueName(p.slice(i + 1, j), used)}>[^/]+)`;
      i = j;
    } else {
      src += escapeRe(ch);
      i++;
    }
  }
  return wrap(new RegExp(`^${src}${p === '/' ? '' : '/?'}$`, flags));
}

function compileVercel(pattern, flags) {
  let p = pattern;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  const used = new Set();
  let out = '';
  let i = 0;
  while (i < p.length) {
    const ch = p[i];
    if (ch === ':' && /[A-Za-z_]/.test(p[i + 1] || '')) {
      let j = i + 1;
      while (j < p.length && /[A-Za-z0-9_]/.test(p[j])) j++;
      const name = uniqueName(p.slice(i + 1, j), used);
      i = j;
      let custom = null;
      if (p[i] === '(') {
        const end = matchParen(p, i);
        custom = p.slice(i + 1, end);
        i = end + 1;
      }
      const mod = /[*+?]/.test(p[i] || '') ? p[i++] : '';
      const slash = out.endsWith('/');
      if (slash && mod) out = out.slice(0, -1);
      if (mod === '*') {
        const body = custom ?? '.*';
        out += slash ? `(?:/(?<${name}>${body}))?` : `(?<${name}>${body})`;
      } else if (mod === '+') {
        const body = custom ?? '.+';
        out += slash ? `/(?<${name}>${body})` : `(?<${name}>${body})`;
      } else if (mod === '?') {
        const body = custom ?? '[^/]+';
        out += slash ? `(?:/(?<${name}>${body}))?` : `(?<${name}>${body})?`;
      } else {
        out += `(?<${name}>${custom ?? '[^/]+'})`;
      }
    } else if (ch === '(') {
      const end = matchParen(p, i);
      out += `(${p.slice(i + 1, end)})`;
      i = end + 1;
      if (/[*+?]/.test(p[i] || '')) out += p[i++];
    } else if (ch === '*') {
      out += '(.*)';
      i++;
    } else {
      out += escapeRe(ch);
      i++;
    }
  }
  return wrap(new RegExp(`^${out}${p === '/' ? '' : '/?'}$`, flags));
}

function compileGlob(pattern, flags) {
  const p = pattern.startsWith('/') ? pattern : `/${pattern}`;
  let out = '';
  for (let i = 0; i < p.length; ) {
    if (p.startsWith('**/', i)) { out += '(?:.*/)?'; i += 3; }
    else if (p.startsWith('**', i)) { out += '(.*)'; i += 2; }
    else if (p[i] === '*') { out += '([^/]*)'; i++; }
    else if (p[i] === '?') { out += '[^/]'; i++; }
    else if (p[i] === '{') {
      const end = p.indexOf('}', i);
      if (end < 0) { out += '\\{'; i++; }
      else {
        out += `(?:${p.slice(i + 1, end).split(',').map(escapeRe).join('|')})`;
        i = end + 1;
      }
    } else { out += escapeRe(p[i]); i++; }
  }
  const trailing = p === '/' || p.endsWith('/') ? '' : '/?';
  return wrap(new RegExp(`^${out}${trailing}$`, flags));
}

function compile(pattern, { style = 'netlify', ignoreCase = false, stripSlash = false } = {}) {
  const flags = ignoreCase ? 'i' : '';
  try {
    switch (style) {
      case 'vercel': return compileVercel(pattern, flags);
      case 'firebase': return compileGlob(pattern, flags);
      case 'regex': return wrap(new RegExp(pattern, flags), { stripSlash });
      default: return compileNetlify(pattern, flags);
    }
  } catch (err) {
    throw new Error(`invalid pattern "${pattern}" (${err.message})`);
  }
}

function safeEncode(value) {
  return encodeURI(value).replace(/[?#]/g, encodeURIComponent);
}

function fill(template, match) {
  const named = match.named || {};
  const list = match.list || [];
  let out = template.replace(/:([A-Za-z_][A-Za-z0-9_]*)[*+]?/g, (all, name) =>
    Object.prototype.hasOwnProperty.call(named, name) && named[name] !== undefined ? safeEncode(named[name]) : all,
  );
  out = out.replace(/\$(\d+)/g, (all, n) => (list[Number(n) - 1] === undefined ? '' : safeEncode(list[Number(n) - 1])));
  return out;
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

module.exports = { compile, fill, safeEncode, encodePath, escapeRe };
