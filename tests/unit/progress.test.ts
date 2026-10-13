import { describe, expect, it } from "vitest";
import { overallPercent, parseProgressLine, stageForPostprocessor } from "@/lib/ytdlp/progress";

// Baris asli dari yt-dlp 2026.08 (dipendekkan) — lihat downloadArgs() untuk template-nya.
const VIDEO_LINE =
  '__SLP__avc1.4D400C|SL|{"status": "downloading", "downloaded_bytes": 130048, "total_bytes": 433081, "tmpfilename": "C:\\\\tmp\\\\job.f133.mp4.part", "filename": "C:\\\\tmp\\\\job.f133.mp4", "eta": 0, "speed": 329289.5, "elapsed": 0.4}';
const AUDIO_FINISHED =
  '__SLP__none|SL|{"downloaded_bytes": 309288, "total_bytes": 309288, "filename": "C:\\\\tmp\\\\job.f140.m4a", "status": "finished", "elapsed": 0.9, "speed": 337776.4}';
const HLS_LINE =
  '__SLP__avc1.64001F|SL|{"status": "downloading", "downloaded_bytes": 5000, "total_bytes_estimate": 900000, "fragment_index": 3, "fragment_count": 12, "speed": null, "eta": null, "filename": "x.mp4"}';

describe("parseProgressLine", () => {
  it("baris download video", () => {
    expect(parseProgressLine(VIDEO_LINE)).toMatchObject({
      type: "download",
      vcodec: "avc1.4D400C",
      status: "downloading",
      downloadedBytes: 130048,
      totalBytes: 433081,
      etaSec: 0,
      filename: "C:\\tmp\\job.f133.mp4",
    });
  });

  it("stream audio selesai", () => {
    expect(parseProgressLine(AUDIO_FINISHED)).toMatchObject({ type: "download", vcodec: "none", status: "finished" });
  });

  it("HLS: total estimasi & fragmen; null diabaikan", () => {
    const ev = parseProgressLine(HLS_LINE);
    expect(ev).toMatchObject({ totalBytes: 900000, fragmentIndex: 3, fragmentCount: 12 });
    expect(ev && "speedBps" in ev ? ev.speedBps : "x").toBeUndefined();
  });

  it("postprocessor", () => {
    expect(parseProgressLine("__SLPP__Merger|SL|started")).toEqual({ type: "postprocess", postprocessor: "Merger", status: "started" });
  });

  it("baris selesai berisi path & judul (JSON, aman untuk Unicode)", () => {
    const line = '__SLDONE__"C:\\\\tmp\\\\abc.mp4"|SL|"Judul \\ud83d\\ude31 keren"';
    expect(parseProgressLine(line)).toEqual({ type: "done", filepath: "C:\\tmp\\abc.mp4", title: "Judul 😱 keren" });
  });

  it("baris lain diabaikan", () => {
    expect(parseProgressLine("[youtube] abc: Downloading webpage")).toBeNull();
    expect(parseProgressLine("__SLP__broken")).toBeNull();
    expect(parseProgressLine('__SLDONE__not-json')).toBeNull();
  });
});

describe("stageForPostprocessor", () => {
  it.each([
    ["Merger", "merging"],
    ["FixupM3u8", "merging"],
    ["ExtractAudio", "converting"],
    ["Metadata", "converting"],
    ["MoveFiles", null],
  ])("%s → %s", (name, stage) => {
    expect(stageForPostprocessor(name)).toBe(stage);
  });
});

describe("overallPercent", () => {
  it("dua stream: video 0–80, audio 80–92", () => {
    expect(overallPercent({ streamCount: 2, streamIndex: 0, streamPercent: 50, stage: "downloading" })).toBe(40);
    expect(overallPercent({ streamCount: 2, streamIndex: 1, streamPercent: 100, stage: "downloading" })).toBe(92);
  });

  it("satu stream: 0–92; tahap proses = 95", () => {
    expect(overallPercent({ streamCount: 1, streamIndex: 0, streamPercent: 100, stage: "downloading" })).toBe(92);
    expect(overallPercent({ streamCount: 1, streamIndex: 0, streamPercent: 0, stage: "merging" })).toBe(95);
  });

  it("nilai di luar 0–100 dijepit", () => {
    expect(overallPercent({ streamCount: 1, streamIndex: 0, streamPercent: 250, stage: "downloading" })).toBe(92);
    expect(overallPercent({ streamCount: 1, streamIndex: 0, streamPercent: -5, stage: "downloading" })).toBe(0);
  });
});
