import os from 'node:os';

// Virtual adapters (Hyper-V, WSL, VirtualBox, VMware, Docker, tunnels) hand out IPv4
// addresses that a phone on the WiFi can't reach. Metro must bind to the real LAN NIC.
const VIRTUAL = /(vethernet|hyper-v|wsl|virtualbox|vmware|vmnet|docker|loopback|tailscale|zerotier|bluetooth|tap-|utun)/i;

// Private ranges a home/office router actually hands out, most likely first.
function rank(ip) {
  if (ip.startsWith('192.168.')) return 0;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
  if (ip.startsWith('10.')) return 2;
  return 3;
}

/**
 * Best-guess LAN IPv4 for this machine. Cross-platform replacement for the
 * macOS-only `ipconfig getifaddr en0`. Returns null if nothing usable is up.
 */
export function lanIp() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const a of addrs ?? []) {
      // Node <18 reports family as the string 'IPv4'; newer versions use the number 4.
      const isV4 = a.family === 'IPv4' || a.family === 4;
      if (!isV4 || a.internal) continue;
      if (a.address.startsWith('169.254.')) continue; // link-local = no DHCP lease
      candidates.push({ name, ip: a.address });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => rank(a.ip) - rank(b.ip));
  return candidates[0].ip;
}

export default lanIp;
