import "server-only";
import { isIP } from "node:net";
import { env } from "@/lib/env";

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  let ip = value.trim().replace(/^"|"$/g, "");
  // "[2001:db8::1]:1234" atau "1.2.3.4:5678"
  const bracket = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket) ip = bracket[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, "");
  ip = ip.replace(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i, "$1");
  return isIP(ip) ? ip.toLowerCase() : null;
}

/**
 * IP asli user untuk rate limit. Hanya percaya header yang diset reverse proxy kita:
 * - "cf-connecting-ip": di belakang Cloudflare
 * - "x-real-ip": Nginx (`proxy_set_header X-Real-IP $remote_addr`)
 * - "x-forwarded-for": ambil entri PALING KANAN (ditambahkan proxy terdekat, tidak bisa dipalsukan client)
 */
export function getClientIp(headers: Headers): string {
  const mode = env().TRUST_PROXY_HEADER;
  if (mode === "none") return "global";
  if (mode === "cf-connecting-ip") {
    const ip = clean(headers.get("cf-connecting-ip"));
    if (ip) return ip;
  }
  if (mode === "x-real-ip") {
    const ip = clean(headers.get("x-real-ip"));
    if (ip) return ip;
  }
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const ip = clean(parts.at(-1));
    if (ip) return ip;
  }
  return clean(headers.get("x-real-ip")) ?? "unknown";
}
