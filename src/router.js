/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');

const { fill, encodePath } = require('./patterns');
const { isConfigFileName } = require('./detect');
const { EXTERNAL } = require('./rules');

const stat = (p) => fsp.stat(p).catch(() => null);

class Router {
  constructor(settings, getRuleset) {
    this.settings = settings;
    this.getRuleset = getRuleset;
    this.root = settings.root;
  }

  headersFor(pathname) {
    const out = {};
    for (const rule of this.getRuleset().headers) {
      if (rule.matches(pathname)) Object.assign(out, rule.values);
    }
    return out;
  }

  safePath(pathname) {
    const abs = path.resolve(this.root, `.${path.posix.normalize(`/${pathname}`)}`);
    const rel = path.relative(this.root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return abs;
  }

  hasHiddenSegment(pathname) {
    return pathname.split('/').some((s) => s.startsWith('.') && s !== '.well-known' && s !== '.' && s !== '..');
  }

  async indexOf(dir) {
    for (const name of ['index.html', 'index.htm']) {
      const p = path.join(dir, name);
      const st = await stat(p);
      if (st && st.isFile()) return p;
    }
    return null;
  }

  async findStatic(pathname) {
    if (this.hasHiddenSegment(pathname)) return null;
    const abs = this.safePath(pathname);
    if (!abs) return null;
    const trailing = pathname.endsWith('/');
    const st = await stat(abs);

    if (st && st.isFile()) {
      if (trailing || isConfigFileName(path.basename(abs))) return null;
      return { type: 'file', file: abs };
    }

    if (st && st.isDirectory()) {
      const index = await this.indexOf(abs);
      if (!trailing && pathname !== '/') {
        if (index || this.settings.listing) return { type: 'redirect', location: `${pathname}/` };
      } else {
        if (index) return { type: 'file', file: index };
        if (this.settings.listing) return { type: 'dir', dir: abs };
      }
    }

    if (this.settings.cleanUrls && pathname !== '/') {
      const candidate = this.safePath(`${pathname.replace(/\/+$/, '')}.html`);
      if (candidate) {
        const cs = await stat(candidate);
        if (cs && cs.isFile()) return { type: 'file', file: candidate };
      }
    }
    return null;
  }

  async resolve(req) {
    const notes = req.notes || [];
    const ruleset = this.getRuleset();

    let pathname;
    try {
      pathname = decodeURIComponent(req.pathname);
    } catch {
      return { action: 'error', status: 400, title: 'Bad request', message: 'The request URL is malformed.' };
    }
    if (pathname.includes('\0') || pathname.includes('\\')) {
      return { action: 'error', status: 400, title: 'Bad request', message: 'The request URL contains forbidden characters.' };
    }
    pathname = pathname.replace(/\/{2,}/g, '/');
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;

    const query = new URLSearchParams(req.search || '');
    let cached;
    const getStatic = async () => (cached === undefined ? (cached = await this.findStatic(pathname)) : cached);
    const exists = (s) => s && (s.type === 'file' || s.type === 'redirect');

    for (const rule of ruleset.rules) {
      const match = rule.exec(pathname, query);
      if (!match) continue;
      if (!rule.force && exists(await getStatic())) continue;
      const result = await this.applyRule(rule, match, { pathname, req, notes });
      if (result) return result;
    }

    const found = await getStatic();
    if (found && found.type === 'file') return { action: 'file', file: found.file, status: 200 };
    if (found && found.type === 'redirect') {
      return {
        action: 'redirect',
        status: 301,
        location: encodePath(found.location) + (req.search || ''),
        note: 'adding trailing slash',
      };
    }

    const fallback = await this.fallbackFor(pathname, req, ruleset, notes);
    if (fallback) return fallback;

    if (found && found.type === 'dir') return { action: 'dir', dir: found.dir, urlPath: pathname, status: 200 };

    return this.notFound(pathname, ruleset);
  }

  async applyRule(rule, match, { pathname, req, notes }) {
    if (rule.kind === 'status') {
      return { action: 'status', status: rule.status, rule, note: rule.origin };
    }

    let dest = fill(rule.to, match);
    const external = EXTERNAL.test(dest);
    if (!external && rule.to.startsWith('/') && !rule.to.startsWith('//')) dest = `/${dest.replace(/^\/+/, '')}`;

    if (rule.status >= 300 && rule.status < 400) {
      let location = dest;
      if (!external && !dest.includes('?') && req.search) location += req.search;
      if (!external && dest.split('?')[0] === req.pathname && location === req.pathname + (req.search || '')) {
        notes.push(`${rule.origin}: skipped (would redirect to itself)`);
        return null;
      }
      return { action: 'redirect', status: rule.status, location, rule, note: `${rule.origin}` };
    }

    if (external) {
      const target = !dest.includes('?') && req.search ? dest + req.search : dest;
      return { action: 'proxy', target, status: rule.status, rule, note: `proxy → ${dest.split('?')[0]}` };
    }

    const destPath = dest.split('?')[0];
    let decoded;
    try { decoded = decodeURIComponent(destPath); } catch { decoded = destPath; }
    let target = await this.findStatic(decoded);
    if (target && target.type === 'redirect') target = await this.findStatic(`${decoded.replace(/\/+$/, '')}/`);
    if (target && target.type === 'file') {
      const verb = rule.kind === 'page' ? 'serve' : 'rewrite';
      return { action: 'file', file: target.file, status: rule.status, rule, note: `${verb} → ${decoded} (${rule.origin})` };
    }
    notes.push(`${rule.origin}: destination ${destPath} was not found`);
    return null;
  }

  async fallbackFor(pathname, req, ruleset, notes) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return null;
    const wantsHtml = !req.accept || /text\/html/i.test(req.accept);
    if (!wantsHtml) return null;

    if (ruleset.fallback && !ruleset.fallback.exclude.some((m) => m.exec(pathname))) {
      const hit = await this.fileFromUrl(ruleset.fallback.to);
      if (hit) return { action: 'file', file: hit, status: 200, note: `navigationFallback → ${ruleset.fallback.to}` };
      notes.push(`navigationFallback target ${ruleset.fallback.to} was not found`);
    }

    const spa = this.settings.spa;
    if (spa) {
      const last = pathname.split('/').pop();
      if (/\.[A-Za-z0-9]+$/.test(last)) return null;
      let target;
      if (typeof spa === 'string') target = spa;
      else target = (await this.fileFromUrl('/200.html')) ? '/200.html' : '/index.html';
      const hit = await this.fileFromUrl(target.startsWith('/') ? target : `/${target}`);
      if (hit) return { action: 'file', file: hit, status: 200, note: `SPA fallback → ${target}` };
      notes.push(`SPA fallback file "${target}" was not found`);
    }
    return null;
  }

  async fileFromUrl(urlPath) {
    const abs = this.safePath(urlPath.split('?')[0]);
    if (!abs) return null;
    const st = await stat(abs);
    return st && st.isFile() ? abs : null;
  }

  async notFound(pathname, ruleset) {
    const candidates = [];
    if (this.settings.notFound) candidates.push(this.settings.notFound);
    if (ruleset.notFound) candidates.push(ruleset.notFound.to);
    for (const c of candidates) {
      const file = await this.fileFromUrl(c.startsWith('/') ? c : `/${c}`);
      if (file) return { action: 'notfound', status: 404, file, pathname };
    }
    let dir = pathname.endsWith('/') ? pathname.replace(/\/+$/, '') || '/' : path.posix.dirname(pathname);
    for (;;) {
      const file = await this.fileFromUrl(`${dir === '/' ? '' : dir}/404.html`);
      if (file) return { action: 'notfound', status: 404, file, pathname };
      if (dir === '/' || dir === '.') break;
      dir = path.posix.dirname(dir);
    }
    return { action: 'notfound', status: 404, file: null, pathname };
  }
}

module.exports = { Router };
