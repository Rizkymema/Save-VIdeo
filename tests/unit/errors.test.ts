import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillTemplate } from "@/constants/messages";
import { AppError, makeApiError } from "@/lib/errors";
import { extractErrorLine, mapYtDlpError } from "@/lib/ytdlp/errors";

describe("mapYtDlpError", () => {
  it.each([
    ["ERROR: [youtube] abc: Private video. Sign in if you've been granted access to this video", "PRIVATE"],
    ["ERROR: [youtube] abc: Sign in to confirm your age. This video may be inappropriate for some users.", "AGE_RESTRICTED"],
    ["ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies", "BLOCKED_BY_PLATFORM"],
    ["ERROR: [youtube] abc: Video unavailable. This video has been removed by the uploader", "NOT_FOUND"],
    ["ERROR: [youtube] abc: The uploader has not made this video available in your country", "GEO_BLOCKED"],
    ["ERROR: No suitable extractor found for URL https://example.com/video.mp4", "UNSUPPORTED"],
    ["ERROR: Unsupported URL: https://example.com/", "UNSUPPORTED"],
    ["ERROR: [Instagram] abc: Requested content is not available, rate-limit reached or login required. Use --cookies", "LOGIN_REQUIRED"],
    ["ERROR: [TikTok] 123: Unexpected response from webpage request; please report this issue", "BLOCKED_BY_PLATFORM"],
    ["ERROR: Unable to download webpage: HTTP Error 429: Too Many Requests", "BLOCKED_BY_PLATFORM"],
    ["ERROR: Unable to download webpage: <urlopen error timed out>", "TIMEOUT"],
    ["ERROR: [twitter] 1: No video could be found in this tweet", "NOT_FOUND"],
    ["ERROR: [youtube] abc: Requested format is not available. Use --list-formats", "FORMAT_UNAVAILABLE"],
    ["ERROR: File is larger than max-filesize (3000000000 bytes > 2147483648 bytes). Aborting.", "TOO_LARGE"],
    ["ERROR: [youtube] abc: This live event will begin in 3 hours.", "UNSUPPORTED"],
    ["ERROR: something completely unexpected happened", "UNKNOWN"],
  ])("%s → %s", (stderr, code) => {
    expect(mapYtDlpError(stderr).apiError.code).toBe(code);
  });

  it("baris ERROR terakhir yang dipakai, bukan peringatan sebelumnya", () => {
    const stderr = "WARNING: [youtube] Private video player response\n[info] something\nERROR: Video unavailable";
    expect(extractErrorLine(stderr)).toBe("ERROR: Video unavailable");
    expect(mapYtDlpError(stderr).apiError.code).toBe("NOT_FOUND");
  });

  it("timeout proses & gagal spawn", () => {
    expect(mapYtDlpError("", { timedOut: true }).apiError.code).toBe("TIMEOUT");
    expect(mapYtDlpError("", { spawnError: "ENOENT" }).apiError).toMatchObject({ code: "UNKNOWN", detail: "engine" });
  });

  it("fixture error asli Instagram (empty media) → LOGIN_REQUIRED", () => {
    const stderr = readFileSync("tests/fixtures/errors/instagram-empty-media.txt", "utf8");
    expect(mapYtDlpError(stderr).apiError.code).toBe("LOGIN_REQUIRED");
  });

  it("video tanpa suara + pilih MP3 → pesan no_audio (bukan 'coba lagi')", () => {
    const err = mapYtDlpError("ERROR: Postprocessing: WARNING: unable to obtain file audio codec with ffprobe").apiError;
    expect(err).toMatchObject({ code: "FORMAT_UNAVAILABLE", detail: "no_audio", retryable: false });
    expect(err.message).toMatch(/tidak punya suara/);
  });

  it("detail live diteruskan", () => {
    expect(mapYtDlpError("ERROR: Premieres in 2 hours").apiError.detail).toBe("live");
  });
});

describe("AppError & pesan", () => {
  it("status HTTP & retryable sesuai kode", () => {
    const e = new AppError("RATE_LIMITED", { retryAfterSec: 9 });
    expect(e.status).toBe(429);
    expect(e.apiError).toMatchObject({ code: "RATE_LIMITED", retryable: true, retryAfterSec: 9 });
    expect(new AppError("PRIVATE").apiError.retryable).toBe(false);
  });

  it("detail memakai pesan spesifik", () => {
    expect(makeApiError("UNSUPPORTED", { detail: "not_video" }).message).toMatch(/profil atau playlist/);
  });

  it("template batas diisi params", () => {
    expect(makeApiError("TOO_LONG", { params: { maxMinutes: 120 } }).message).toBe("Video terlalu panjang (maks 120 menit).");
    expect(makeApiError("TOO_LARGE", { params: { maxMb: 2048 } }).message).toContain("2048 MB");
  });

  it("fillTemplate membuang kurung yang tidak terisi", () => {
    expect(fillTemplate("Video terlalu panjang (maks {maxMinutes} menit).")).toBe("Video terlalu panjang.");
    expect(fillTemplate("Halo {name}!", { name: "Rina" })).toBe("Halo Rina!");
  });
});
