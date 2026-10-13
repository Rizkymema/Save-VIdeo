import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOWNLOAD_TOKEN, decodeSignal, encodeSignal, signalCookie } from "@/lib/download-cookie";

describe("sinyal cookie mode direct", () => {
  it("bolak-balik untuk sukses dengan nama file Unicode", () => {
    const signal = { ok: true as const, fileName: "Semut 😱 ジャンプ (1080p).mp4", fileSize: 2_978_825 };
    const encoded = encodeSignal(signal);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // aman untuk nilai cookie
    expect(decodeSignal(encoded)).toEqual(signal);
  });

  it("bolak-balik untuk error beserta params", () => {
    const signal = {
      ok: false as const,
      error: { code: "TOO_LARGE" as const, message: "x", retryable: false, params: { maxMb: 250 } },
    };
    expect(decodeSignal(encodeSignal(signal))).toEqual(signal);
  });

  it("nilai rusak → null", () => {
    expect(decodeSignal("bukan-base64-json")).toBeNull();
    expect(decodeSignal("")).toBeNull();
  });

  it("header Set-Cookie: path root, singkat, bisa dibaca halaman", () => {
    const header = signalCookie("abc12345", { ok: true });
    expect(header).toMatch(/^sl_dl_abc12345=[A-Za-z0-9_-]+; Path=\/; Max-Age=120; SameSite=Lax$/);
    expect(header).not.toContain("HttpOnly");
  });

  it("format token", () => {
    expect(DOWNLOAD_TOKEN.test("a1b2c3d4e5f6a1b2c3d4e5f6")).toBe(true);
    expect(DOWNLOAD_TOKEN.test("pendek")).toBe(false);
    expect(DOWNLOAD_TOKEN.test("abc;rm -rf")).toBe(false);
  });
});

const ENV_KEYS = [
  "VERCEL",
  "DOWNLOAD_MODE",
  "YTDLP_JS_RUNTIMES",
  "YTDLP_CACHE_DIR",
  "YTDLP_PATH",
  "FFMPEG_PATH",
  "YTDLP_COOKIES_FILE",
  "YTDLP_COOKIES_BASE64",
];
let saved: Record<string, string | undefined> = {};

describe("default lingkungan", () => {
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    vi.resetModules();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("server biasa (Docker/VPS/lokal) → mode jobs, tanpa cache-dir khusus", async () => {
    const { env } = await import("@/lib/env");
    expect(env()).toMatchObject({ DOWNLOAD_MODE: "jobs", YTDLP_JS_RUNTIMES: "", YTDLP_CACHE_DIR: "" });
  });

  it("Vercel → mode direct, JS runtime = Node milik function, cache di /tmp", async () => {
    process.env.VERCEL = "1";
    const { env } = await import("@/lib/env");
    const e = env();
    expect(e.DOWNLOAD_MODE).toBe("direct");
    expect(e.YTDLP_JS_RUNTIMES).toBe(`node:${process.execPath}`);
    expect(e.YTDLP_CACHE_DIR).toMatch(/yt-dlp-cache$/);
    expect(e.DIRECT_MAX_FILESIZE_MB).toBe(250);
  });

  it("DOWNLOAD_MODE bisa dipaksa lewat env", async () => {
    process.env.VERCEL = "1";
    process.env.DOWNLOAD_MODE = "jobs";
    const { env } = await import("@/lib/env");
    expect(env().DOWNLOAD_MODE).toBe("jobs");
  });

  it("YTDLP_COOKIES_BASE64 ditulis ke file sementara & diteruskan ke --cookies", async () => {
    const cookies = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tPREF\tf6=40000000\n";
    process.env.YTDLP_COOKIES_BASE64 = Buffer.from(cookies).toString("base64");
    const { baseArgs } = await import("@/lib/ytdlp/args");
    const args = baseArgs();
    const file = args[args.indexOf("--cookies") + 1];
    expect(file).toMatch(/savelink-cookies\.txt$/);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(file, "utf8")).toBe(cookies);
  });

  it("argumen: --cache-dir & batas ukuran mode direct", async () => {
    process.env.YTDLP_CACHE_DIR = "/tmp/yt-dlp-cache";
    const { downloadArgs } = await import("@/lib/ytdlp/args");
    const joined = downloadArgs({
      url: "https://youtu.be/x",
      preset: "v720",
      item: 1,
      jobId: "id",
      outDir: "/tmp/dl",
      maxFilesizeMb: 250,
    }).join(" ");
    expect(joined).toContain("--cache-dir /tmp/yt-dlp-cache");
    expect(joined).toContain("--max-filesize 250M");
  });
});
