import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { AppError, makeApiError } from "@/lib/errors";
import { contentTypeForExt, downloadFileName } from "@/lib/filename";
import {
  downloadDir,
  findOutputFile,
  freeDiskBytes,
  initJobs,
  isOwnedPath,
  removeJobFiles,
} from "@/lib/jobs/cleanup";
import { ACTIVE_STAGES, emit, emitQueuePositions, isTerminal, jobsState, type Job } from "@/lib/jobs/store";
import { log } from "@/lib/log";
import { recordOutcome } from "@/lib/metrics";
import { limitParams } from "@/lib/video-info";
import { downloadArgs } from "@/lib/ytdlp/args";
import { extractErrorLine, mapYtDlpError } from "@/lib/ytdlp/errors";
import { overallPercent, parseProgressLine, stageForPostprocessor } from "@/lib/ytdlp/progress";
import { runYtDlp } from "@/lib/ytdlp/runner";
import type { JobStage, Platform, QualityPreset } from "@/types/video";

/** Data job selesai/gagal disimpan sebentar agar UI bisa membaca status terakhirnya. */
const FINISHED_RECORD_MS = 10 * 60_000;

export interface CreateJobInput {
  ip: string;
  url: string;
  platform: Platform;
  preset: QualityPreset;
  item: number;
  title: string;
  qualityLabel?: string;
  needsMerge?: boolean;
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  await initJobs();
  const e = env();
  const state = jobsState();

  const activeForIp = [...state.jobs.values()].filter(
    (j) => j.ip === input.ip && ACTIVE_STAGES.includes(j.stage),
  ).length;
  if (activeForIp >= e.MAX_JOBS_PER_IP) throw new AppError("RATE_LIMITED", { retryAfterSec: 10 });
  if (state.queue.length >= e.MAX_QUEUE_LENGTH) throw new AppError("BUSY", { retryAfterSec: 15 });

  const free = await freeDiskBytes();
  if (free !== undefined && free < e.MIN_FREE_DISK_MB * 1024 * 1024) {
    log("warn", "jobs.low_disk", { freeMb: Math.round(free / 1024 / 1024) });
    throw new AppError("BUSY", { detail: "disk", retryAfterSec: 60 });
  }

  const now = Date.now();
  const job: Job = {
    id: randomUUID(),
    ip: input.ip,
    url: input.url,
    host: new URL(input.url).hostname,
    platform: input.platform,
    preset: input.preset,
    item: input.item,
    title: input.title,
    qualityLabel: input.qualityLabel,
    expectedStreams: input.needsMerge ? 2 : 1,
    stage: "queued",
    percent: 0,
    streamIndex: 0,
    createdAt: now,
    // Antre terlalu lama (TTL) → dibatalkan oleh sweeper.
    expiresAt: now + e.JOB_TTL_MINUTES * 60_000,
    listeners: new Set(),
    lastEmit: 0,
  };
  state.jobs.set(job.id, job);
  state.queue.push(job.id);
  log("info", "job.created", { jobId: job.id, platform: job.platform, host: job.host, preset: job.preset });
  pump();
  return job;
}

function pump(): void {
  const state = jobsState();
  const { MAX_CONCURRENT_JOBS } = env();
  let started = false;
  while (state.running.size < MAX_CONCURRENT_JOBS && state.queue.length > 0) {
    const id = state.queue.shift()!;
    const job = state.jobs.get(id);
    if (!job || job.stage !== "queued") continue;
    state.running.add(id);
    started = true;
    void runJob(job).catch((err) => {
      log("error", "job.crashed", { jobId: id, message: err instanceof Error ? err.message : String(err) });
      finishWithError(job, makeApiError("UNKNOWN"));
    });
  }
  if (started) emitQueuePositions();
}

function finishWithError(job: Job, error: ReturnType<typeof makeApiError>): void {
  const state = jobsState();
  if (!isTerminal(job.stage)) {
    job.stage = "error";
    job.error = error;
    job.finishedAt = Date.now();
    job.expiresAt = Date.now() + FINISHED_RECORD_MS;
    emit(job, true);
  }
  state.running.delete(job.id);
  void removeJobFiles(job.id);
  pump();
}

