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

/** 32 bit terakhir alamat IPv6 sebagai IPv4 (pola NAT64/DNS64), mis. fd00:aa::1728:3fa7 → 23.40.63.167. */
export function embeddedIpv4(ipv6: string): string | null {
  if (isIP(ipv6) !== 6) return null;
  const [head, tail = ""] = ipv6.toLowerCase().split("::");
  const parse = (part: string) => (part ? part.split(":") : []);
  let groups = [...parse(head), ...parse(tail)];
  // Bentuk campuran "…:1.2.3.4" → sudah IPv4.
  const last = groups.at(-1) ?? "";
  if (last.includes(".")) return isIP(last) === 4 ? last : null;
  if (ipv6.includes("::")) {
    const missing = 8 - groups.length;
    groups = [...parse(head), ...Array<string>(missing).fill("0"), ...parse(tail)];
  }
  if (groups.length !== 8) return null;
  const hi = parseInt(groups[6], 16);
  const lo = parseInt(groups[7], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
}

/**
 * Nilai hasil DNS satu host. Ditolak bila ada alamat privat — kecuali alamat IPv6 privat hasil
 * sintesis NAT64/DNS64 dari router/ISP, yaitu yang membawa salah satu IPv4 publik host itu sendiri.
 */
export function evaluateAddresses(addresses: string[]): HostCheck {
  if (addresses.length === 0) return { ok: false, reason: "dns" };
  const publicV4 = new Set(addresses.filter((a) => isIP(a) === 4 && !isPrivateAddress(a)));
  for (const address of addresses) {
    if (!isPrivateAddress(address)) continue;
    const v4 = isIP(address) === 6 ? embeddedIpv4(address) : null;
    if (v4 && publicV4.has(v4)) continue;
    return { ok: false, reason: "private" };
  }
  return { ok: true };
}

/** Pastikan hostname hanya mengarah ke IP publik sebelum yt-dlp menghubunginya. */
export async function checkPublicHost(hostname: string): Promise<HostCheck> {
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return evaluateAddresses(addresses.map((a) => a.address));
  } catch {
    return { ok: false, reason: "dns" };
  }
}
