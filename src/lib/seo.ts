import type { Metadata } from "next";
import { localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { SITE_NAME } from "@/lib/site";

/** Metadata per halaman lengkap dengan canonical + hreflang ID/EN. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
}): Metadata {
  const dict = getDictionary(locale);
  const url = localePath(locale, path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords: dict.meta.keywords,
    alternates: {
      canonical: url,
      languages: {
        "id-ID": localePath("id", path),
        en: localePath("en", path),
        "x-default": localePath("id", path),
      },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      locale: locale === "id" ? "id_ID" : "en_US",
      alternateLocale: locale === "id" ? ["en_US"] : ["id_ID"],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
