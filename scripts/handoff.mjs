#!/usr/bin/env node
// Keeps HANDOFF.md — the "where we left off" file — current between Claude sessions.
//
// HANDOFF.md has two parts:
//   notes  (between the notes markers) — written by Claude: where we stopped, next step,
//          blockers, how-tos. This script never touches it.
//   auto   (between the auto markers)  — regenerated here from git + the project tracker.
//
// Run by Claude Code hooks (.claude/settings.local.json):
//   SessionStart → `node scripts/handoff.mjs --print`  refresh, then hand the file to Claude
//   Stop         → `node scripts/handoff.mjs`          refresh quietly after every reply
//
// Plain Node ESM, no dependencies — see CLAUDE.md "Platforms".

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'HANDOFF.md');
const TRACKER = 'C:/Users/KEVIN/projects/project-tracker/tracker-cli.js';

const NOTES_START = '<!-- notes:start -->';
const NOTES_END = '<!-- notes:end -->';
const AUTO_START = '<!-- auto:start -->';
const AUTO_END = '<!-- auto:end -->';

const DEFAULT_NOTES = `## Where we stopped
_Nothing recorded yet._

## Next step
_Nothing recorded yet._`;

function run(cmd, args) {
  try {
    // trimEnd, not trim: `git status --short` lines start with a meaningful space.
    return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return null;
  }
}

function gitSection() {
  const branch = run('git', ['branch', '--show-current']) ?? '(unknown)';
  const status = run('git', ['status', '--short']);
  const log = run('git', ['log', '-5', '--format=%h %ad %s', '--date=short']);
  const lines = [`**Branch:** \`${branch}\``, ''];
  lines.push(status ? `**Uncommitted:**\n\`\`\`\n${status}\n\`\`\`` : '**Uncommitted:** none — working tree clean');
  if (log) lines.push('', `**Last commits:**\n\`\`\`\n${log}\n\`\`\``);
  return lines.join('\n');
}

function trackerSection() {
  if (!existsSync(TRACKER)) return '_Project tracker not found._';
  const out = run('node', [TRACKER, 'status']);
  if (!out) return '_Project tracker did not respond._';

  const open = out.split('\n').filter(l => l.trim().startsWith('[ ]')).map(l => `- ${l.trim().slice(4)}`);
  const notesAt = out.indexOf('— notes:');
  const notes = notesAt === -1 ? [] : out.slice(notesAt).split('\n').filter(l => l.trim().startsWith('- ')).map(l => l.trim());

  return [
    `**Open tasks (${open.length}):**`,
    open.length ? open.join('\n') : '- none',
    '',
    '**Latest tracker notes:**',
    notes.length ? notes.slice(-6).join('\n') : '- none',
  ].join('\n');
}

function between(text, start, end) {
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  return a !== -1 && b > a ? text.slice(a + start.length, b).trim() : null;
}

const existing = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
const notes = between(existing, NOTES_START, NOTES_END) ?? DEFAULT_NOTES;
const stamp = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const doc = `# LifeOS — session handoff

Open this instead of resuming an old session. The first part is kept current by Claude as work
happens; the second part regenerates itself from git and the project tracker
(\`scripts/handoff.mjs\`, run by hooks at session start and after every Claude reply).

${NOTES_START}
${notes}
${NOTES_END}

---

${AUTO_START}
## Auto snapshot — ${stamp}

${gitSection()}

${trackerSection()}
${AUTO_END}
`;

writeFileSync(FILE, doc);

if (process.argv.includes('--print')) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `HANDOFF.md — state carried over from the previous session. Pick up from "Next step" and keep the notes section current as you work:\n\n${doc}`,
    },
  }));
}
