import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Minimal .env loader — cross-platform stand-in for the shell scripts'
 * `export $(grep -v '^#' .env | xargs)`. Existing process env always wins.
 */
export function loadEnvFile(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["'](.*)["']$/, '$1');
    out[key] = value;
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return out;
}

export { ROOT };
