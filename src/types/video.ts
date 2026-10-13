export const PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "twitter",
  "other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const QUALITY_PRESETS = [
  "best-compatible",
  "v2160",
  "v1440",
  "v1080",
  "v720",
  "v480",
  "v360",
  "audio-m4a",
  "audio-mp3",
] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

export type VideoCodec = "h264" | "h265" | "vp9" | "av1" | "other";

export interface QualityOption {
  preset: QualityPreset;
  kind: "video" | "audio";
  /** Label singkat, mis. "1080p", "4K", "MP3". */
  label: string;
  ext: "mp4" | "m4a" | "mp3";
  /** Resolusi sisi terpendek (cocok untuk video vertikal). */
  height?: number;
  approxBytes?: number;
  fps?: number;
  codec?: VideoCodec;
  hdr?: boolean;
  recommended?: boolean;
  /** true jika video & audio diunduh terpisah lalu digabung ffmpeg. */
  needsMerge?: boolean;
}

export interface CarouselItem {
  /** Indeks 1-based di dalam postingan (mis. carousel Instagram). */
  index: number;
  title: string;
  thumbnail?: string;
  durationSec?: number;
}

export interface VideoInfo {
  sourceUrl: string;
  platform: Platform;
  title: string;
  uploader?: string;
  thumbnail?: string;
  durationSec?: number;
  /** Orientasi sumber, dipakai untuk rasio thumbnail. */
  orientation?: "landscape" | "portrait" | "square";
  options: QualityOption[];
  /** Item yang sedang dipilih bila link berisi lebih dari satu video. */
  item: number;
  items?: CarouselItem[];
}

export type JobStage =
  | "queued"
  | "downloading"
  | "merging"
  | "converting"
  | "ready"
  | "error"
  | "expired"
  | "canceled";

export const TERMINAL_STAGES: readonly JobStage[] = [
  "ready",
  "error",
  "expired",
  "canceled",
];

export interface JobProgress {
  jobId: string;
  stage: JobStage;
  /** Progress keseluruhan 0–100 (gabungan semua tahap). */
  percent?: number;
  /** Stream yang sedang diunduh: video, audio, atau satu file utuh. */
  step?: "video" | "audio" | "file";
  downloadedBytes?: number;
  totalBytes?: number;
  speedBps?: number;
  etaSec?: number;
  queuePosition?: number;
  fileName?: string;
  fileSize?: number;
  error?: ApiError;
}

export const API_ERROR_CODES = [
  "INVALID_URL",
  "UNSUPPORTED",
  "PRIVATE",
  "LOGIN_REQUIRED",
  "AGE_RESTRICTED",
  "GEO_BLOCKED",
  "NOT_FOUND",
  "TOO_LONG",
  "TOO_LARGE",
  "FORMAT_UNAVAILABLE",
  "RATE_LIMITED",
  "BUSY",
  "BLOCKED_BY_PLATFORM",
  "TIMEOUT",
  "VERIFICATION_FAILED",
  "UNKNOWN",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Detail tambahan agar UI bisa memilih pesan yang lebih spesifik. */
export type ApiErrorDetail =
  | "live"
  | "playlist"
  | "not_video"
  | "no_video"
  | "no_audio"
  | "drm"
  | "disk"
  | "dns"
  | "expired"
  /** yt-dlp tidak ditemukan di server (mis. deploy Vercel tanpa backend). */
  | "engine"
  /** Hanya di client: request gagal karena koneksi user. */
  | "network";

export interface ApiError {
  code: ApiErrorCode;
  /** Pesan ramah user (Bahasa Indonesia); UI boleh menerjemahkan ulang dari `code`. */
  message: string;
  retryable: boolean;
  detail?: ApiErrorDetail;
  /** Nilai untuk template pesan, mis. { maxMinutes: 120 } pada TOO_LONG. */
  params?: Record<string, string | number>;
  /** Detik sebelum boleh mencoba lagi (untuk RATE_LIMITED/BUSY). */
  retryAfterSec?: number;
}

export interface CreateJobResponse {
  jobId: string;
}
