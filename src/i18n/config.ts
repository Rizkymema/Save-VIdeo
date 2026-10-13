export const LOCALES = ["id", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "id";

/** Bahasa Indonesia di root (`/`), English di `/en`. */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Path padanan di bahasa lain, untuk tombol ganti bahasa & hreflang. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const withoutLocale = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return localePath(target, withoutLocale);
}

export function htmlLang(locale: Locale): string {
  return locale === "id" ? "id-ID" : "en";
}
