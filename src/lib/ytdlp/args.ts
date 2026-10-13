import "server-only";
import path from "node:path";
import { env } from "@/lib/env";
import { executablePath } from "@/lib/system";
import { VIDEO_BUCKETS } from "@/constants/presets";
import type { QualityPreset } from "@/types/video";

/** Penanda baris output yang kita parse (lihat progress.ts). */
export const MARK = {
  progress: "__SLP__",
  postprocess: "__SLPP__",
  done: "__SLDONE__",
  sep: "|SL|",
} as const;

/** Batas item untuk postingan multi-video (carousel). */
export const MAX_PLAYLIST_ITEMS = 20;

/** Argumen dasar untuk setiap pemanggilan yt-dlp. */
export function baseArgs(): string[] {
  const e = env();
  const args = [
    "--ignore-config",
    "--no-playlist",
    // Matikan extractor "generic": hanya situs yang dikenal yt-dlp yang diproses (anti-SSRF).
    "--ies",
    "default,-generic",
    "--socket-timeout",
    "15",
    "--no-warnings",
    "--encoding",
    "utf-8",
  ];
  for (const runtime of e.YTDLP_JS_RUNTIMES.split(",").map((s) => s.trim()).filter(Boolean)) {
    args.push("--js-runtimes", runtime);
  }
  if (e.FFMPEG_PATH) args.push("--ffmpeg-location", executablePath(e.FFMPEG_PATH));
  if (e.YTDLP_CACHE_DIR) args.push("--cache-dir", e.YTDLP_CACHE_DIR);
  if (e.YTDLP_PROXY) args.push("--proxy", e.YTDLP_PROXY);
  if (e.YTDLP_COOKIES_FILE) args.push("--cookies", e.YTDLP_COOKIES_FILE);
  return args;
}

/** Ambil metadata saja (tanpa download). */
export function infoArgs(url: string): string[] {
  return [...baseArgs(), "-J", "--playlist-items", `1:${MAX_PLAYLIST_ITEMS}`, "--", url];
}

const VIDEO_FORMAT = "bv*+ba/b";
// Utamakan H.264 + AAC (MP4) agar bisa diputar di semua perangkat, termasuk galeri iPhone.
const COMPAT_SORT = "+vcodec:avc,res,+acodec:m4a";

export function presetArgs(preset: QualityPreset): string[] {
  switch (preset) {
    case "best-compatible":
      return ["-f", VIDEO_FORMAT, "-S", COMPAT_SORT, "--merge-output-format", "mp4"];
    case "audio-m4a":
      // Utamakan sumber AAC agar tanpa transcode: audio m4a terpisah → trek AAC di file video
      // (mis. TikTok yang audio terpisahnya MP3) → audio apa pun (dikonversi ke AAC).
      return [
        "-f",
        "ba[ext=m4a]/b[acodec^=aac]/b[acodec^=mp4a]/ba/b",
        "-x",
        "--audio-format",
        "m4a",
        "--audio-quality",
        "0",
        "--embed-metadata",
      ];
    case "audio-mp3":
      return ["-f", "ba/b", "-x", "--audio-format", "mp3", "--audio-quality", "0", "--embed-metadata"];
    default: {
      const bucket = VIDEO_BUCKETS.find((b) => b.preset === preset);
      if (!bucket) throw new Error(`Preset tidak dikenal: ${preset}`);
      // res:N = resolusi terbesar tetapi tidak melebihi N (sisi terpendek → aman untuk video vertikal).
      return ["-f", VIDEO_FORMAT, "-S", `res:${bucket.cap},+vcodec:avc,+acodec:m4a`, "--merge-output-format", "mp4"];
    }
  }
}

export interface DownloadArgsInput {
  url: string;
  preset: QualityPreset;
  item: number;
  jobId: string;
  outDir: string;
  /** Default MAX_FILESIZE_MB; mode direct memakai batas yang lebih kecil. */
  maxFilesizeMb?: number;
}

export function downloadArgs({ url, preset, item, jobId, outDir, maxFilesizeMb }: DownloadArgsInput): string[] {
  const e = env();
  return [
    ...baseArgs(),
    "--no-mtime",
    "--concurrent-fragments",
    "4",
    "--newline",
    "--progress",
    "--progress-template",
    `download:${MARK.progress}%(info.vcodec)s${MARK.sep}%(progress)j`,
    "--progress-template",
    `postprocess:${MARK.postprocess}%(progress.postprocessor)s${MARK.sep}%(progress.status)s`,
    "--print",
    `after_move:${MARK.done}%(filepath)j${MARK.sep}%(title)j`,
    "--max-filesize",
    `${maxFilesizeMb ?? e.MAX_FILESIZE_MB}M`,
    "--playlist-items",
    String(item),
    "-o",
    path.join(outDir, `${jobId}.%(ext)s`),
    ...presetArgs(preset),
    "--",
    url,
  ];
}
