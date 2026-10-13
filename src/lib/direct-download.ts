import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { contentTypeForExt, downloadFileName } from "@/lib/filename";
import { downloadDir, findOutputFile, initJobs, isOwnedPath, removeJobFiles } from "@/lib/jobs/cleanup";
import { log } from "@/lib/log";
import { recordOutcome } from "@/lib/metrics";
import { downloadArgs } from "@/lib/ytdlp/args";
import { extractErrorLine, mapYtDlpError } from "@/lib/ytdlp/errors";
import { parseProgressLine } from "@/lib/ytdlp/progress";
import { runYtDlp } from "@/lib/ytdlp/runner";
import type { Platform, QualityPreset } from "@/types/video";

export interface DirectDownloadInput {
  url: string;
  platform: Platform;
  preset: QualityPreset;
  item: number;
  title: string;
  qualityLabel?: string;
  /** Dibatalkan bila user menutup halaman/membatalkan unduhan. */
  signal?: AbortSignal;
}

export interface DirectDownloadResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

// Unduhan aktif per IP (per instance server).
const g = globalThis as unknown as { __savelinkDirectActive?: Map<string, number> };
const active: Map<string, number> = (g.__savelinkDirectActive ??= new Map());

export function acquireDirectSlot(ip: string): boolean {
  const count = active.get(ip) ?? 0;
  if (count >= env().MAX_JOBS_PER_IP) return false;
  active.set(ip, count + 1);
  return true;
}

export function releaseDirectSlot(ip: string): void {
  const count = (active.get(ip) ?? 1) - 1;
  if (count <= 0) active.delete(ip);
  else active.set(ip, count);
}

/**
 * Mode "direct" (serverless): jalankan yt-dlp sampai file selesai (unduh + merge) dalam satu request,
 * tanpa antrean/state antar-request. Pemanggil bertugas mengirim lalu menghapus file.
 */
export async function runDirectDownload(input: DirectDownloadInput): Promise<DirectDownloadResult> {
  await initJobs();
  const e = env();
  const id = randomUUID();
  const started = Date.now();
  const host = new URL(input.url).hostname;
  let donePath: string | undefined;
  let ytdlpTitle: string | undefined;

  const proc = runYtDlp(
    downloadArgs({
      url: input.url,
      preset: input.preset,
      item: input.item,
      jobId: id,
      outDir: downloadDir(),
      maxFilesizeMb: e.DIRECT_MAX_FILESIZE_MB,
    }),
    {
      timeoutMs: e.DIRECT_TIMEOUT_SEC * 1000,
      signal: input.signal,
      onLine: (line) => {
        const ev = parseProgressLine(line);
        if (ev?.type !== "done") return;
        if (isOwnedPath(id, ev.filepath)) donePath = path.resolve(ev.filepath);
        ytdlpTitle = ev.title;
      },
    },
  );
  const result = await proc.done;

  if (result.aborted) {
    await removeJobFiles(id);
    log("info", "direct.aborted", { platform: input.platform, host });
    throw new AppError("UNKNOWN");
  }

  if (result.code !== 0) {
    let err = mapYtDlpError(result.stderr, result);
    if (err.apiError.code === "TOO_LARGE") err = new AppError("TOO_LARGE", { params: { maxMb: e.DIRECT_MAX_FILESIZE_MB } });
    log("warn", "direct.failed", {
      platform: input.platform,
      host,
      preset: input.preset,
      code: err.apiError.code,
      ms: Date.now() - started,
      reason: result.spawnError ?? extractErrorLine(result.stderr),
    });
    recordOutcome(input.platform, "job", false, err.apiError.code);
    await removeJobFiles(id);
    throw err;
  }

  const filePath = donePath ?? (await findOutputFile(id));
  const stat = filePath ? await fs.stat(filePath).catch(() => null) : null;
  if (!filePath || !stat?.isFile() || stat.size === 0) {
    log("error", "direct.no_output", { platform: input.platform, host });
    recordOutcome(input.platform, "job", false, "UNKNOWN");
    await removeJobFiles(id);
    throw new AppError("UNKNOWN");
  }

  const ext = path.extname(filePath).slice(1).toLowerCase() || "mp4";
  log("info", "direct.ready", { platform: input.platform, preset: input.preset, bytes: stat.size, ms: Date.now() - started });
  recordOutcome(input.platform, "job", true);
  return {
    filePath,
    fileName: downloadFileName(input.title || ytdlpTitle || "video", ext, {
      audio: input.preset.startsWith("audio"),
      qualityLabel: input.qualityLabel,
    }),
    fileSize: stat.size,
    contentType: contentTypeForExt(ext),
  };
}
