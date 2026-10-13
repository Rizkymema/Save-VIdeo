import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { makeApiError } from "@/lib/errors";
import { log } from "@/lib/log";
import { emit, isTerminal, jobsState, type Job } from "@/lib/jobs/store";

/** Hanya file milik job (nama diawali UUID) yang boleh dihapus — folder lain aman. */
const JOB_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\./i;

const SWEEP_INTERVAL_MS = 60_000;
/** Data job (tanpa file) disimpan sebentar setelah selesai agar UI masih bisa membaca status akhirnya. */
const RECORD_RETENTION_MS = 10 * 60_000;

export function downloadDir(): string {
  return path.resolve(env().DOWNLOAD_DIR);
}

async function removeFile(filePath: string): Promise<void> {
  const state = jobsState();
  try {
    await fs.rm(filePath, { force: true });
    state.pendingDeletes.delete(filePath);
  } catch {
    // Di Windows file yang sedang dibaca/ditulis tidak bisa dihapus → coba lagi di sweep berikutnya.
    state.pendingDeletes.add(filePath);
  }
}

/** Hapus semua file sementara milik satu job (hasil akhir, .part, file video/audio sebelum merge). */
export async function removeJobFiles(jobId: string): Promise<void> {
  const dir = downloadDir();
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  await Promise.all(names.filter((n) => n.startsWith(`${jobId}.`)).map((n) => removeFile(path.join(dir, n))));
}

/** Cari file hasil bila baris "__SLDONE__" tidak terbaca. */
export async function findOutputFile(jobId: string): Promise<string | undefined> {
  const dir = downloadDir();
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const finals = names.filter(
    (n) =>
      n.startsWith(`${jobId}.`) &&
      !/\.(part|ytdl|temp|tmp)$/i.test(n) &&
      !/\.f[\w-]+\.\w+$/i.test(n.slice(jobId.length)),
  );
  let best: { file: string; size: number } | undefined;
  for (const n of finals) {
    const file = path.join(dir, n);
    const stat = await fs.stat(file).catch(() => null);
    if (stat?.isFile() && (!best || stat.size > best.size)) best = { file, size: stat.size };
  }
  return best?.file;
}

/** Pastikan path yang dilaporkan yt-dlp benar-benar ada di folder download & milik job ini. */
export function isOwnedPath(jobId: string, filePath: string): boolean {
  const dir = downloadDir();
  const resolved = path.resolve(filePath);
  return path.dirname(resolved) === dir && path.basename(resolved).startsWith(`${jobId}.`);
}

export async function freeDiskBytes(): Promise<number | undefined> {
  try {
    const stats = await fs.statfs(downloadDir());
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return undefined;
  }
}

/** Setelah file terkirim penuh ke user: simpan sebentar saja untuk "Download ulang". */
export function markServed(job: Job): void {
  const graceMs = env().DOWNLOAD_GRACE_MINUTES * 60_000;
  job.expiresAt = Math.min(job.expiresAt, Date.now() + graceMs);
}

export async function sweep(now = Date.now()): Promise<void> {
  const state = jobsState();
  const { JOB_TIMEOUT_SEC } = env();
  for (const job of [...state.jobs.values()]) {
    // Pengaman ganda: proses yang melewati batas waktu runner.
    if (job.startedAt && !isTerminal(job.stage) && now - job.startedAt > (JOB_TIMEOUT_SEC + 60) * 1000) {
      job.kill?.();
    }
    if (job.stage === "queued" && now >= job.expiresAt) {
      state.queue = state.queue.filter((id) => id !== job.id);
      job.stage = "error";
      job.error = makeApiError("BUSY");
      job.expiresAt = now + RECORD_RETENTION_MS;
      emit(job, true);
      continue;
    }
    if (job.stage === "ready" && now >= job.expiresAt) {
      job.stage = "expired";
      job.error = makeApiError("NOT_FOUND", { detail: "expired" });
      job.filePath = undefined;
      job.expiresAt = now + RECORD_RETENTION_MS;
      emit(job, true);
      await removeJobFiles(job.id);
      log("info", "job.expired", { jobId: job.id });
      continue;
    }
    if (isTerminal(job.stage) && now >= job.expiresAt && job.listeners.size === 0) {
      state.jobs.delete(job.id);
    }
  }
  for (const file of [...state.pendingDeletes]) await removeFile(file);
}

/** Dipanggil sekali per proses server: siapkan folder, buang sisa file lama, mulai sweeper. */
export function initJobs(): Promise<void> {
  const state = jobsState();
  state.initPromise ??= (async () => {
    const dir = downloadDir();
    await fs.mkdir(dir, { recursive: true });
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    const stale = names.filter((n) => JOB_FILE.test(n) && !state.jobs.has(n.slice(0, 36)));
    await Promise.all(stale.map((n) => removeFile(path.join(dir, n))));
    if (stale.length) log("info", "jobs.cleanup_startup", { removed: stale.length });
    state.sweeper ??= setInterval(() => {
      sweep().catch((err) => log("error", "jobs.sweep_failed", { message: String(err) }));
    }, SWEEP_INTERVAL_MS);
    state.sweeper.unref?.();
    state.initialized = true;
    log("info", "jobs.ready", { dir });
  })();
  return state.initPromise;
}
