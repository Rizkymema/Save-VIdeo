import "server-only";
import { AppError } from "@/lib/errors";
import { checkPublicHost } from "@/lib/net";
import { normalizeVideoUrl, validateVideoUrl } from "@/lib/platforms";
import type { Platform } from "@/types/video";

/**
 * Validasi penuh URL dari user sebelum menyentuh yt-dlp:
 * bentuk URL → bukan profil/playlist → host publik (cek DNS) → URL dinormalisasi.
 */
export async function guardUrl(raw: string): Promise<{ url: string; platform: Platform }> {
  const check = validateVideoUrl(raw);
  if (!check.ok) {
    if (check.reason === "not_video") throw new AppError("UNSUPPORTED", { detail: "not_video" });
    throw new AppError("INVALID_URL");
  }
  const host = await checkPublicHost(check.url.hostname);
  if (!host.ok) {
    throw new AppError("INVALID_URL", host.reason === "dns" ? { detail: "dns" } : {});
  }
  return { url: normalizeVideoUrl(check.url), platform: check.platform };
}
