import type { QualityPreset } from "@/types/video";

export interface VideoBucket {
  preset: Extract<QualityPreset, `v${number}`>;
  /** Batas atas resolusi (sisi terpendek). */
  cap: number;
  /** Batas bawah (eksklusif dari bucket di bawahnya). */
  min: number;
}

/** Urut dari resolusi tertinggi; tiap bucket = satu tombol kualitas. */
export const VIDEO_BUCKETS: readonly VideoBucket[] = [
  { preset: "v2160", cap: 2160, min: 1441 },
  { preset: "v1440", cap: 1440, min: 1081 },
  { preset: "v1080", cap: 1080, min: 721 },
  { preset: "v720", cap: 720, min: 481 },
  { preset: "v480", cap: 480, min: 361 },
  { preset: "v360", cap: 360, min: 0 },
];

/** Bitrate rata-rata MP3 VBR V0 (`--audio-quality 0`) untuk estimasi ukuran. */
export const MP3_V0_AVG_BPS = 245_000;

export function resolutionLabel(height: number | undefined): string | undefined {
  if (!height) return undefined;
  if (height >= 4000) return "8K";
  if (height >= 2000) return "4K";
  return `${height}p`;
}

export type ResolutionTier = "uhd" | "qhd" | "fhd" | "hd" | "sd";

export function resolutionTier(height: number | undefined): ResolutionTier | undefined {
  if (!height) return undefined;
  if (height >= 2000) return "uhd";
  if (height >= 1400) return "qhd";
  if (height >= 1000) return "fhd";
  if (height >= 700) return "hd";
  return "sd";
}