async function runJob(job: Job): Promise<void> {
  const e = env();
  const state = jobsState();
  const isAudioPreset = job.preset.startsWith("audio");
  let streamPercent = 0;
  let ytdlpTitle: string | undefined;

  job.stage = "downloading";
  job.startedAt = Date.now();
  job.step = isAudioPreset ? "audio" : job.expectedStreams >= 2 ? "video" : "file";
  emit(job, true);

  const proc = runYtDlp(
    downloadArgs({ url: job.url, preset: job.preset, item: job.item, jobId: job.id, outDir: downloadDir() }),
    {
      timeoutMs: e.JOB_TIMEOUT_SEC * 1000,
      onLine: (line) => {
        const ev = parseProgressLine(line);
        if (!ev || isTerminal(job.stage)) return;
        if (ev.type === "download") {
          if (ev.filename && ev.filename !== job.currentFile) {
            if (job.currentFile) job.streamIndex++;
            job.currentFile = ev.filename;
            streamPercent = 0;
          }
          const isAudioStream = ev.vcodec === "none";
          // Stream kedua muncul → pasti video & audio terpisah (akan di-merge).
          if (!isAudioPreset && job.streamIndex >= 1) {
            job.expectedStreams = Math.max(job.expectedStreams, job.streamIndex + 1);
          }
          job.step = isAudioPreset ? "audio" : job.expectedStreams >= 2 ? (isAudioStream ? "audio" : "video") : "file";
          if (ev.totalBytes && ev.downloadedBytes !== undefined) {
            streamPercent = (ev.downloadedBytes / ev.totalBytes) * 100;
          } else if (ev.fragmentCount && ev.fragmentIndex !== undefined) {
            streamPercent = (ev.fragmentIndex / ev.fragmentCount) * 100;
          }
          if (ev.status === "finished") streamPercent = 100;
          job.stage = "downloading";
          job.percent = Math.max(
            job.percent,
            overallPercent({
              streamCount: job.expectedStreams,
              streamIndex: job.streamIndex,
              streamPercent,
              stage: "downloading",
            }),
          );
          job.downloadedBytes = ev.downloadedBytes;
          job.totalBytes = ev.totalBytes;
          job.speedBps = ev.speedBps;
          job.etaSec = ev.etaSec;
          emit(job, ev.status === "finished");
        } else if (ev.type === "postprocess") {
          const stage = ev.status === "started" ? stageForPostprocessor(ev.postprocessor) : null;
          if (stage && job.stage !== stage) {
            job.stage = stage;
            job.percent = Math.max(job.percent, 95);
            job.speedBps = undefined;
            job.etaSec = undefined;
            emit(job, true);
          }
        } else if (ev.type === "done") {
          if (isOwnedPath(job.id, ev.filepath)) job.filePath = path.resolve(ev.filepath);
          ytdlpTitle = ev.title;
        }
      },
    },
  );
  job.kill = proc.kill;
  const result = await proc.done;
  job.kill = undefined;

  // Dibatalkan user saat proses berjalan: cancelJob sudah mengurus status & file.
  // (cast: TypeScript tidak tahu `stage` bisa berubah selama await)
  if ((job.stage as JobStage) === "canceled") {
    state.running.delete(job.id);
    pump();
    return;
  }

  if (result.code !== 0) {
    let err = mapYtDlpError(result.stderr, result);
    if (err.apiError.code === "TOO_LARGE") err = new AppError("TOO_LARGE", { params: limitParams() });
    log("warn", "job.failed", {
      jobId: job.id,
      platform: job.platform,
      host: job.host,
      code: err.apiError.code,
      ms: Date.now() - (job.startedAt ?? Date.now()),
      reason: result.spawnError ?? extractErrorLine(result.stderr),
    });
    recordOutcome(job.platform, "job", false, err.apiError.code);
    finishWithError(job, err.apiError);
    return;
  }

  const filePath = job.filePath ?? (await findOutputFile(job.id));
  const stat = filePath ? await fs.stat(filePath).catch(() => null) : null;
  if (!filePath || !stat?.isFile() || stat.size === 0) {
    log("error", "job.no_output", { jobId: job.id, platform: job.platform });
    recordOutcome(job.platform, "job", false, "UNKNOWN");
    finishWithError(job, makeApiError("UNKNOWN"));
    return;
  }

  const ext = path.extname(filePath).slice(1).toLowerCase() || "mp4";
  job.filePath = filePath;
  job.fileSize = stat.size;
  job.contentType = contentTypeForExt(ext);
  job.fileName = downloadFileName(job.title || ytdlpTitle || "video", ext, {
    audio: job.preset.startsWith("audio"),
    qualityLabel: job.qualityLabel,
  });
  job.stage = "ready";
  job.percent = 100;
  job.speedBps = undefined;
  job.etaSec = undefined;
  job.finishedAt = Date.now();
  job.expiresAt = Date.now() + e.JOB_TTL_MINUTES * 60_000;
  emit(job, true);
  state.running.delete(job.id);
  log("info", "job.ready", {
    jobId: job.id,
    platform: job.platform,
    preset: job.preset,
    bytes: stat.size,
    ms: job.finishedAt - (job.startedAt ?? job.finishedAt),
  });
  recordOutcome(job.platform, "job", true);
  pump();
}

export function cancelJob(job: Job): boolean {
  if (isTerminal(job.stage)) return false;
  const state = jobsState();
  state.queue = state.queue.filter((id) => id !== job.id);
  job.stage = "canceled";
  job.finishedAt = Date.now();
  job.expiresAt = Date.now() + FINISHED_RECORD_MS;
  job.kill?.();
  emit(job, true);
  emitQueuePositions();
  log("info", "job.canceled", { jobId: job.id, platform: job.platform });
  // File .part bisa masih terkunci sesaat setelah proses dimatikan; sweeper akan mengulang.
  setTimeout(() => void removeJobFiles(job.id), 1500).unref?.();
  if (!state.running.has(job.id)) pump();
  return true;
}

export function queueStats() {
  const state = jobsState();
  return { running: state.running.size, queued: state.queue.length, tracked: state.jobs.size };
}
