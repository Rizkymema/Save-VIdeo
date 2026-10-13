import fs from "node:fs";
import { Readable } from "node:stream";
import { connection } from "next/server";
import { acquireDirectSlot, releaseDirectSlot, runDirectDownload } from "@/lib/direct-download";
import { DOWNLOAD_TOKEN, signalCookie } from "@/lib/download-cookie";
import { env } from "@/lib/env";
import { AppError, isAppError, makeApiError } from "@/lib/errors";
import { contentDisposition } from "@/lib/filename";
import { jsonError } from "@/lib/http";
import { jobLimiter } from "@/lib/limiters";
import { log } from "@/lib/log";
import { getClientIp } from "@/lib/request-ip";
import { verifyTurnstile } from "@/lib/turnstile";
import { guardUrl } from "@/lib/url-guard";
import { jobRequestSchema } from "@/lib/validation";
import { getVideoInfo } from "@/lib/video-info";

/**
 * GET /api/download?url=&preset=&item=&t=<token>[&ts=<turnstile>]
 * Mode "direct" (serverless/Vercel): proses + kirim file dalam satu request, dibuka browser lewat
 * navigasi biasa. Hasil dikabarkan lewat cookie sl_dl_<token>:
 *   sukses → 200 file (attachment) · gagal → 204 (halaman tidak berpindah) + cookie berisi ApiError.
 */
export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const token = params.get("t") ?? "";
  if (!DOWNLOAD_TOKEN.test(token)) return jsonError(makeApiError("INVALID_URL"), 400);

  const fail = (err: unknown) => {
    const error = isAppError(err) ? err.apiError : makeApiError("UNKNOWN");
    if (!isAppError(err)) log("error", "direct.unhandled", { message: err instanceof Error ? err.message : String(err) });
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": signalCookie(token, { ok: false, error }), "Cache-Control": "no-store" },
    });
  };

  const ip = getClientIp(request.headers);
  let holdsSlot = false;
  try {
    const item = params.get("item");
    const parsed = jobRequestSchema.safeParse({
      url: params.get("url") ?? "",
      preset: params.get("preset") ?? "",
      item: item ? Number(item) : undefined,
      turnstileToken: params.get("ts") ?? undefined,
    });
    if (!parsed.success) {
      const presetIssue = parsed.error.issues.some((i) => i.path[0] === "preset");
      throw new AppError(presetIssue ? "FORMAT_UNAVAILABLE" : "INVALID_URL");
    }
    const { preset, item: itemNo = 1, turnstileToken } = parsed.data;

    const limit = jobLimiter().hit(ip);
    if (!limit.ok) throw new AppError("RATE_LIMITED", { retryAfterSec: limit.retryAfterSec });
    if (!(await verifyTurnstile(turnstileToken, ip))) throw new AppError("VERIFICATION_FAILED");

    const { url, platform } = await guardUrl(parsed.data.url);
    const info = await getVideoInfo(url, platform, itemNo);
    const option = info.options.find((o) => o.preset === preset);
    if (!option) throw new AppError("FORMAT_UNAVAILABLE");
    const { DIRECT_MAX_FILESIZE_MB } = env();
    if (option.approxBytes && option.approxBytes > DIRECT_MAX_FILESIZE_MB * 1024 * 1024) {
      throw new AppError("TOO_LARGE", { params: { maxMb: DIRECT_MAX_FILESIZE_MB } });
    }

    holdsSlot = acquireDirectSlot(ip);
    if (!holdsSlot) throw new AppError("RATE_LIMITED", { retryAfterSec: 10 });

    const result = await runDirectDownload({
      url,
      platform,
      preset,
      item: itemNo,
      title: info.title,
      qualityLabel: option.kind === "video" ? option.label : undefined,
      signal: request.signal,
    });
    releaseDirectSlot(ip);
    holdsSlot = false;

    // File sementara langsung dihapus setelah terkirim (atau koneksi putus).
    const stream = fs.createReadStream(result.filePath);
    stream.once("close", () => {
      fs.promises.rm(result.filePath, { force: true }).catch(() => undefined);
    });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(result.fileSize),
        "Content-Disposition": contentDisposition(result.fileName),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Set-Cookie": signalCookie(token, { ok: true, fileName: result.fileName, fileSize: result.fileSize }),
      },
    });
  } catch (err) {
    if (holdsSlot) releaseDirectSlot(ip);
    return fail(err);
  }
}
