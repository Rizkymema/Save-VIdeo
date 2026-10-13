import type { Platform } from "@/types/video";

/** Dipakai di client & server: deteksi platform + validasi bentuk URL (tanpa jaringan). */

export const MAX_URL_LENGTH = 2048;

const PLATFORM_DOMAINS: Record<Exclude<Platform, "other">, readonly string[]> = {
  youtube: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com", "instagr.am"],
  facebook: ["facebook.com", "fb.watch", "fb.com"],
  twitter: ["twitter.com", "x.com"],
};

const BLOCKED_TLDS = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".intranet", ".corp"];

/** Parameter pelacak yang aman dibuang (tidak memengaruhi video yang dirujuk). */
const TRACKING_PARAMS = new Set([
  "si",
  "pp",
  "feature",
  "igsh",
  "igshid",
  "fbclid",
  "mibextid",
  "rdid",
  "share_url",
  "_r",
  "_t",
  "is_from_webapp",
  "sender_device",
  "web_id",
  "share_app_id",
  "share_link_id",
  "ref",
  "ref_src",
  "ref_url",
]);

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function detectPlatformFromHost(hostname: string): Platform {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const [platform, domains] of Object.entries(PLATFORM_DOMAINS) as [
    Exclude<Platform, "other">,
    readonly string[],
  ][]) {
    if (domains.some((d) => hostMatches(host, d))) return platform;
  }
  return "other";
}

/** Deteksi platform dari teks bebas; aman dipanggil di setiap ketikan. */
export function detectPlatform(input: string): Platform | null {
  const url = parseLooseUrl(input);
  return url ? detectPlatformFromHost(url.hostname) : null;
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'`]+/i;
const BARE_DOMAIN_IN_TEXT =
  /\b(?:www\.|m\.|vm\.|vt\.)?(?:youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|twitter\.com|x\.com)\/[^\s<>"'`]*/i;

/**
 * Ambil URL pertama dari teks yang ditempel. Aplikasi seperti TikTok/IG sering
 * membagikan "Lihat video ini! https://vt.tiktok.com/xxx/" sehingga URL harus diekstrak.
 */
export function extractUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(URL_IN_TEXT) ?? trimmed.match(BARE_DOMAIN_IN_TEXT);
  if (!match) return null;
  // Buang tanda baca penutup yang ikut tertempel, mis. "...xyz)." atau "...xyz,".
  return match[0].replace(/[),.;!?\]]+$/, "");
}

function parseLooseUrl(input: string): URL | null {
  const candidate = extractUrl(input) ?? input.trim();
  if (!candidate) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export type UrlCheckFailure =
  | "empty"
  | "too_long"
  | "invalid"
  | "protocol"
  | "credentials"
  | "port"
  | "private"
  | "not_video";

export type UrlCheck =
  | { ok: true; url: URL; platform: Platform }
  | { ok: false; reason: UrlCheckFailure };

/**
 * Validasi bentuk URL sebelum dikirim ke yt-dlp. Mencegah SSRF (IP/localhost),
 * port aneh, kredensial di URL, dan link yang jelas bukan satu video (profil/playlist).
 */
export function validateVideoUrl(raw: string): UrlCheck {
  const input = raw.trim();
  if (!input) return { ok: false, reason: "empty" };
  if (input.length > MAX_URL_LENGTH) return { ok: false, reason: "too_long" };

  const extracted = extractUrl(input) ?? input;
  if (/^[a-z][a-z\d+.-]*:/i.test(extracted) && !/^https?:\/\//i.test(extracted)) {
    return { ok: false, reason: "protocol" };
  }
  const url = parseLooseUrl(extracted);
  if (!url) return { ok: false, reason: "invalid" };
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "protocol" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, reason: "port" };

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // IP literal (v4/v6) dicek lebih dulu: selalu ditolak sebagai alamat langsung.
  if (host.startsWith("[") || host.includes(":") || IPV4.test(host)) return { ok: false, reason: "private" };
  if (!host || !host.includes(".")) return { ok: false, reason: host === "localhost" ? "private" : "invalid" };
  if (host === "localhost" || BLOCKED_TLDS.some((tld) => host.endsWith(tld))) {
    return { ok: false, reason: "private" };
  }
  if (!/^[a-z0-9.-]+$/.test(host) || host.split(".").some((label) => !label || label.length > 63)) {
    return { ok: false, reason: "invalid" };
  }

  const platform = detectPlatformFromHost(host);
  if (!looksLikeSingleVideo(platform, host, url)) return { ok: false, reason: "not_video" };
  return { ok: true, url, platform };
}

function looksLikeSingleVideo(platform: Platform, host: string, url: URL): boolean {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  switch (platform) {
    case "youtube": {
      if (hostMatches(host, "youtu.be")) return path.length > 1;
      // watch, shorts, live, embed, clip — bukan channel/playlist/feed.
      return /^\/(watch|shorts\/|live\/|embed\/|v\/|clip\/)/.test(path);
    }
    case "tiktok": {
      // Profil (@user) berisi ratusan video — bukan satu video.
      return !/^\/@[^/]+$/.test(path) && path !== "/";
    }
    case "instagram": {
      const first = path.split("/")[1] ?? "";
      if (path === "/") return false;
      // instagram.com/<username> = profil.
      return ["reel", "reels", "p", "tv", "stories", "share"].includes(first) || path.split("/").length > 2;
    }
    case "twitter":
      return /\/status(?:es)?\/\d+/.test(path) || /^\/i\/(?:web\/)?status/.test(path);
    default:
      return path !== "/" || url.search.length > 0;
  }
}

/**
 * Normalisasi untuk cache & dikirim ke yt-dlp: host huruf kecil, tanpa hash,
 * tanpa parameter pelacak (utm_*, si, igsh, fbclid, ...).
 */
export function normalizeVideoUrl(url: URL): string {
  const copy = new URL(url.toString());
  copy.hash = "";
  copy.hostname = copy.hostname.toLowerCase();
  for (const key of [...copy.searchParams.keys()]) {
    if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) copy.searchParams.delete(key);
  }
  return copy.toString();
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  other: "Situs lain",
};
