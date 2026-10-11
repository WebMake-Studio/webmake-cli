# Changelog

All notable changes to WebMake CLI are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/), versioning follows [SemVer](https://semver.org/).

Copyright (c) 2026 Rafael ISTE · FarTekTV

## [2.0.0] - 2026-10-10

Complete rewrite. **Breaking:** the previous 1.0.0 relied on `chokidar`, `dotenv` and `ws`; 2.0.0 has **zero dependencies**.

### Added
- `webmake dev` development server with IPv4 binding, automatic port fallback and Local / Network URLs.
- Universal redirect support: `_redirects` (and alternative names), `_headers`, `netlify.toml`, `vercel.json`, `firebase.json`, `staticwebapp.config.json`, `.htaccess`.
- Netlify semantics: ordered rules, `!` force, splat, placeholders, query matching, proxy rewrites.
- 404 handling: rule pages, `ErrorDocument`, Azure overrides, nearest `404.html`, built-in branded page.
- SPA mode (`200.html` / `index.html` / custom file) restricted to page-like requests.
- Live reload over Server-Sent Events with CSS hot-swap, hot reload of routing files, and reconnect after restart.
- `webmake.dev` configuration with validation, typo suggestions and JSON / function variants.
- `webmake build` (copy + normalized `_redirects` / `_headers` export), `webmake routes`, `webmake init`.
- Native and polling file watcher that never descends into `node_modules`, `.git` or the build folder.
- Terminal shortcuts (`o`, `r`, `u`, `c`, `q`), WebMake Studio color palette, `NO_COLOR` support.
- Programmatic API (`startServer`).
- 70 automated tests using `node:test`.

### Security
- Path traversal, hidden files and configuration files are never served; built-in pages escape all user input; redirect captures are encoded.
