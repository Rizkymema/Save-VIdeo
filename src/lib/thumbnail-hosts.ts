/**
 * CDN thumbnail yang dioptimalkan lewat next/image (diambil server-side, jadi lolos
 * dari blokir hotlink IG/FB). Host lain ditampilkan dengan <img> biasa.
 * Dipakai juga oleh next.config.ts → jangan import modul server di sini.
 */
export const THUMBNAIL_HOST_PATTERNS = [
  "i.ytimg.com",
  "**.ytimg.com",
  "**.ggpht.com",
  "**.tiktokcdn.com",
  "**.tiktokcdn-us.com",
  "**.tiktokcdn-eu.com",
  "**.ibyteimg.com",
  "**.cdninstagram.com",
  "**.fbcdn.net",
  "pbs.twimg.com",
  "**.twimg.com",
  "i.vimeocdn.com",
  "**.dmcdn.net",
  "**.redd.it",
  "i.pinimg.com",
  "**.sndcdn.com",
] as const;

function matches(host: string, pattern: string): boolean {
  if (pattern.startsWith("**.")) {
    const base = pattern.slice(3);
    return host.endsWith(`.${base}`);
  }
  return host === pattern;
}

export function isOptimizableThumbnail(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    return THUMBNAIL_HOST_PATTERNS.some((p) => matches(url.hostname.toLowerCase(), p));
  } catch {
    return false;
  }
}
