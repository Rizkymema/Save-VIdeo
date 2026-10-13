import type { MetadataRoute } from "next";
import { localePath } from "@/i18n/config";
import { PLATFORM_SLUGS } from "@/i18n/platforms";
import { absoluteUrl } from "@/lib/site";

// Tanggal tetap (bukan new Date()) agar sitemap tetap statis saat build.
const LAST_MODIFIED = "2026-10-13";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", ...PLATFORM_SLUGS.map((s) => `/${s}`), "/terms", "/privacy"];
  return paths.map((path) => ({
    url: absoluteUrl(localePath("id", path)),
    lastModified: LAST_MODIFIED,
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : path.startsWith("/terms") || path.startsWith("/privacy") ? 0.3 : 0.8,
    alternates: {
      languages: {
        "id-ID": absoluteUrl(localePath("id", path)),
        en: absoluteUrl(localePath("en", path)),
      },
    },
  }));
}
