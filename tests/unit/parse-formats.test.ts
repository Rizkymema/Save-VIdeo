import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { buildOptions, codecFamily, parseInfo, type RawInfo } from "@/lib/ytdlp/parse-formats";
import type { QualityOption } from "@/types/video";

const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/${name}.json`, "utf8")) as RawInfo;
const parseOne = (name: string) => {
  const infos = parseInfo(fixture(name), "https://example.com/video", "other");
  expect(infos).toHaveLength(1);
  return infos[0];
};
const byPreset = (options: QualityOption[], preset: QualityOption["preset"]) => options.find((o) => o.preset === preset);

describe("codecFamily", () => {
  it.each([
    ["avc1.640028", "h264"],
    ["h264", "h264"],
    ["hev1.1.6.L93.B0", "h265"],
    ["bytevc1", "h265"],
    ["h265", "h265"],
    ["vp09.00.51.08", "vp9"],
    ["vp9", "vp9"],
    ["av01.0.12M.08", "av1"],
    ["theora", "other"],
  ])("%s → %s", (input, expected) => {
    expect(codecFamily(input)).toBe(expected);
  });

  it("none/kosong → undefined", () => {
    expect(codecFamily("none")).toBeUndefined();
    expect(codecFamily(null)).toBeUndefined();
  });
});

describe("YouTube 4K (Big Buck Bunny)", () => {
  const info = parseOne("youtube-4k");

  it("metadata dasar", () => {
    expect(info.title).toContain("Big Buck Bunny");
    expect(info.durationSec).toBe(635);
    expect(info.orientation).toBe("landscape");
    expect(info.thumbnail).toMatch(/^https:\/\/i\.ytimg\.com\//);
  });

  it("Terbaik = 1080p H.264 60fps yang di-merge dengan audio", () => {
    const best = byPreset(info.options, "best-compatible")!;
    expect(best).toMatchObject({ label: "1080p", height: 1080, codec: "h264", fps: 60, needsMerge: true, recommended: true });
    expect(best.approxBytes).toBeGreaterThan(100 * 1024 * 1024);
  });

  it("4K & 1440p tersedia (VP9) dan diberi label benar", () => {
    expect(byPreset(info.options, "v2160")).toMatchObject({ label: "4K", height: 2160, codec: "vp9" });
    expect(byPreset(info.options, "v1440")).toMatchObject({ label: "1440p", height: 1440, codec: "vp9" });
  });

  it("tidak ada tombol 1080p ganda (sudah diwakili Terbaik)", () => {
    expect(byPreset(info.options, "v1080")).toBeUndefined();
    const labels = info.options.filter((o) => o.kind === "video").map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("urutan: Terbaik dulu, lalu resolusi menurun, lalu audio", () => {
    const presets = info.options.map((o) => o.preset);
    expect(presets).toEqual(["best-compatible", "v2160", "v1440", "v720", "v480", "v360", "audio-m4a", "audio-mp3"]);
  });

  it("ukuran 4K > 1440p > 720p", () => {
    const size = (p: QualityOption["preset"]) => byPreset(info.options, p)!.approxBytes!;
    expect(size("v2160")).toBeGreaterThan(size("v1440"));
    expect(size("v1440")).toBeGreaterThan(size("v720"));
  });
});

describe("YouTube Shorts (vertikal)", () => {
  const info = parseOne("youtube-short");

  it("orientasi portrait & resolusi dihitung dari sisi terpendek", () => {
    expect(info.orientation).toBe("portrait");
    expect(byPreset(info.options, "best-compatible")).toMatchObject({ label: "720p", height: 720, codec: "h264" });
    expect(info.options.every((o) => (o.height ?? 0) <= 720)).toBe(true);
  });

  it("audio tersedia (banyak trek dubbing tetap jadi satu pilihan M4A & MP3)", () => {
    expect(info.options.filter((o) => o.kind === "audio").map((o) => o.preset)).toEqual(["audio-m4a", "audio-mp3"]);
  });
});

describe("TikTok", () => {
  const info = parseOne("tiktok");

  it("Terbaik = H.264 tanpa watermark dengan bitrate tertinggi, tanpa merge", () => {
    const best = byPreset(info.options, "best-compatible")!;
    expect(best).toMatchObject({ codec: "h264", height: 576, needsMerge: false, recommended: true });
    // 2,4 Mbps (bukan varian 0,9 Mbps dan bukan "download" yang ber-watermark)
    expect(best.approxBytes).toBe(2978825);
  });

  it("1080p & 720p HEVC tetap ditawarkan sebagai alternatif", () => {
    expect(byPreset(info.options, "v1080")).toMatchObject({ label: "1080p", codec: "h265" });
    expect(byPreset(info.options, "v720")).toMatchObject({ label: "720p", codec: "h265" });
  });

  it("orientasi portrait", () => {
    expect(info.orientation).toBe("portrait");
  });
});

describe("Instagram", () => {
  it("Reel tanpa audio → tidak menawarkan MP3/M4A", () => {
    const info = parseOne("instagram-reel");
    expect(byPreset(info.options, "best-compatible")).toMatchObject({ label: "720p", codec: "h264", needsMerge: false });
    expect(info.options.some((o) => o.kind === "audio")).toBe(false);
  });

  it("carousel → beberapa item dengan indeks 1..n", () => {
    const infos = parseInfo(fixture("instagram-carousel"), "https://www.instagram.com/p/BQ0eAlwhDrw/", "instagram");
    expect(infos.length).toBe(3);
    expect(infos.map((i) => i.item)).toEqual([1, 2, 3]);
    expect(infos[0].items?.map((i) => i.index)).toEqual([1, 2, 3]);
    expect(infos.every((i) => i.platform === "instagram" && i.orientation === "square")).toBe(true);
  });
});

describe("Facebook (format hd/sd tanpa resolusi)", () => {
  const info = parseOne("facebook");

  it("memilih hd dan memberi label HD", () => {
    expect(byPreset(info.options, "best-compatible")).toMatchObject({ label: "HD", recommended: true });
  });

  it("audio ditawarkan (codec tidak diketahui dianggap ada audio)", () => {
    expect(info.options.some((o) => o.preset === "audio-mp3")).toBe(true);
  });
});

describe("X / Twitter", () => {
  const info = parseOne("twitter");

  it("Terbaik 720p H.264, plus 360p", () => {
    expect(byPreset(info.options, "best-compatible")).toMatchObject({ label: "720p", codec: "h264" });
    expect(byPreset(info.options, "v360")).toMatchObject({ label: "360p" });
  });

  it("judul dibersihkan & durasi dibulatkan", () => {
    expect(info.title.startsWith("NASA")).toBe(true);
    expect(info.durationSec).toBe(205);
  });
});

describe("kasus khusus", () => {
  it("siaran langsung ditolak", () => {
    expect(() => parseInfo({ title: "Live", is_live: true, formats: [] }, "u", "youtube")).toThrow(AppError);
    try {
      parseInfo({ title: "Live", live_status: "is_upcoming", formats: [] }, "u", "youtube");
    } catch (err) {
      expect((err as AppError).apiError).toMatchObject({ code: "UNSUPPORTED", detail: "live" });
    }
  });

  it("playlist kosong → NOT_FOUND no_video", () => {
    try {
      parseInfo({ _type: "playlist", entries: [] }, "u", "instagram");
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).apiError).toMatchObject({ code: "NOT_FOUND", detail: "no_video" });
    }
  });

  it("semua format DRM → UNSUPPORTED drm", () => {
    try {
      parseInfo({ title: "x", formats: [{ format_id: "1", vcodec: "avc1", acodec: "mp4a", has_drm: true }] }, "u", "other");
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).apiError).toMatchObject({ code: "UNSUPPORTED", detail: "drm" });
    }
  });

  it("info tanpa daftar formats memakai URL langsung sebagai satu format", () => {
    const [info] = parseInfo({ title: "Direct", url: "https://cdn.example.com/v.mp4", ext: "mp4", width: 1920, height: 1080 }, "u", "other");
    expect(byPreset(info.options, "best-compatible")).toMatchObject({ label: "1080p", needsMerge: false });
  });

  it("buildOptions tanpa format video → hanya audio", () => {
    const options = buildOptions([{ format_id: "a", vcodec: "none", acodec: "mp4a.40.2", ext: "m4a", abr: 128 }], 60);
    expect(options.map((o) => o.preset)).toEqual(["audio-m4a", "audio-mp3"]);
  });

  it("judul berbahaya dibersihkan dari karakter kontrol", () => {
    const [info] = parseInfo({ title: "Halo\u0000\nDunia\t!", url: "https://x/v.mp4", height: 720, width: 1280 }, "u", "other");
    expect(info.title).toBe("Halo Dunia !");
  });
});
