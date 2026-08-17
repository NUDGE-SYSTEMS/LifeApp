import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

// Invoke the local Expo CLI's JS entry with the current node binary. Avoids `npx`,
// which on Windows resolves to npx.cmd and therefore needs `shell: true` — that
// combination is both slower and deprecated (DEP0190) when passing an args array.
const CLI = path.join(ROOT, 'node_modules', 'expo', 'bin', 'cli');

/** Spawn `expo <args>` with inherited stdio. Returns the ChildProcess. */
export function spawnExpo(args, { env = process.env } = {}) {
  if (fs.existsSync(CLI)) {
    return spawn(process.execPath, [CLI, ...args], { stdio: 'inherit', cwd: ROOT, env });
  }
  // No node_modules yet — fall back to npx, which needs a shell on Windows.
  return spawn('npx', ['expo', ...args], { stdio: 'inherit', cwd: ROOT, env, shell: true });
}

/** Run `expo <args>` to completion. Resolves with the exit code. */
export function runExpo(args, opts) {
  return new Promise(resolve => spawnExpo(args, opts).on('exit', code => resolve(code ?? 0)));
}
