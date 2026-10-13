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
    return json(info);
  } catch (err) {
    return errorResponse(err, { route: "info" });
  }
}
