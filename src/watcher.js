/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ALWAYS_IGNORED = new Set(['node_modules', '.git', '.hg', '.svn', '.DS_Store', 'Thumbs.db', '.idea', '.vscode']);
const TEMP_FILE = /(~|\.swp|\.swx|\.tmp|\.crdownload|\.part)$|^\.#|^4913$/;

function createIgnore({ extra = [], out, base, roots = [] } = {}) {
  const extras = extra.map((e) => e.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, ''));
  return (abs) => {
    const name = path.basename(abs);
    if (roots.includes(abs)) return false;
    if (ALWAYS_IGNORED.has(name) || TEMP_FILE.test(name)) return true;
    if (out && abs === out) return true;
    if (extras.length) {
      const rel = base ? path.relative(base, abs).replace(/\\/g, '/') : name;
      for (const e of extras) {
        if (e === name || rel === e || rel.startsWith(`${e}/`)) return true;
      }
    }
    return false;
  };
}

function createWatcher({ paths, ignore = () => false, poll = false, interval = 300, debounce = 60, onChange, onWarn = () => {} }) {
  let closed = false;
  let pending = new Map();
  let timer = null;

  const emit = (type, file) => {
    if (closed) return;
    pending.set(file, type);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const events = [...pending].map(([f, t]) => ({ type: t, file: f }));
      pending = new Map();
      if (!closed && events.length) onChange(events);
    }, debounce);
  };

  function startPolling() {
    const snapshot = new Map();
    const scan = () => {
      const seen = new Map();
      const walk = (p) => {
        let st;
        try { st = fs.statSync(p); } catch { return; }
        if (ignore(p)) return;
        if (st.isDirectory()) {
          let names = [];
          try { names = fs.readdirSync(p); } catch { return; }
          for (const n of names) walk(path.join(p, n));
        } else seen.set(p, `${st.mtimeMs}:${st.size}`);
      };
      paths.forEach(walk);
      return seen;
    };
    let previous = scan();
    for (const [k, v] of previous) snapshot.set(k, v);
    let handle;
    const tick = () => {
      if (closed) return;
      const current = scan();
      for (const [file, sig] of current) {
        if (!previous.has(file)) emit('add', file);
        else if (previous.get(file) !== sig) emit('change', file);
      }
      for (const file of previous.keys()) if (!current.has(file)) emit('unlink', file);
      previous = current;
      handle = setTimeout(tick, interval);
      handle.unref?.();
    };
    handle = setTimeout(tick, interval);
    handle.unref?.();
    return { mode: 'poll', close: () => { closed = true; clearTimeout(handle); clearTimeout(timer); } };
  }

  if (poll) return startPolling();

  const watchers = new Map();
  const onlyFiles = new Map();
  let failed = false;

  const watchDir = (dir) => {
    if (closed || failed || watchers.has(dir) || ignore(dir)) return;
    let w;
    try {
      w = fs.watch(dir, { persistent: true }, (eventType, filename) => {
        if (closed) return;
        if (!filename) { emit('change', dir); return; }
        const full = path.join(dir, filename.toString());
        const wanted = onlyFiles.get(dir);
        if (wanted && !wanted.has(full)) return;
        if (ignore(full)) return;
        let st = null;
        try { st = fs.statSync(full); } catch { }
        if (!st) {
          const w2 = watchers.get(full);
          if (w2) { w2.close(); watchers.delete(full); }
          emit('unlink', full);
        } else if (st.isDirectory()) {
          if (eventType === 'rename') { watchTree(full); emit('add', full); }
        } else emit(eventType === 'rename' ? 'add' : 'change', full);
      });
    } catch (err) {
      failed = true;
      onWarn(`native file watching failed (${err.code || err.message}), switching to polling`);
      return;
    }
    w.on('error', (err) => {
      if (failed) return;
      failed = true;
      onWarn(`file watcher error (${err.code || err.message}), switching to polling`);
    });
    watchers.set(dir, w);
  };

  const watchTree = (dir) => {
    if (ignore(dir)) return;
    watchDir(dir);
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) if (e.isDirectory()) watchTree(path.join(dir, e.name));
  };

  const stats = new Map();
  for (const p of paths) {
    try { stats.set(p, fs.statSync(p)); } catch { onWarn(`watch path does not exist: ${p}`); }
  }
  for (const [p, st] of stats) if (st.isDirectory()) watchTree(p);
  for (const [p, st] of stats) {
    if (st.isDirectory()) continue;
    const dir = path.dirname(p);
    if (watchers.has(dir) && !onlyFiles.has(dir)) continue;
    if (!onlyFiles.has(dir)) onlyFiles.set(dir, new Set());
    onlyFiles.get(dir).add(p);
    watchDir(dir);
  }

  if (failed) {
    for (const w of watchers.values()) w.close();
    watchers.clear();
    return startPolling();
  }

  let fallback = null;
  const guard = setInterval(() => {
    if (failed && !fallback && !closed) {
      for (const w of watchers.values()) w.close();
      watchers.clear();
      fallback = startPolling();
    }
  }, 500);
  guard.unref?.();

  return {
    get mode() { return fallback ? 'poll' : 'native'; },
    close() {
      closed = true;
      clearInterval(guard);
      clearTimeout(timer);
      for (const w of watchers.values()) w.close();
      watchers.clear();
      if (fallback) fallback.close();
    },
  };
}

module.exports = { createWatcher, createIgnore };
