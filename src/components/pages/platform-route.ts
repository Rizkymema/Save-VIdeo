import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import type { PlatformSlug } from "@/i18n/dictionaries/id";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageMetadata } from "@/lib/seo";

/**
 * Metadata halaman downloader per platform (/tiktok, /en/youtube, ...).
 * Tiap platform punya rute statis sendiri (bukan [platform]) agar path tak dikenal
 * mendapat status 404 sungguhan, bukan "soft 404".
 */
export function platformMetadata(locale: Locale, platform: PlatformSlug): Metadata {
  const copy = getDictionary(locale).platformPages[platform];
  return pageMetadata({ locale, path: `/${platform}`, title: copy.title, description: copy.description });
}
