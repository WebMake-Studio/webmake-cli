<div align="center">

```
╭──────────────────────────────────────────────────╮
│  ● ● ●                                           │
│                                                  │
│  ╲  ╱╲  ╱   WebMake CLI v2.0.0                   │
│   ╲╱  ╲╱    Build the extraordinary on the web.  │
│                                                  │
╰──────────────────────────────────────────────────╯
```

# WebMake CLI

**A fast, zero-dependency dev server for static sites and SPAs.**
Live reload, universal redirect support (`_redirects`, `netlify.toml`, `vercel.json`, `firebase.json`, `.htaccess`…) and clean 404 handling, from one command: `webmake dev`.

[![CI](https://github.com/WebMake-Studio/webmake-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/WebMake-Studio/webmake-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/webmake-cli?style=flat-square&color=3d3df0&label=npm)](https://www.npmjs.com/package/webmake-cli)
[![node](https://img.shields.io/badge/node-%E2%89%A5%2018.17-5b5bf0?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-0-34d399?style=flat-square)](package.json)
[![tests](https://img.shields.io/badge/tests-70%20passing-34d399?style=flat-square)](test)
[![license](https://img.shields.io/badge/license-MIT-9b8cff?style=flat-square)](LICENSE)
[![platforms](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-8b88a8?style=flat-square)](#requirements)

</div>

---

## Table of contents

- [Why WebMake CLI](#why-webmake-cli)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Configuration: `webmake.dev`](#configuration-webmakedev)
- [Redirects, rewrites and headers](#redirects-rewrites-and-headers)
- [404 pages and SPA mode](#404-pages-and-spa-mode)
- [Live reload](#live-reload)
- [Network access and ports](#network-access-and-ports)
- [Terminal shortcuts](#terminal-shortcuts)
- [Programmatic API](#programmatic-api)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [License and copyright](#license-and-copyright)

---

## Why WebMake CLI

| | |
|---|---|
| **Zero dependencies** | Nothing to audit, nothing to break. `npm install` pulls a single small package. |
| **Understands your redirects** | Detects `_redirects` under its usual *and* unusual names, plus `netlify.toml`, `vercel.json`, `firebase.json`, `staticwebapp.config.json` and `.htaccess`, then behaves like the real host. |
| **Proper 404s** | Real `404` status code, your own `404.html` (nearest one wins), or a polished built-in page. |
| **Live reload** | Edit HTML and the browser refreshes. Edit CSS and styles hot-swap with no reload. |
| **SPA ready** | `spa: true` sends unknown routes to `index.html` (or `200.html`) like production does. |
| **Network ready** | Binds IPv4 and prints a Local and a Network URL, so you can test on your phone. |
| **Friendly in the terminal** | Colored output using the WebMake Studio palette, clear English messages, helpful hints on every error. |

## Requirements

- **Node.js 18.17 or newer** (LTS recommended). Check with `node -v`.
- Windows, macOS or Linux.

## Installation

### Global install (recommended): use `webmake` anywhere

```bash
npm install -g webmake-cli
```

That is all. **No `npm link` is needed.** The `webmake` command is available in every terminal immediately:

```bash
webmake --version
webmake dev
```

### Local install: per project

```bash
npm install --save-dev webmake-cli
```

Run it with `npx`, or add a script to your `package.json`:

```json
{
  "scripts": {
    "dev": "webmake dev"
  }
}
```

```bash
npx webmake dev      # or: npm run dev
```

> **Why `npx` for local installs?** This is how npm works for every CLI: a package installed *inside* a project is not added to your global PATH. Use the global install if you want to type `webmake` directly.

### From the ZIP (offline)

```bash
cd webmake-cli
npm install -g .
```

## Quick start

```bash
cd my-website
webmake dev
```

```
  ✔ Ready in 20 ms

  ➜  Local     http://localhost:8888/
  ➜  Network   http://192.168.1.24:8888/
  ➜  Serving   .  (live reload · clean URLs)
  ➜  Config    webmake.dev
  ➜  Routing   _redirects (4 rules) · _headers (2 header blocks)

  press o open · r reload · u urls · c clear · q quit
```

Your browser opens automatically on `http://localhost:8888`. Want to try everything at once? Run the bundled demo:

```bash
npm run demo        # serves examples/demo-site
```

## Commands

| Command | What it does |
|---|---|
| `webmake dev [dir]` | Start the development server with live reload. Aliases: `serve`, `start`. |
| `webmake build [dir]` | Copy the site to the output folder and export normalized `_redirects` / `_headers`. |
| `webmake routes [dir]` | Show every detected redirect, rewrite and header rule (`--json` for scripts). |
| `webmake init` | Create a documented `webmake.dev` file. |
| `webmake help [command]` | Show help. `webmake <command> --help` works too. |

### Options

| Option | Description | Default |
|---|---|---|
| `-p, --port <n>` | Port to listen on | `8888` |
| `-H, --host <ip>` | IPv4 address to bind | `0.0.0.0` |
| `-d, --dir <path>` | Folder to serve / build | `./` |
| `-o, --out <path>` | Build output folder | `./dist` |
| `-c, --config <file>` | Use a specific configuration file | `webmake.dev` |
| `-w, --watch <path>` | Path to watch (repeatable) | the served folder |
| `--poll[=ms]` | Poll for changes instead of native events | off |
| `--spa[=file]` | Single-page-app fallback | off |
| `--open[=path]` / `--no-open` | Open the browser on start | on |
| `--no-livereload` | Disable automatic refresh | on |
| `--no-clean-urls` | Do not map `/about` to `about.html` | on |
| `--no-listing` | Do not list folders without `index.html` | on |
| `--cors` | Send `Access-Control-Allow-Origin: *` | off |
| `--strict-port` | Fail if the port is busy | off |
| `--not-found <file>` | Custom 404 file | auto |
| `-q, --quiet` | Print only warnings and errors | off |
| `--no-color` | Disable colors (`NO_COLOR` is also respected) | auto |
| `--json` | JSON output (`routes`) | off |
| `-f, --force` | Overwrite (`init`) / allow an output folder outside the project (`build`) | off |
| `--no-clean` | Do not empty the output folder first (`build`) | on |
| `-h, --help` / `-v, --version` | Help / version | |

Examples:

```bash
webmake dev                              # current folder, port 8888
webmake dev ./public --port 3000         # another folder and port
webmake dev --spa --no-open              # SPA mode, no browser
webmake dev --host 127.0.0.1             # only this computer can connect
webmake build --out ./public             # export to ./public
webmake routes --json | jq .rules        # inspect rules in scripts
```

## Configuration: `webmake.dev`

Create a file named **`webmake.dev`** in your project folder (or run `webmake init`). It is a plain CommonJS module:

```javascript
module.exports = {
    dir: './',
    out: './',
    port: 8888,
    host: '192.168.1.24',
    watch: '.',
    poll: false,
    spa: true,
    open: true,
};
```

> **Note on `host`:** if the address is not one of your computer's addresses (for example your IP changed), WebMake prints a warning and listens on `0.0.0.0` instead of crashing.
> **Note on `out`:** `out: './'` is accepted for `dev`, but `webmake build` refuses an output folder equal to the source folder. Use `./dist` (the default).

**Precedence:** built-in defaults → `webmake.dev` → command-line flags.
Other accepted file names: `webmake.dev.js`, `webmake.config.js`, `webmake.config.json`. The file may also export a function returning the object.

### All options

| Option | Type | Default | Description |
|---|---|---|---|
| `dir` | `string` | `'./'` | Folder to serve. |
| `out` | `string` | `'./dist'` | Folder written by `webmake build`. |
| `port` | `number` | `8888` | Port. If busy, the next free port is used. |
| `host` | `string` | `'0.0.0.0'` | IPv4 address to bind. `0.0.0.0` = all interfaces, `127.0.0.1` = local only. |
| `watch` | `string \| string[] \| false \| null` | `null` (= `dir`) | Paths to watch. `false` disables watching. |
| `poll` | `boolean \| number` | `false` | Polling mode; a number sets the interval in ms. Use on network drives, Docker, WSL. |
| `spa` | `boolean \| string` | `false` | `true` serves `200.html` or `index.html` for unknown page URLs. A string sets the file. |
| `open` | `boolean \| string` | `true` | Open the browser. A string such as `'/docs/'` opens that path. |
| `cleanUrls` | `boolean` | `true` | `/about` serves `about.html`. |
| `livereload` | `boolean` | `true` | Inject the live-reload client into HTML pages. |
| `listing` | `boolean` | `true` | Show a folder listing when there is no `index.html`. |
| `cors` | `boolean` | `false` | Add permissive CORS headers. |
| `strictPort` | `boolean` | `false` | Fail instead of trying the next port. |
| `ignore` | `string[]` | `[]` | Names or relative paths the watcher must ignore. |
| `notFound` | `string \| null` | `null` | Custom 404 file, e.g. `'404.html'`. |
| `redirects` | `Array<{from, to, status?, force?}>` | `[]` | Inline rules, evaluated first. |
| `headers` | `Array<{for, values}>` | `[]` | Inline response headers. |
| `quiet` | `boolean` | `false` | Only print warnings and errors. |

Invalid values are reported all at once with a clear message, and a typo such as `prot` gets a *"did you mean `port`?"* hint.

## Redirects, rewrites and headers

WebMake looks for these files in the served folder, the project folder, and the conventional `public/` and `static/` folders, **then applies them like the real host would**.

| Format | Detected file names | Supported |
|---|---|---|
| **Netlify / Cloudflare Pages** | `_redirects`, `redirects`, `.redirects`, `_redirect`, `redirects.txt`, `_redirects.txt` (any letter case) | Status codes, `!` force, `*` splat, `:placeholders`, query matching, proxy to external URLs |
| Headers (same family) | `_headers`, `headers`, `.headers`, `headers.txt`, `_headers.txt` | Path patterns with splat and placeholders |
| **Netlify config** | `netlify.toml` | `[[redirects]]` (incl. `force`, `query`), `[[headers]]` |
| **Vercel** | `vercel.json`, `now.json` | `redirects`, `rewrites`, `headers`, legacy `routes` |
| **Firebase Hosting** | `firebase.json` | `redirects`, `rewrites`, `headers`, glob and `regex` sources |
| **Azure Static Web Apps** | `staticwebapp.config.json` | `routes`, `navigationFallback`, `responseOverrides.404`, `globalHeaders` |
| **Apache** | `.htaccess` | `Redirect*`, `RedirectMatch`, `RewriteRule` (with `!-f` / `!-d`), `ErrorDocument 404`, `Header set` |

### How rules are evaluated

1. Rules are checked **in order**; the first match wins. Order of sources: `webmake.dev` → `_redirects` → `netlify.toml` → `vercel.json` → `firebase.json` → `staticwebapp.config.json` → `.htaccess`.
2. A **normal rule never hides a real file** (same as Netlify). Add `!` (`/old /new 301!`) to force it.
3. `301/302/303/307/308` redirect, `200` rewrites (the URL does not change), `404/410/...` with a target serves that page with that status.
4. A destination starting with `http(s)://` and status `200` is **proxied** to that server.
5. Query strings are preserved on redirects.

```text
# _redirects
/old-page        /about             301
/news/*          /blog/:splat       302
/blog/*          /blog.html         200
/store  id=:id   /products/:id      301
/api/*           https://api.example.com/:splat  200
/*               /404.html          404
```

### What is skipped (and why)

Some conditions cannot be evaluated on a local server: `Country`, `Language` and `Role` conditions, host-based rules, Vercel `has` / `missing`, Firebase Cloud Function rewrites, non-404 Azure overrides, `.htaccess` conditions other than `!-f` / `!-d`. Such rules are **skipped, never guessed**: `webmake dev` prints a warning, and `webmake routes` (or `http://localhost:8888/__webmake/routes`) lists each one with its reason.

## 404 pages and SPA mode

Resolution order for an unknown URL:

1. A rule that serves a page (`/* /404.html 404`).
2. `notFound` from `webmake.dev`, `ErrorDocument 404` or Azure `responseOverrides.404`.
3. The **nearest `404.html`**, walking up from the requested folder (`/docs/missing` tries `docs/404.html`, then `404.html`).
4. The built-in WebMake page.

All of them answer with a real **404** status code.

With `spa: true`, unknown URLs **that look like pages** (no file extension, and the browser asks for `text/html`) serve `200.html` if present, otherwise `index.html`. Missing assets such as `/missing.js` and API calls still return 404, which keeps real errors visible.

## Live reload

- HTML, JS, images and any other file change: the page reloads.
- CSS change: styles are **hot-swapped** without reloading, so form state and scroll position are kept.
- Changing `_redirects`, `_headers`, `netlify.toml`… reloads the routing rules instantly.
- Changing `webmake.dev` shows a reminder to restart.
- Folders such as `node_modules`, `.git` and the build output are never watched.
- If the server restarts, open pages reconnect and reload by themselves.

## Network access and ports

- WebMake binds **IPv4 only**. With the default host `0.0.0.0` it prints a `Local` URL and one `Network` URL per interface, so you can open the site on your phone on the same Wi-Fi.
- Use `host: '127.0.0.1'` (or `--host 127.0.0.1`) to restrict access to your own computer.
- If the port is busy, WebMake moves to the next free one and tells you. Use `strictPort` to fail instead.
- Ports below 1024 may need administrator rights.

## Terminal shortcuts

| Key | Action |
|---|---|
| `o` | Open the site in your browser |
| `r` | Force a reload in every connected browser |
| `u` | Print the URLs again |
| `c` | Clear the terminal |
| `q` / `Ctrl+C` | Quit |

## Programmatic API

```javascript
const { startServer } = require('webmake-cli');

const app = await startServer({ dir: './public', port: 3000, open: false, spa: true });
console.log(app.urls.local);   // http://localhost:3000/
app.reload();                  // refresh connected browsers
await app.close();
```

`startServer` accepts the same options as `webmake.dev` plus `cwd`. It prints nothing and never calls `process.exit`.

## Security

WebMake CLI is a **development tool**. Do not use it as a production server.

- Path traversal is impossible (`..`, encoded variants, backslashes and NUL bytes are rejected).
- Dot-files and dot-folders (`.env`, `.git`) and configuration files (`_redirects`, `webmake.dev`, …) are **never served** and never listed.
- All user-controlled text in built-in pages is HTML-escaped.
- Values captured by redirect rules are URL-encoded and cannot create open redirects or inject headers.
- With `host: '0.0.0.0'`, **everyone on your network** can read the served folder. Use `127.0.0.1` on shared or public Wi-Fi.
- `webmake.dev` is JavaScript executed by Node: only use configuration files you trust.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `webmake: command not found` after a local install | Use `npx webmake dev`, or install globally with `npm install -g webmake-cli`. |
| "Host … is not an address of this computer" | Your IP changed. Fix `host` in `webmake.dev` or use `0.0.0.0`. |
| "Port 8888 is already in use" | Another program uses it. Close it, pick `--port 3000`, or drop `strictPort`. |
| Changes are not detected (Docker, WSL, network drive) | Enable polling: `poll: true` or `--poll`. |
| Phone cannot open the Network URL | Same Wi-Fi? Allow Node.js in your firewall; avoid guest networks that isolate devices. |
| A redirect rule does nothing | Run `webmake routes`: the rule may be shadowed by a real file (add `!`) or skipped. |
| `/route` returns 404 in SPA mode | Check that `index.html` exists and the request accepts `text/html` (browser navigation does; `curl` needs `-H "Accept: text/html"`). |
| Colors look wrong | Set `NO_COLOR=1` to disable, or use a terminal with 256 / true color. |

Run with `DEBUG=webmake` to print stack traces for unexpected errors.

## Project structure

```text
webmake-cli/
├─ bin/webmake.js          Executable entry point
├─ src/
│  ├─ cli.js               Argument parsing, help, dispatch
│  ├─ config.js            webmake.dev loading and validation
│  ├─ detect.js            Finds and loads redirect / header files
│  ├─ router.js            Request resolution (rules, files, fallbacks, 404)
│  ├─ server.js            HTTP server, live reload (SSE), proxy, ranges
│  ├─ watcher.js           Native and polling file watcher
│  ├─ patterns.js          Pattern dialects (netlify, vercel, firebase, regex)
│  ├─ pages.js             Built-in HTML pages
│  ├─ ui.js                Colors, banner, logger, tables
│  ├─ commands/            dev, build, routes, init
│  └─ parsers/             _redirects, toml, netlify, vercel, firebase, swa, htaccess
├─ test/                   70 tests (node:test, no dependencies)
├─ examples/demo-site/     Ready-to-run demo
└─ docs/                   Technical, functional and specification documents
```

## Documentation

- [`docs/DOCUMENTATION.fr.md`](docs/DOCUMENTATION.fr.md): technical and functional documentation (architecture, dependencies, use cases, recommendations, points of attention), in French.
- [`docs/CAHIER_DES_CHARGES.fr.md`](docs/CAHIER_DES_CHARGES.fr.md): structured specification, in French.
- [`CHANGELOG.md`](CHANGELOG.md): release notes.

## License and copyright

Released under the [MIT License](LICENSE).

**© 2026 FarTekTV. All rights reserved on the WebMake name and branding.**
Source code copyright © 2026 Rafael ISTE.

<div align="center"><sub>Built with care by FarTekTV · WebMake Studio</sub></div>
