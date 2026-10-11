/*! WebMake CLI - Copyright (c) 2026 Rafael ISTE - MIT License */
'use strict';

class WebMakeError extends Error {
  constructor(message, { hint, exitCode = 1, code } = {}) {
    super(message);
    this.name = 'WebMakeError';
    this.hint = hint;
    this.exitCode = exitCode;
    this.code = code;
  }
}

module.exports = { WebMakeError };
