#!/usr/bin/env node
// Point git at the versioned .githooks/ directory.
//
// core.hooksPath lives in .git/config, which is NOT versioned — so every clone has
// to opt in once. Wired to npm's `prepare` lifecycle so `npm install` handles it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

const HOOKS_DIR = '.githooks';

// No .git (tarball, CI checkout, install as a dependency) → nothing to configure.
if (!fs.existsSync(path.join(ROOT, '.git'))) process.exit(0);
if (!fs.existsSync(path.join(ROOT, HOOKS_DIR))) process.exit(0);

const r = spawnSync('git', ['config', 'core.hooksPath', HOOKS_DIR], {
  cwd: ROOT, encoding: 'utf8',
});

if (r.status !== 0) {
  console.warn(`warning: could not set core.hooksPath — run \`git config core.hooksPath ${HOOKS_DIR}\` yourself.`);
  process.exit(0); // never fail an install over this
}

// Git needs the exec bit on POSIX. Harmless no-op on Windows.
if (process.platform !== 'win32') {
  for (const hook of fs.readdirSync(path.join(ROOT, HOOKS_DIR))) {
    try { fs.chmodSync(path.join(ROOT, HOOKS_DIR, hook), 0o755); } catch {}
  }
}
