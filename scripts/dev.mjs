#!/usr/bin/env node
// Start the Metro dev server bound to this machine's LAN IP so a phone on the same
// WiFi can reach it. Works on Windows, macOS and Linux.
//
//   npm run dev            → Metro for both platforms
//   npm run dev -- --clear → also clears the Metro cache
//
// Replaces the macOS-only dev.sh (`ipconfig getifaddr en0`).
import { lanIp } from './lan-ip.mjs';
import { loadEnvFile } from './env.mjs';
import { spawnExpo } from './expo.mjs';

loadEnvFile();

const ip = lanIp();
if (!ip) {
  console.error('\nERROR: could not detect a LAN IP. Connect to WiFi/Ethernet and retry.');
  console.error('       (Or run `npx expo start --tunnel` if you must go through the internet.)\n');
  process.exit(1);
}

console.log(`
  Dev server : http://${ip}:8081
  Manual URL : exp://${ip}:8081

  Android : npm run android   (device over USB, or scan from Expo Go / dev client)
  iOS     : npm run ios       (macOS only — use EAS for iOS builds from Windows)
`);

const child = spawnExpo(['start', ...process.argv.slice(2)], {
  env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: ip },
});
child.on('exit', code => process.exit(code ?? 0));
