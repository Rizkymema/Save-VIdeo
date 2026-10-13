import { MARK } from "@/lib/ytdlp/args";

export type ProgressEvent =
  | {
      type: "download";
      /** "none" = stream audio saja. */
      vcodec: string;
      status: string;
      filename?: string;
      downloadedBytes?: number;
      totalBytes?: number;
      speedBps?: number;
      etaSec?: number;
      fragmentIndex?: number;
      fragmentCount?: number;
    }
  | { type: "postprocess"; postprocessor: string; status: string }
  | { type: "done"; filepath: string; title?: string };

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

/** Parse satu baris output yt-dlp; null bila bukan baris penanda kita. */
export function parseProgressLine(line: string): ProgressEvent | null {
  const progressAt = line.indexOf(MARK.progress);
  if (progressAt !== -1 && !line.startsWith(MARK.postprocess, progressAt)) {
    const rest = line.slice(progressAt + MARK.progress.length);
    const sep = rest.indexOf(MARK.sep);
    if (sep === -1) return null;
    try {
      const p = JSON.parse(rest.slice(sep + MARK.sep.length)) as Record<string, unknown>;
      return {
        type: "download",
        vcodec: rest.slice(0, sep) || "NA",
        status: typeof p.status === "string" ? p.status : "downloading",
        filename: typeof p.filename === "string" ? p.filename : undefined,
        downloadedBytes: num(p.downloaded_bytes),
        totalBytes: num(p.total_bytes) ?? num(p.total_bytes_estimate),
        speedBps: num(p.speed),
        etaSec: num(p.eta),
        fragmentIndex: num(p.fragment_index),
        fragmentCount: num(p.fragment_count),
      };
    } catch {
      return null;
    }
  }

  const ppAt = line.indexOf(MARK.postprocess);
  if (ppAt !== -1) {
    const [postprocessor = "", status = ""] = line.slice(ppAt + MARK.postprocess.length).split(MARK.sep);
    return { type: "postprocess", postprocessor: postprocessor.trim(), status: status.trim() };
  }

  const doneAt = line.indexOf(MARK.done);
  if (doneAt !== -1) {
    const rest = line.slice(doneAt + MARK.done.length);
    const sep = rest.indexOf(MARK.sep);
    try {
      const filepath = JSON.parse(sep === -1 ? rest : rest.slice(0, sep)) as unknown;
      if (typeof filepath !== "string" || !filepath) return null;
      let title: string | undefined;
      if (sep !== -1) {
        const parsed = JSON.parse(rest.slice(sep + MARK.sep.length)) as unknown;
        if (typeof parsed === "string") title = parsed;
      }
      return { type: "done", filepath, title };
    } catch {
      return null;
    }
  }
  return null;
}

/** Tahap job berdasarkan nama postprocessor yt-dlp. */
export function stageForPostprocessor(name: string): "merging" | "converting" | null {
  if (name === "Merger" || name.startsWith("Fixup")) return "merging";
  if (name === "ExtractAudio" || name === "Metadata" || name === "FFmpegMetadata" || name === "EmbedThumbnail") {
    return "converting";
  }
  return null;
}

/**
 * Pemetaan progress per-stream ke progress keseluruhan (0–100):
 * - 2 stream (video+audio): video 0–80, audio 80–92, merge 92–99
 * - 1 stream: unduh 0–92, proses 92–99
 */
export function overallPercent(opts: {
  streamCount: number;
  streamIndex: number;
  streamPercent: number;
  stage: "downloading" | "merging" | "converting";
}): number {
  const p = Math.max(0, Math.min(100, opts.streamPercent)) / 100;
  if (opts.stage !== "downloading") return 95;
  if (opts.streamCount >= 2) {
    return opts.streamIndex === 0 ? p * 80 : 80 + p * 12;
  }
  return p * 92;
}
