import type { MetadataRoute } from "next";
import { id } from "@/i18n/dictionaries/id";
import { THEME_COLORS } from "@/lib/site";

/**
 * PWA manifest. `share_target` membuat SaveLink muncul di menu Bagikan Android
 * (setelah di-install): link dari TikTok/IG/YouTube langsung terisi & diproses.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SaveLink — Video Downloader",
    short_name: "SaveLink",
    description: id.meta.description,
    lang: "id",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLORS.dark,
    theme_color: THEME_COLORS.dark,
    categories: ["utilities", "multimedia", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
