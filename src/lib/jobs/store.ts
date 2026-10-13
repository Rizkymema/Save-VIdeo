import "server-only";
import {
  TERMINAL_STAGES,
  type ApiError,
  type JobProgress,
  type JobStage,
  type Platform,
  type QualityPreset,
} from "@/types/video";

export interface Job {
  id: string;
  ip: string;
  url: string;
  host: string;
  platform: Platform;
  preset: QualityPreset;
  item: number;
  title: string;
  /** Label kualitas untuk nama file, mis. "1080p". */
  qualityLabel?: string;
  /** 2 bila video & audio diunduh terpisah (lalu di-merge). */
  expectedStreams: number;

  stage: JobStage;
  percent: number;
  step?: JobProgress["step"];
  streamIndex: number;
  currentFile?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  speedBps?: number;
  etaSec?: number;
  error?: ApiError;

  filePath?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;

  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** Setelah lewat: file dihapus & job jadi "expired". */
  expiresAt: number;

  kill?: () => void;
  listeners: Set<(p: JobProgress) => void>;
  lastEmit: number;
  emitTimer?: ReturnType<typeof setTimeout>;
}

export interface JobsState {
  jobs: Map<string, Job>;
  queue: string[];
  running: Set<string>;
  initialized: boolean;
  initPromise?: Promise<void>;
  sweeper?: ReturnType<typeof setInterval>;
  /** File yang gagal dihapus (mis. masih terkunci di Windows) → dicoba lagi saat sweep. */
  pendingDeletes: Set<string>;
}

// Disimpan di globalThis agar bertahan saat hot reload di `next dev`.
const g = globalThis as unknown as { __savelinkJobs?: JobsState };

export function jobsState(): JobsState {
  g.__savelinkJobs ??= {
    jobs: new Map(),
    queue: [],
    running: new Set(),
    initialized: false,
    pendingDeletes: new Set(),
  };
  return g.__savelinkJobs;
}

export const ACTIVE_STAGES: readonly JobStage[] = ["queued", "downloading", "merging", "converting"];

export function isTerminal(stage: JobStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

export function getJob(id: string): Job | undefined {
  return jobsState().jobs.get(id);
}

export function snapshot(job: Job): JobProgress {
  const p: JobProgress = { jobId: job.id, stage: job.stage, percent: Math.round(job.percent * 10) / 10 };
  if (job.stage === "queued") {
    const position = jobsState().queue.indexOf(job.id);
    if (position >= 0) p.queuePosition = position + 1;
  }
  if (job.stage === "downloading") {
    if (job.step) p.step = job.step;
    if (job.downloadedBytes !== undefined) p.downloadedBytes = job.downloadedBytes;
    if (job.totalBytes !== undefined) p.totalBytes = job.totalBytes;
    if (job.speedBps !== undefined) p.speedBps = Math.round(job.speedBps);
    if (job.etaSec !== undefined) p.etaSec = Math.round(job.etaSec);
  }
  if (job.stage === "ready") {
    if (job.fileName) p.fileName = job.fileName;
    if (job.fileSize !== undefined) p.fileSize = job.fileSize;
  }
  if (job.error) p.error = job.error;
  return p;
}

const EMIT_INTERVAL_MS = 200;

/** Kirim progress ke semua listener (SSE); dibatasi ±5x per detik kecuali `force`. */
export function emit(job: Job, force = false): void {
  const now = Date.now();
  if (!force && now - job.lastEmit < EMIT_INTERVAL_MS) {
    job.emitTimer ??= setTimeout(() => {
      job.emitTimer = undefined;
      emit(job, true);
    }, EMIT_INTERVAL_MS);
    return;
  }
  if (job.emitTimer) {
    clearTimeout(job.emitTimer);
    job.emitTimer = undefined;
  }
  job.lastEmit = now;
  const p = snapshot(job);
  for (const listener of [...job.listeners]) {
    try {
      listener(p);
    } catch {
      job.listeners.delete(listener);
    }
  }
}

/** Langganan progress; listener langsung menerima kondisi saat ini. */
export function subscribe(job: Job, listener: (p: JobProgress) => void): () => void {
  job.listeners.add(listener);
  listener(snapshot(job));
  return () => {
    job.listeners.delete(listener);
  };
}

/** Kabari job lain yang sedang antre karena posisi antreannya berubah. */
export function emitQueuePositions(): void {
  const { jobs, queue } = jobsState();
  for (const id of queue) {
    const job = jobs.get(id);
    if (job) emit(job, true);
  }
}
