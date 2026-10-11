/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

const os = require('node:os');

function lanAddresses() {
  const found = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      const v4 = info.family === 'IPv4' || info.family === 4;
      if (v4 && !info.internal) found.push({ name, address: info.address });
    }
  }
  const rank = (ip) => (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? 0 : 1);
  return found.sort((a, b) => rank(a.address) - rank(b.address));
}

function isLocalAddress(host) {
  if (host === '0.0.0.0' || host === '127.0.0.1' || host === 'localhost') return true;
  if (/^127\./.test(host)) return true;
  if (host === '::' || host === '::1') return true;
  return lanAddresses().some((a) => a.address === host);
}

const isWildcard = (h) => h === '0.0.0.0' || h === '::';
const isLoopback = (h) => h === 'localhost' || /^127\./.test(h) || h === '::1';

function buildUrls(host, port, protocol = 'http') {
  const make = (h) => `${protocol}://${h}:${port}/`;
  if (isWildcard(host)) {
    return {
      local: make('localhost'),
      network: lanAddresses().map((a) => make(a.address)),
      primary: make('localhost'),
    };
  }
  if (isLoopback(host)) {
    const url = make(host === '::1' ? '[::1]' : 'localhost');
    return { local: url, network: [], primary: url };
  }
  const url = make(host.includes(':') ? `[${host}]` : host);
  return { local: null, network: [url], primary: url };
}

module.exports = { lanAddresses, isLocalAddress, buildUrls, isWildcard, isLoopback };
