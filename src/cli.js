/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const pkg = require('../package.json');
const ui = require('./ui');
const { c, log } = ui;
const { WebMakeError } = require('./errors');
const { closest } = require('./util');

const OPTIONS = {
  port: { type: 'number', short: 'p', help: 'Port to listen on', def: '8888' },
  host: { type: 'string', short: 'H', help: 'IPv4 address to bind', def: '0.0.0.0' },
  dir: { type: 'string', short: 'd', help: 'Folder to serve / build', def: './' },
  out: { type: 'string', short: 'o', help: 'Build output folder', def: './dist' },
  config: { type: 'string', short: 'c', help: 'Path to a configuration file', def: 'webmake.dev' },
  watch: { type: 'string', short: 'w', help: 'Path to watch (repeatable)', def: 'dir', multiple: true },
  poll: { type: 'boolnumber', help: 'Poll for changes instead of native events (optional interval in ms)' },
  spa: { type: 'boolstring', help: 'Single-page app fallback (optional file, default index.html)' },
  open: { type: 'boolstring', help: 'Open the browser on start (optional URL path)', def: 'on' },
  livereload: { type: 'bool', help: 'Refresh the browser on changes', def: 'on' },
  'clean-urls': { type: 'bool', help: 'Serve /about as about.html', def: 'on' },
  listing: { type: 'bool', help: 'List folders without index.html', def: 'on' },
  cors: { type: 'bool', help: 'Send CORS headers (Access-Control-Allow-Origin: *)' },
  'strict-port': { type: 'bool', help: 'Fail if the port is busy instead of trying the next one' },
  'not-found': { type: 'string', help: 'Custom 404 file, e.g. 404.html' },
  quiet: { type: 'bool', short: 'q', help: 'Only print warnings and errors' },
  json: { type: 'bool', help: 'Machine-readable output (routes)' },
  force: { type: 'bool', short: 'f', help: 'Overwrite files / allow an output folder outside the project' },
  clean: { type: 'bool', help: 'Empty the output folder before building', def: 'on' },
  color: { type: 'bool', help: 'Force colors on or off (--no-color)' },
  help: { type: 'bool', short: 'h', help: 'Show help' },
  version: { type: 'bool', short: 'v', help: 'Show the version' },
};

const SHORT = Object.fromEntries(Object.entries(OPTIONS).filter(([, o]) => o.short).map(([name, o]) => [o.short, name]));
const camel = (s) => s.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
const usageError = (msg, hint) => new WebMakeError(msg, { hint, exitCode: 2 });

function coerce(name, spec, raw, negated) {
  switch (spec.type) {
    case 'bool':
      if (negated) return false;
      if (raw === undefined) return true;
      if (/^(true|1|yes|on)$/i.test(raw)) return true;
      if (/^(false|0|no|off)$/i.test(raw)) return false;
      throw usageError(`--${name} expects true or false, got "${raw}"`);
    case 'number': {
      if (raw === undefined || !/^\d+$/.test(raw)) throw usageError(`--${name} expects a number, got "${raw === undefined ? '' : raw}"`);
      return parseInt(raw, 10);
    }
    case 'boolstring':
      if (negated) return false;
      return raw === undefined ? true : raw;
    case 'boolnumber':
      if (negated) return false;
      if (raw === undefined) return true;
      if (!/^\d+$/.test(raw)) throw usageError(`--${name} expects a number of milliseconds, got "${raw}"`);
      return parseInt(raw, 10);
    default:
      if (raw === undefined) throw usageError(`--${name} needs a value`);
      return raw;
  }
}

