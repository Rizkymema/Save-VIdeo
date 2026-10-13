import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/** Rentang alamat yang tidak boleh dijangkau server (anti-SSRF). */
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

export function isPrivateAddress(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) return blocked.check(address, "ipv6");
  return true;
}

export type HostCheck = { ok: true } | { ok: false; reason: "private" | "dns" };

/** Pastikan hostname hanya mengarah ke IP publik sebelum yt-dlp menghubunginya. */
export async function checkPublicHost(hostname: string): Promise<HostCheck> {
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return { ok: false, reason: "dns" };
    if (addresses.some((a) => isPrivateAddress(a.address))) return { ok: false, reason: "private" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "dns" };
  }
}
