import { MP3_V0_AVG_BPS, VIDEO_BUCKETS, resolutionLabel } from "@/constants/presets";
import { AppError } from "@/lib/errors";
import type { CarouselItem, Platform, QualityOption, VideoCodec, VideoInfo } from "@/types/video";

/** Subset field JSON yt-dlp (`-J`) yang kita pakai. */
export interface RawFormat {
  format_id?: string;
  format_note?: string | null;
  ext?: string | null;
  protocol?: string | null;
  vcodec?: string | null;
  acodec?: string | null;
  width?: number | null;
  height?: number | null;
  resolution?: string | null;
  fps?: number | null;
  tbr?: number | null;
  abr?: number | null;
  vbr?: number | null;
  filesize?: number | null;
  filesize_approx?: number | null;
  dynamic_range?: string | null;
  has_drm?: boolean | string | null;
  /** Preferensi dari extractor (mis. Facebook: hd > sd). */
  quality?: number | null;
  preference?: number | null;
  /** Audio asli > dubbing otomatis (YouTube). */
  language_preference?: number | null;
  url?: string;
}

export interface RawThumbnail {
  url?: string;
  width?: number;
  height?: number;
  preference?: number;
}

export interface RawInfo extends RawFormat {
  _type?: string;
  id?: string;
  title?: string | null;
  fulltitle?: string | null;
  uploader?: string | null;
  channel?: string | null;
  creator?: string | null;
  uploader_id?: string | null;
  thumbnail?: string | null;
  thumbnails?: RawThumbnail[] | null;
  duration?: number | null;
  is_live?: boolean | null;
  live_status?: string | null;
  webpage_url?: string;
  extractor_key?: string;
  formats?: RawFormat[] | null;
  entries?: (RawInfo | null)[] | null;
}

interface Candidate {
  f: RawFormat;
  res?: number;
  codec?: VideoCodec;
  hdr: boolean;
  hasAudio: boolean;
  size?: number;
}

export function codecFamily(vcodec?: string | null): VideoCodec | undefined {
  if (!vcodec || vcodec === "none") return undefined;
  const v = vcodec.toLowerCase();
  if (v.startsWith("avc") || v.startsWith("h264")) return "h264";
  if (v.startsWith("hev") || v.startsWith("hvc") || v.startsWith("h265") || v.startsWith("bytevc1")) return "h265";
  if (v.startsWith("vp09") || v.startsWith("vp9")) return "vp9";
  if (v.startsWith("av01") || v === "av1") return "av1";
  return "other";
}

/** Urutan `+vcodec:avc` di yt-dlp: h264 > h265 > vp9 > av1 > lainnya > tidak diketahui. */
const CODEC_RANK: Record<VideoCodec, number> = { h264: 0, h265: 1, vp9: 2, av1: 3, other: 4 };
const codecRank = (c?: VideoCodec) => (c ? CODEC_RANK[c] : 5);

/** Urutan `+acodec:m4a` di yt-dlp: mp4a/aac > vorbis > opus > mp3 > lainnya. */
function audioRank(acodec?: string | null, ext?: string | null): number {
  const a = (acodec ?? "").toLowerCase();
  if (a.startsWith("mp4a") || a.startsWith("aac") || (!a && ext === "m4a")) return 0;
  if (a.startsWith("vorbis")) return 1;
  if (a.startsWith("opus")) return 2;
  if (a.startsWith("mp3")) return 3;
  return a ? 4 : 5;
}

function protoRank(protocol?: string | null): number {
  const p = (protocol ?? "https").toLowerCase();
  if (p === "https" || p === "http") return 0;
  if (p.startsWith("m3u8")) return 1;
  if (p.includes("dash")) return 2;
  return 3;
}

function resolutionOf(f: RawFormat): number | undefined {
  let { width, height } = f;
  if ((!width || !height) && f.resolution) {
    const m = f.resolution.match(/^(\d+)x(\d+)$/);
    if (m) {
      width = Number(m[1]);
      height = Number(m[2]);
    }
  }
  if (width && height) return Math.min(width, height);
  return height ?? undefined;
}

function sizeOf(f: RawFormat, durationSec?: number): number | undefined {
  const exact = f.filesize ?? f.filesize_approx;
  if (exact && exact > 0) return Math.round(exact);
  if (f.tbr && durationSec) return Math.round(((f.tbr * 1000) / 8) * durationSec);
  return undefined;
}

function isUsable(f: RawFormat): boolean {
  if (f.has_drm === true || f.has_drm === "maybe") return false;
  const note = (f.format_note ?? "").toLowerCase();
  if (note.includes("storyboard") || f.ext === "mhtml" || f.protocol === "mhtml") return false;
  if (f.vcodec === "none" && f.acodec === "none") return false;
  return true;
}

const isDrc = (f: RawFormat) =>
  /-drc$/i.test(f.format_id ?? "") || /\bDRC\b/.test(f.format_note ?? "");

