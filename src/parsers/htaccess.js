/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const { tryRule, tryHeaderRule, EXTERNAL } = require('../rules');
const { escapeRe } = require('../patterns');

const STATUS_WORDS = { permanent: 301, temp: 302, seeother: 303, gone: 410 };

function splitArgs(line) {
  const args = [];
  let cur = '';
  let quoted = false;
  let started = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; started = true; }
    else if (/\s/.test(ch) && !quoted) {
      if (started) { args.push(cur); cur = ''; started = false; }
    } else { cur += ch; started = true; }
  }
  if (started) args.push(cur);
  return args;
}

function parseHtaccess(text, { file = '.htaccess' } = {}) {
  const rules = [];
  const headers = [];
  const warnings = [];
  let notFound = null;

  const logical = [];
  let buf = null;
  String(text).split(/\r?\n/).forEach((l, i) => {
    if (buf) { buf.text += l.trim(); } else { buf = { text: l, no: i + 1 }; }
    if (/\\\s*$/.test(buf.text)) buf.text = buf.text.replace(/\\\s*$/, ' ');
    else { logical.push(buf); buf = null; }
  });
  if (buf) logical.push(buf);

  let skipDepth = 0;
  let conds = [];

  for (const { text: raw, no } of logical) {
    const t = raw.trim();
    if (!t || t.startsWith('#')) continue;
    const origin = `${file}:${no}`;

    const open = /^<([A-Za-z]+)\b/.exec(t);
    const close = /^<\/([A-Za-z]+)\s*>/.exec(t);
    if (skipDepth > 0) {
      if (open) skipDepth++;
      else if (close) skipDepth--;
      continue;
    }
    if (open) {
      if (open[1].toLowerCase() !== 'ifmodule') skipDepth = 1;
      continue;
    }
    if (close) continue;

    const args = splitArgs(t);
    const directive = args[0].toLowerCase();

    if (['redirect', 'redirectpermanent', 'redirecttemp', 'redirectseeother', 'redirectmatch'].includes(directive)) {
      const isMatch = directive === 'redirectmatch';
      let status = { redirect: 302, redirectpermanent: 301, redirecttemp: 302, redirectseeother: 303 }[directive] || 302;
      let i = 1;
      if (/^\d{3}$/.test(args[i] || '')) status = parseInt(args[i++], 10);
      else if (args[i] && STATUS_WORDS[args[i].toLowerCase()]) status = STATUS_WORDS[args[i++].toLowerCase()];
      const source = args[i++];
      const target = args[i];
      if (!source || (!target && status !== 410)) { warnings.push(`${origin}: ${args[0]} needs a source and a target`); continue; }

      let def;
      if (isMatch) {
        def = { from: source, to: target || '', style: 'regex', ignoreCase: false };
      } else {
        const src = source.length > 1 ? source.replace(/\/+$/, '') : source;
        const dst = target ? target.replace(/\/+$/, '') : '';
        def = {
          from: `^${escapeRe(src === '/' ? '' : src)}(/.*)?$`,
          to: dst ? `${dst}$1` : '',
          style: 'regex',
          ignoreCase: false,
          display: `${src}/*`,
        };
      }
      const rule = tryRule({ ...def, status, force: true, origin, file }, warnings);
      if (rule) rules.push(rule);
      continue;
    }

    if (directive === 'rewritecond') { conds.push(args.slice(1)); continue; }

    if (directive === 'rewriterule') {
      const [, pattern, substitution, flagText = ''] = args;
      const pendingConds = conds;
      conds = [];
      if (!pattern || !substitution) { warnings.push(`${origin}: RewriteRule needs a pattern and a substitution`); continue; }
      const flags = flagText.replace(/^\[|\]$/g, '').split(',').map((f) => f.trim()).filter(Boolean);
      const flag = (name) => flags.find((f) => f.toLowerCase() === name || f.toLowerCase().startsWith(`${name}=`));

      let nonForced = false;
      let unsupported = pattern.startsWith('!') ? 'negated RewriteRule patterns are not supported' : null;
      for (const [test, expr] of pendingConds) {
        if (test === '%{REQUEST_FILENAME}' && /^!-[fdl]$/.test(expr || '')) nonForced = true;
        else if (!unsupported) unsupported = `RewriteCond ${test} ${expr || ''} is not evaluated in dev`.trim();
      }

      let status = 200;
      const r = flag('r');
      if (r) status = r.includes('=') ? parseInt(r.split('=')[1], 10) || 302 : 302;
      if (flag('f')) status = 403;
      if (flag('g')) status = 410;

      if (substitution === '-' && status < 400) continue;
      let to = substitution === '-' ? '' : substitution;
      if (to && !EXTERNAL.test(to) && !to.startsWith('/')) to = `/${to}`;

      const rule = tryRule(
        {
          from: pattern,
          to,
          status,
          force: !nonForced,
          style: 'regex',
          ignoreCase: !!flag('nc'),
          stripSlash: true,
          unsupported,
          display: pattern,
          origin,
          file,
        },
        warnings,
      );
      if (rule) rules.push(rule);
      continue;
    }

    if (directive === 'errordocument') {
      if (args[1] === '404' && args[2] && args[2].startsWith('/')) notFound = { to: args[2], status: 404, origin };
      continue;
    }

    if (directive === 'header') {
      const rest = args.slice(1);
      if (rest[0] && rest[0].toLowerCase() === 'always') rest.shift();
      const action = (rest[0] || '').toLowerCase();
      if (['set', 'append', 'add', 'merge'].includes(action) && rest[1] && rest[2] !== undefined) {
        const hr = tryHeaderRule({ pattern: '/*', values: { [rest[1]]: rest[2] }, origin, file, style: 'netlify' }, warnings);
        if (hr) headers.push(hr);
      }
      continue;
    }
  }

  return { rules, headers, warnings, notFound };
}

module.exports = { parseHtaccess, splitArgs };
