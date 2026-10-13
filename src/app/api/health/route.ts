import { connection } from "next/server";
import { json } from "@/lib/http";
import { freeDiskBytes, initJobs } from "@/lib/jobs/cleanup";
import { queueStats } from "@/lib/jobs/queue";
import { metricsSnapshot } from "@/lib/metrics";
import { toolVersions } from "@/lib/system";
import { turnstileEnabled } from "@/lib/turnstile";
import { lastUpdate, startAutoUpdate } from "@/lib/ytdlp/updater";

/** GET /api/health → dipakai Docker HEALTHCHECK & uptime monitor. */
export async function GET() {
  await connection();
  await initJobs();
  startAutoUpdate();
  const [versions, freeBytes] = await Promise.all([toolVersions(), freeDiskBytes()]);
  const ok = Boolean(versions.ytdlp && versions.ffmpeg);
  return json(
    {
      ok,
      ytdlp: versions.ytdlp ?? null,
      ffmpeg: versions.ffmpeg ?? null,
      deno: versions.deno ?? null,
      diskFreeMb: freeBytes !== undefined ? Math.round(freeBytes / 1024 / 1024) : null,
      queue: queueStats(),
      metrics: metricsSnapshot(),
      ytdlpUpdate: lastUpdate() ?? null,
      turnstile: turnstileEnabled(),
      uptimeSec: Math.round(process.uptime()),
    },
    { status: ok ? 200 : 503 },
  );
}