/** Label "HD"/"SD" dari id/catatan format bila resolusinya tidak diketahui (mis. Facebook `hd`/`sd`). */
function textLabel(f: RawFormat): "HD" | "SD" | undefined {
  const text = `${f.format_id ?? ""} ${f.format_note ?? ""}`;
  if (/(^|[^a-z])hd([^a-z]|$)/i.test(text)) return "HD";
  if (/(^|[^a-z])sd([^a-z]|$)/i.test(text)) return "SD";
  return undefined;
}

/** Kualitas dari extractor; tanpa itu, tebak dari label HD/SD. */
function qualityHint(f: RawFormat): number {
  if (typeof f.quality === "number") return f.quality;
  const label = textLabel(f);
  return label === "HD" ? 1 : label === "SD" ? -1 : 0;
}

function analyze(formats: RawFormat[], durationSec?: number) {
  const videos: Candidate[] = [];
  const audios: Candidate[] = [];
  for (const f of formats) {
    if (!isUsable(f)) continue;
    const candidate: Candidate = {
      f,
      res: f.vcodec === "none" ? undefined : resolutionOf(f),
      codec: codecFamily(f.vcodec),
      hdr: Boolean(f.dynamic_range && f.dynamic_range !== "SDR") || /^vp0?9\.0?2/i.test(f.vcodec ?? ""),
      hasAudio: f.acodec !== "none",
      size: sizeOf(f, durationSec),
    };
    if (f.vcodec === "none") audios.push(candidate);
    else videos.push(candidate);
  }
  audios.sort(
    (a, b) =>
      (b.f.language_preference ?? 0) - (a.f.language_preference ?? 0) ||
      Number(isDrc(a.f)) - Number(isDrc(b.f)) ||
      audioRank(a.f.acodec, a.f.ext) - audioRank(b.f.acodec, b.f.ext) ||
      (b.f.abr ?? b.f.tbr ?? 0) - (a.f.abr ?? a.f.tbr ?? 0) ||
      protoRank(a.f.protocol) - protoRank(b.f.protocol) ||
      Number(b.size !== undefined) - Number(a.size !== undefined),
  );
  return { videos, audios };
}

/** Tie-breaker setelah resolusi/codec: preferensi extractor, SDR, fps, protokol https, ukuran diketahui, bitrate. */
function tieBreak(a: Candidate, b: Candidate): number {
  return (
    (b.f.preference ?? 0) - (a.f.preference ?? 0) ||
    qualityHint(b.f) - qualityHint(a.f) ||
    Number(a.hdr) - Number(b.hdr) ||
    (b.f.fps ?? 0) - (a.f.fps ?? 0) ||
    protoRank(a.f.protocol) - protoRank(b.f.protocol) ||
    Number(b.size !== undefined) - Number(a.size !== undefined) ||
    (b.f.tbr ?? 0) - (a.f.tbr ?? 0)
  );
}

function byCompat(a: Candidate, b: Candidate): number {
  return codecRank(a.codec) - codecRank(b.codec) || (b.res ?? 0) - (a.res ?? 0) || tieBreak(a, b);
}

function byResolution(a: Candidate, b: Candidate): number {
  return (b.res ?? 0) - (a.res ?? 0) || codecRank(a.codec) - codecRank(b.codec) || tieBreak(a, b);
}

function buildOption(
  preset: QualityOption["preset"],
  v: Candidate,
  bestAudio: Candidate | undefined,
  recommended = false,
): QualityOption {
  const needsMerge = !v.hasAudio && Boolean(bestAudio);
  const size = v.size !== undefined ? v.size + (needsMerge ? (bestAudio?.size ?? 0) : 0) : undefined;
  const option: QualityOption = {
    preset,
    kind: "video",
    label: resolutionLabel(v.res) ?? textLabel(v.f) ?? "Auto",
    ext: "mp4",
    needsMerge,
  };
  if (v.res) option.height = v.res;
  if (size) option.approxBytes = size;
  if (v.f.fps) option.fps = Math.round(v.f.fps);
  if (v.codec) option.codec = v.codec;
  if (v.hdr) option.hdr = true;
  if (recommended) option.recommended = true;
  return option;
}

