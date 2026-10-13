import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { errorResponse, json, readJsonBody } from "@/lib/http";
import { infoLimiter } from "@/lib/limiters";
import { getClientIp } from "@/lib/request-ip";
import { guardUrl } from "@/lib/url-guard";
import { infoRequestSchema } from "@/lib/validation";
import { getVideoInfo } from "@/lib/video-info";

/** POST /api/info { url, item? } → metadata + daftar kualitas yang tersedia. */
export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  try {
    const parsed = infoRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new AppError("INVALID_URL");

    const limit = infoLimiter().hit(ip);
    if (!limit.ok) throw new AppError("RATE_LIMITED", { retryAfterSec: limit.retryAfterSec });

    const { url, platform } = await guardUrl(parsed.data.url);
    const info = await getVideoInfo(url, platform, parsed.data.item ?? 1);

    // Mode direct (Vercel): file harus selesai & terkirim dalam satu function → batasi ukuran.
    const { DOWNLOAD_MODE, DIRECT_MAX_FILESIZE_MB } = env();
    if (DOWNLOAD_MODE === "direct") {
      const maxBytes = DIRECT_MAX_FILESIZE_MB * 1024 * 1024;
      return json({
        ...info,
        limitMb: DIRECT_MAX_FILESIZE_MB,
        options: info.options.map((o) => (o.approxBytes && o.approxBytes > maxBytes ? { ...o, tooLarge: true } : o)),
      });
    }
    return json(info);
  } catch (err) {
    return errorResponse(err, { route: "info" });
  }
}
