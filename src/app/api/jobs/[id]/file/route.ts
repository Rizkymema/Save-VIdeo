import fs from "node:fs";
import { Readable } from "node:stream";
import { connection } from "next/server";
import { makeApiError } from "@/lib/errors";
import { contentDisposition } from "@/lib/filename";
import { jsonError, parseRange } from "@/lib/http";
import { markServed } from "@/lib/jobs/cleanup";
import { getJob, type Job } from "@/lib/jobs/store";
import { JOB_ID } from "@/lib/validation";

type Lookup = { ok: true; job: Job; size: number } | { ok: false; response: Response };

async function lookup(ctx: RouteContext<"/api/jobs/[id]/file">): Promise<Lookup> {
  const { id } = await ctx.params;
  const job = JOB_ID.test(id) ? getJob(id) : undefined;
  if (!job || job.stage === "expired" || job.stage === "canceled") {
    return { ok: false, response: jsonError(makeApiError("NOT_FOUND", { detail: "expired" }), 404) };
  }
  if (job.stage !== "ready" || !job.filePath) {
    return { ok: false, response: jsonError(makeApiError("BUSY", { retryAfterSec: 2 }), 409) };
  }
  const stat = await fs.promises.stat(job.filePath).catch(() => null);
  if (!stat?.isFile()) {
    return { ok: false, response: jsonError(makeApiError("NOT_FOUND", { detail: "expired" }), 410) };
  }
  return { ok: true, job, size: stat.size };
}

function baseHeaders(job: Job): Record<string, string> {
  return {
    "Content-Type": job.contentType ?? "application/octet-stream",
    "Content-Disposition": contentDisposition(job.fileName ?? "video.mp4"),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

/** GET /api/jobs/:id/file → file hasil (mendukung Range agar bisa dilanjutkan). */
export async function GET(request: Request, ctx: RouteContext<"/api/jobs/[id]/file">) {
  await connection();
  const found = await lookup(ctx);
  if (!found.ok) return found.response;
  const { job, size } = found;
  const headers = baseHeaders(job);

  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const fileStream = fs.createReadStream(job.filePath!, { start, end });
  // Hanya dianggap "terkirim" bila bagian akhir file benar-benar terbaca.
  if (end === size - 1) fileStream.once("end", () => markServed(job));

  headers["Content-Length"] = String(end - start + 1);
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  return new Response(Readable.toWeb(fileStream) as ReadableStream<Uint8Array>, {
    status: range ? 206 : 200,
    headers,
  });
}

export async function HEAD(_request: Request, ctx: RouteContext<"/api/jobs/[id]/file">) {
  await connection();
  const found = await lookup(ctx);
  if (!found.ok) return new Response(null, { status: found.response.status });
  return new Response(null, { status: 200, headers: { ...baseHeaders(found.job), "Content-Length": String(found.size) } });
}
