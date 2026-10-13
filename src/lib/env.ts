import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

/** Di Vercel: binary Linux dibundel ke vendor/bin (lihat scripts/fetch-binaries.mjs). */
const ON_VERCEL = process.env.VERCEL === "1";

function vendorBinary(name: string): string | undefined {
  const candidate = path.join(process.cwd(), "vendor", "bin", name);
  return fs.existsSync(candidate) ? candidate : undefined;
}

const emptyToUndefined = (v: unknown) => (v === "" || v === undefined || v === null ? undefined : v);

const int = (def: number, min: number, max = Number.MAX_SAFE_INTEGER) =>
  z.preprocess(
    (v) => {
      const x = emptyToUndefined(v);
      return x === undefined ? undefined : Number(x);
    },
    z.number().int().min(min).max(max).default(def),
  );

const str = (def = "") => z.preprocess(emptyToUndefined, z.string().default(def));

const bool = (def: boolean) =>
  z.preprocess((v) => {
    const x = emptyToUndefined(v);
    if (x === undefined) return undefined;
    return ["1", "true", "yes", "on"].includes(String(x).toLowerCase());
  }, z.boolean().default(def));

const schema = z.object({
  YTDLP_PATH: str(vendorBinary("yt-dlp") ?? "yt-dlp"),
  /** Kosong = cari ffmpeg di PATH. */
  FFMPEG_PATH: str(vendorBinary("ffmpeg") ?? ""),
  /**
   * Diteruskan ke `--js-runtimes`, dipisah koma. Contoh: "deno" atau "deno:/usr/local/bin/deno".
   * Di Vercel tidak ada Deno → pakai Node.js milik function itu sendiri.
   */
  YTDLP_JS_RUNTIMES: str(ON_VERCEL ? `node:${process.execPath}` : ""),
  /** Folder cache yt-dlp (di Vercel HOME tidak bisa ditulis → /tmp). Kosong = default yt-dlp. */
  YTDLP_CACHE_DIR: str(ON_VERCEL ? path.join(os.tmpdir(), "yt-dlp-cache") : ""),
  DOWNLOAD_DIR: str(path.join(os.tmpdir(), "savelink")),
  /**
   * "jobs" = antrean + progress SSE (server Docker/VPS yang hidup terus).
   * "direct" = satu request: proses lalu langsung kirim file (serverless/Vercel).
   */
  DOWNLOAD_MODE: z.preprocess(emptyToUndefined, z.enum(["jobs", "direct"]).default(ON_VERCEL ? "direct" : "jobs")),
  /** Mode direct: batas waktu proses yt-dlp (sisanya untuk mengirim file; Vercel Hobby total 300 dtk). */
  DIRECT_TIMEOUT_SEC: int(220, 30, 3600),
  /** Mode direct: batas ukuran file agar sempat terkirim sebelum function dihentikan. */
  DIRECT_MAX_FILESIZE_MB: int(250, 1),
  MAX_CONCURRENT_JOBS: int(3, 1, 64),
  MAX_JOBS_PER_IP: int(2, 1, 64),
  MAX_QUEUE_LENGTH: int(30, 1, 10_000),
  RATE_LIMIT_INFO_PER_MIN: int(15, 1, 10_000),
  RATE_LIMIT_JOBS_PER_10MIN: int(20, 1, 10_000),
  MAX_DURATION_SEC: int(7200, 10),
  MAX_FILESIZE_MB: int(2048, 1),
  MIN_FREE_DISK_MB: int(1024, 0),
  JOB_TTL_MINUTES: int(30, 1, 24 * 60),
  /** Setelah file selesai diunduh user, simpan sebentar untuk "Download ulang". */
  DOWNLOAD_GRACE_MINUTES: int(5, 1, 24 * 60),
  INFO_TIMEOUT_SEC: int(30, 5, 600),
  JOB_TIMEOUT_SEC: int(900, 30, 6 * 3600),
  INFO_CACHE_MINUTES: int(10, 0, 24 * 60),
  YTDLP_PROXY: str(),
  YTDLP_COOKIES_FILE: str(),
  YTDLP_AUTO_UPDATE: bool(false),
  /** Header mana yang dipercaya untuk IP asli user (lihat request-ip.ts). */
  TRUST_PROXY_HEADER: z.preprocess(
    emptyToUndefined,
    z.enum(["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "none"]).default("x-forwarded-for"),
  ),
  TURNSTILE_SECRET_KEY: str(),
  ALERT_WEBHOOK_URL: str(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Dibaca saat pertama dipakai (runtime), bukan saat build. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`[savelink] Konfigurasi environment tidak valid → ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
