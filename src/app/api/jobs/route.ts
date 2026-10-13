import { AppError } from "@/lib/errors";
import { errorResponse, json, readJsonBody } from "@/lib/http";
import { createJob } from "@/lib/jobs/queue";
import { jobLimiter } from "@/lib/limiters";
import { getClientIp } from "@/lib/request-ip";
import { verifyTurnstile } from "@/lib/turnstile";
import { guardUrl } from "@/lib/url-guard";
import { jobRequestSchema } from "@/lib/validation";
import { getVideoInfo } from "@/lib/video-info";
import type { CreateJobResponse } from "@/types/video";

/** POST /api/jobs { url, preset, item? } → 202 { jobId } */
export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  try {
    const parsed = jobRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      const presetIssue = parsed.error.issues.some((i) => i.path[0] === "preset");
      throw new AppError(presetIssue ? "FORMAT_UNAVAILABLE" : "INVALID_URL");
    }
    const { preset, item = 1, turnstileToken } = parsed.data;

    const limit = jobLimiter().hit(ip);
    if (!limit.ok) throw new AppError("RATE_LIMITED", { retryAfterSec: limit.retryAfterSec });

    const token = turnstileToken ?? request.headers.get("x-turnstile-token");
    if (!(await verifyTurnstile(token, ip))) throw new AppError("VERIFICATION_FAILED");

    const { url, platform } = await guardUrl(parsed.data.url);
    // Biasanya sudah ada di cache dari /api/info → tidak memanggil yt-dlp lagi.
    const info = await getVideoInfo(url, platform, item);
    const option = info.options.find((o) => o.preset === preset);
    if (!option) throw new AppError("FORMAT_UNAVAILABLE");

    const job = await createJob({
      ip,
      url,
      platform,
      preset,
      item,
      title: info.title,
      qualityLabel: option.kind === "video" ? option.label : undefined,
      needsMerge: option.needsMerge,
    });
    return json<CreateJobResponse>({ jobId: job.id }, { status: 202 });
  } catch (err) {
    return errorResponse(err, { route: "jobs" });
  }
}
