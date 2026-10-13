export const SITE_NAME = "SaveLink";

/** Domain produksi dari Vercel (otomatis tersedia saat build di Vercel). */
const VERCEL_URL = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;

/** URL publik (di-inline saat build). NEXT_PUBLIC_SITE_URL > domain Vercel > localhost. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (VERCEL_URL ? `https://${VERCEL_URL}` : "http://localhost:3000")
).replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const THEME_STORAGE_KEY = "savelink:theme";
export const THEME_COLORS = { dark: "#141110", light: "#fafaf9" } as const;

/**
 * Dijalankan sinkron di <head> sebelum halaman dilukis: terapkan tema tersimpan
 * dan bahasa (dari path /en) tanpa kedipan. Lihat docs "preventing flash before hydration".
 */
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${THEME_STORAGE_KEY}");var dark=t!=="light";d.classList.toggle("dark",dark);d.style.colorScheme=dark?"dark":"light";var c=dark?"${THEME_COLORS.dark}":"${THEME_COLORS.light}";document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)});if(/^\\/en(\\/|$)/.test(location.pathname))d.lang="en";}catch(e){}})()`;