function parseArgs(argv) {
  const out = { command: null, positionals: [], flags: {} };
  const set = (name, spec, value) => {
    const key = camel(name);
    if (spec.multiple) out.flags[key] = [...(out.flags[key] || []), value];
    else out.flags[key] = value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') { out.positionals.push(...argv.slice(i + 1)); break; }

    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      let name = eq < 0 ? arg.slice(2) : arg.slice(2, eq);
      let raw = eq < 0 ? undefined : arg.slice(eq + 1);
      let negated = false;
      if (!OPTIONS[name] && name.startsWith('no-') && OPTIONS[name.slice(3)]) { negated = true; name = name.slice(3); }
      const spec = OPTIONS[name];
      if (!spec) {
        const near = closest(name, Object.keys(OPTIONS));
        throw usageError(`Unknown option --${name}`, near ? `Did you mean --${near}?` : 'Run "webmake --help" to list every option.');
      }
      if (spec.type === 'string' && raw === undefined && !negated) {
        const next = argv[i + 1];
        if (next === undefined || (next.startsWith('-') && next !== '-')) throw usageError(`--${name} needs a value`);
        raw = next;
        i++;
      }
      if (spec.type === 'number' && raw === undefined) {
        raw = argv[i + 1];
        i++;
      }
      set(name, spec, coerce(name, spec, raw, negated));
      continue;
    }

    if (arg.startsWith('-') && arg.length > 1) {
      const letters = arg.slice(1);
      for (let k = 0; k < letters.length; k++) {
        const name = SHORT[letters[k]];
        if (!name) throw usageError(`Unknown option -${letters[k]}`, 'Run "webmake --help" to list every option.');
        const spec = OPTIONS[name];
        if (spec.type === 'string' || spec.type === 'number') {
          let raw = letters.slice(k + 1);
          if (!raw) { raw = argv[i + 1]; i++; }
          if (raw === undefined) throw usageError(`-${letters[k]} needs a value`);
          set(name, spec, coerce(name, spec, raw, false));
          break;
        }
        set(name, spec, coerce(name, spec, undefined, false));
      }
      continue;
    }

    if (out.command === null) out.command = arg;
    else out.positionals.push(arg);
  }
  return out;
}

const COMMANDS = {
  dev: {
    aliases: ['serve', 'start'],
    summary: 'Start the development server with live reload',
    usage: 'webmake dev [dir] [options]',
    options: ['port', 'host', 'dir', 'config', 'watch', 'poll', 'spa', 'open', 'livereload', 'clean-urls', 'listing', 'cors', 'strict-port', 'not-found', 'quiet'],
    examples: ['webmake dev', 'webmake dev ./public --port 3000', 'webmake dev --spa --no-open', 'webmake dev --host 127.0.0.1'],
    load: () => require('./commands/dev').dev,
  },
  build: {
    aliases: [],
    summary: 'Copy the site to the output folder and export normalized redirects',
    usage: 'webmake build [dir] [options]',
    options: ['dir', 'out', 'config', 'clean', 'force', 'quiet'],
    examples: ['webmake build', 'webmake build ./site --out ./public'],
    load: () => require('./commands/build').build,
  },
  routes: {
    aliases: ['redirects'],
    summary: 'Show every detected redirect, rewrite and header rule',
    usage: 'webmake routes [dir] [options]',
    options: ['dir', 'config', 'json'],
    examples: ['webmake routes', 'webmake routes --json'],
    load: () => require('./commands/routes').routes,
  },
  init: {
    aliases: [],
    summary: 'Create a documented webmake.dev configuration file',
    usage: 'webmake init [options]',
    options: ['force'],
    examples: ['webmake init'],
    load: () => require('./commands/init').init,
  },
};

function findCommand(name) {
  if (COMMANDS[name]) return name;
  return Object.keys(COMMANDS).find((k) => COMMANDS[k].aliases.includes(name)) || null;
}

function optionLine(name) {
  const o = OPTIONS[name];
  const flag = `${o.short ? `-${o.short}, ` : '    '}--${name}${o.type === 'string' ? ' <value>' : o.type === 'number' ? ' <n>' : ''}`;
  return `  ${c.soft(ui.padEnd(flag, 28))} ${o.help}${o.def ? c.muted(`  (default: ${o.def})`) : ''}`;
}

