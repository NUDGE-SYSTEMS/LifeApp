#!/usr/bin/env node
// Check that this machine can build LifeOS for Android (and iOS where possible).
//   npm run doctor
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { lanIp } from './lan-ip.mjs';
import { ROOT } from './env.mjs';

const rows = [];
const add = (name, ok, detail) => rows.push({ name, ok, detail });

// stdout + stderr combined — `java -version` reports on stderr.
function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
}

add('Node', true, process.version);
add('Dependencies', fs.existsSync(path.join(ROOT, 'node_modules')), fs.existsSync(path.join(ROOT, 'node_modules')) ? 'installed' : 'run `npm install`');

const java = sh('java', ['-version']);
const javaLine = java?.split('\n')[0] ?? '';
const javaMajor = Number(javaLine.match(/"(\d+)/)?.[1] ?? 0);
add('JDK 17+', javaMajor >= 17, javaLine || 'not found — install Temurin/Microsoft JDK 17');

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
add('Android SDK', Boolean(sdk && fs.existsSync(sdk)), sdk || 'set ANDROID_HOME to your SDK path');

const adb = sdk ? path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : null;
const adbOk = Boolean(adb && fs.existsSync(adb));
add('adb', adbOk, adbOk ? adb : 'install Android SDK Platform-Tools');

if (adbOk) {
  const devices = (sh(adb, ['devices']) ?? '')
    .split('\n').slice(1)
    .map(l => l.trim()).filter(l => l && !l.startsWith('*'));
  add('Android device', devices.length > 0, devices.length ? devices.join(', ') : 'none — enable USB debugging or start an emulator');
}

const ip = lanIp();
add('LAN IP', Boolean(ip), ip || 'not on a network — Metro is unreachable from a phone');

const mac = process.platform === 'darwin';
add('iOS builds', mac, mac ? 'local Xcode builds available' : `not on ${process.platform} — use \`npm run build:preview\` (EAS cloud)`);

const pad = Math.max(...rows.map(r => r.name.length));
console.log('');
for (const r of rows) console.log(`  ${r.ok ? 'OK  ' : 'MISS'}  ${r.name.padEnd(pad)}  ${r.detail}`);
console.log('');

// iOS-on-Windows is expected, not a failure — don't fail the exit code for it.
const blocking = rows.filter(r => !r.ok && r.name !== 'iOS builds' && r.name !== 'Android device');
process.exit(blocking.length ? 1 : 0);