/** Hitung tombol kualitas yang benar-benar tersedia untuk satu video. */
export function buildOptions(formats: RawFormat[], durationSec?: number): QualityOption[] {
  const { videos, audios } = analyze(formats, durationSec);
  const bestAudio = audios[0];
  // Tanpa audio terpisah, yt-dlp jatuh ke format gabungan (b) → pilih yang sudah ada audionya.
  const withAudio = videos.filter((v) => v.hasAudio);
  const pool = bestAudio || withAudio.length === 0 ? videos : withAudio;

  const options: QualityOption[] = [];
  const compat = [...pool].sort(byCompat)[0];
  if (compat) options.push(buildOption("best-compatible", compat, bestAudio, true));

  for (const bucket of VIDEO_BUCKETS) {
    const pick = pool
      .filter((v) => v.res !== undefined && v.res >= bucket.min && v.res <= bucket.cap)
      .sort(byResolution)[0];
    if (!pick) continue;
    // Jangan tampilkan dobel: bucket yang hasilnya sama dengan pilihan "Terbaik".
    if (compat && pick.res === compat.res && pick.codec === compat.codec) continue;
    options.push(buildOption(bucket.preset, pick, bestAudio));
  }

  const hasAudio = Boolean(bestAudio) || withAudio.length > 0;
  if (hasAudio) {
    const m4a = audios.find((a) => audioRank(a.f.acodec, a.f.ext) === 0 && !isDrc(a.f));
    const m4aSize = m4a?.size ?? (durationSec ? Math.round((160_000 / 8) * durationSec) : undefined);
    const mp3Size = durationSec ? Math.round((MP3_V0_AVG_BPS / 8) * durationSec) : undefined;
    options.push({ preset: "audio-m4a", kind: "audio", label: "M4A", ext: "m4a", ...(m4aSize ? { approxBytes: m4aSize } : {}) });
    options.push({ preset: "audio-mp3", kind: "audio", label: "MP3", ext: "mp3", ...(mp3Size ? { approxBytes: mp3Size } : {}) });
  }
  return options;
}

function pickThumbnail(raw: RawInfo): string | undefined {
  const candidates = [raw.thumbnail, ...[...(raw.thumbnails ?? [])].reverse().map((t) => t.url)];
  return candidates.find((u): u is string => typeof u === "string" && /^https:\/\//i.test(u));
}

function orientationOf(raw: RawInfo, formats: RawFormat[]): VideoInfo["orientation"] {
  const sized = [raw, ...formats].find((f) => f.width && f.height && f.vcodec !== "none");
  if (!sized?.width || !sized.height) return undefined;
  const ratio = sized.width / sized.height;
  if (ratio > 1.1) return "landscape";
  if (ratio < 0.9) return "portrait";
  return "square";
}

const isLive = (raw: RawInfo) =>
  raw.is_live === true || raw.live_status === "is_live" || raw.live_status === "is_upcoming";

function cleanText(value: string | null | undefined, max = 300): string | undefined {
  if (!value) return undefined;
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function entryToInfo(raw: RawInfo, sourceUrl: string, platform: Platform, item: number): VideoInfo {
  if (isLive(raw)) throw new AppError("UNSUPPORTED", { detail: "live" });
  const formats = raw.formats?.length ? raw.formats : raw.url ? [raw as RawFormat] : [];
  const usable = formats.filter(isUsable);
  if (formats.length > 0 && usable.length === 0) throw new AppError("UNSUPPORTED", { detail: "drm" });
  const durationSec = raw.duration && Number.isFinite(raw.duration) && raw.duration > 0 ? Math.round(raw.duration) : undefined;
  const options = buildOptions(formats, durationSec);
  if (!options.some((o) => o.kind === "video") && !options.some((o) => o.kind === "audio")) {
    throw new AppError("NOT_FOUND", { detail: "no_video" });
  }

  const info: VideoInfo = {
    sourceUrl,
    platform,
    title: cleanText(raw.title) ?? cleanText(raw.fulltitle) ?? cleanText(raw.id) ?? "Video",
    options,
    item,
  };
  const uploader = cleanText(raw.uploader ?? raw.channel ?? raw.creator ?? raw.uploader_id, 120);
  if (uploader) info.uploader = uploader;
  const thumbnail = pickThumbnail(raw);
  if (thumbnail) info.thumbnail = thumbnail;
  if (durationSec) info.durationSec = durationSec;
  const orientation = orientationOf(raw, formats);
  if (orientation) info.orientation = orientation;
  return info;
}

/** Hasil parse: satu atau beberapa video (mis. carousel Instagram). */
export function parseInfo(raw: RawInfo, sourceUrl: string, platform: Platform): VideoInfo[] {
  const entries =
    raw._type === "playlist" || raw._type === "multi_video"
      ? (raw.entries ?? []).filter((e): e is RawInfo => Boolean(e))
      : [raw];
  if (entries.length === 0) throw new AppError("NOT_FOUND", { detail: "no_video" });

  const infos = entries.map((entry, i) => entryToInfo(entry, sourceUrl, platform, i + 1));
  if (infos.length > 1) {
    const items: CarouselItem[] = infos.map((info) => ({
      index: info.item,
      title: info.title,
      ...(info.thumbnail ? { thumbnail: info.thumbnail } : {}),
      ...(info.durationSec ? { durationSec: info.durationSec } : {}),
    }));
    for (const info of infos) info.items = items;
  }
  return infos;
}