function helpText(commandName) {
  const lines = [''];
  if (commandName) {
    const cmd = COMMANDS[commandName];
    lines.push(`  ${c.bold(cmd.summary)}`, '', `  ${c.muted('Usage')}`, `    ${c.soft(cmd.usage)}`, '');
    lines.push(`  ${c.muted('Options')}`, ...cmd.options.map(optionLine), '');
    lines.push(`  ${c.muted('Examples')}`, ...cmd.examples.map((e) => `    ${c.soft(e)}`), '');
    return lines.join('\n');
  }
  lines.push(
    `  ${c.muted('Usage')}`,
    `    ${c.soft('webmake <command> [options]')}`,
    '',
    `  ${c.muted('Commands')}`,
    ...Object.entries(COMMANDS).map(([name, cmd]) => `    ${c.bold(ui.padEnd(name, 8))} ${cmd.summary}${cmd.aliases.length ? c.muted(`  (${cmd.aliases.join(', ')})`) : ''}`),
    '',
    `  ${c.muted('Common options')}`,
    ...['port', 'host', 'dir', 'spa', 'open', 'config', 'help', 'version'].map(optionLine),
    '',
    `  ${c.muted('Examples')}`,
    `    ${c.soft('webmake dev')}                 ${c.muted('serve the current folder on http://localhost:8888')}`,
    `    ${c.soft('webmake dev --spa --port 3000')}`,
    `    ${c.soft('webmake routes')}              ${c.muted('see which redirect files were detected')}`,
    `    ${c.soft('webmake init')}                ${c.muted('create a webmake.dev file')}`,
    '',
    `  ${c.muted('Run')} ${c.soft('webmake <command> --help')} ${c.muted('for the options of a command.')}`,
    `  ${c.muted(`© 2026 FarTekTV · Rafael ISTE · MIT License · v${pkg.version}`)}`,
    '',
  );
  return lines.join('\n');
}

async function run(argv, { cwd = process.cwd() } = {}) {
  try {
    const args = parseArgs(argv);
    const { flags } = args;

    if (flags.color === false) ui.setLevel(0);
    else if (flags.color === true && ui.getLevel() === 0) ui.setLevel(3);
    delete flags.color;

    if (flags.version) { process.stdout.write(`${pkg.version}\n`); return 0; }

    if (args.command === 'help') {
      const target = args.positionals[0] && findCommand(args.positionals[0]);
      process.stdout.write(`${helpText(target)}\n`);
      return 0;
    }

    if (!args.command) {
      if (!flags.help) ui.printBanner();
      process.stdout.write(`${helpText()}\n`);
      return 0;
    }

    const name = findCommand(args.command);
    if (!name) {
      const near = closest(args.command, [...Object.keys(COMMANDS), ...Object.values(COMMANDS).flatMap((x) => x.aliases)]);
      throw usageError(`Unknown command "${args.command}"`, near ? `Did you mean "webmake ${near}"?` : 'Run "webmake --help" to list the commands.');
    }
    if (flags.help) { process.stdout.write(`${helpText(name)}\n`); return 0; }
    delete flags.help;
    delete flags.version;

    const handler = COMMANDS[name].load();
    await handler({ flags, positionals: args.positionals, cwd });
    return 0;
  } catch (err) {
    if (err instanceof WebMakeError) {
      log.error(err.message, err.hint);
      return err.exitCode;
    }
    log.error(err && err.message ? err.message : String(err), 'This looks like a bug. Run with DEBUG=webmake for details.');
    if (process.env.DEBUG && /webmake/.test(process.env.DEBUG) && err && err.stack) process.stderr.write(`${err.stack}\n`);
    return 1;
  }
}

module.exports = { run, parseArgs, helpText, OPTIONS, COMMANDS };
