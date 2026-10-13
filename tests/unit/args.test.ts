import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["YTDLP_JS_RUNTIMES", "FFMPEG_PATH", "YTDLP_PROXY", "YTDLP_COOKIES_FILE", "MAX_FILESIZE_MB", "TRUST_PROXY_HEADER"];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  vi.resetModules(); // env() di-cache per modul → muat ulang tiap test
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("argumen yt-dlp", () => {
  it("baseArgs: abaikan config, matikan extractor generic, teruskan JS runtime/ffmpeg/proxy", async () => {
    process.env.YTDLP_JS_RUNTIMES = "deno:/usr/local/bin/deno, node";
    process.env.FFMPEG_PATH = "/usr/bin/ffmpeg";
    process.env.YTDLP_PROXY = "http://proxy:8080";
    const { baseArgs } = await import("@/lib/ytdlp/args");
    const args = baseArgs();
    expect(args).toContain("--ignore-config");
    expect(args.join(" ")).toContain("--ies default,-generic");
    expect(args.join(" ")).toContain("--js-runtimes deno:/usr/local/bin/deno --js-runtimes node");
    expect(args.join(" ")).toContain("--ffmpeg-location /usr/bin/ffmpeg");
    expect(args.join(" ")).toContain("--proxy http://proxy:8080");
  });

  it("URL selalu setelah `--` (tidak bisa disusupi opsi)", async () => {
    const { downloadArgs, infoArgs } = await import("@/lib/ytdlp/args");
    const evil = "--exec=rm -rf /";
    for (const args of [infoArgs(evil), downloadArgs({ url: evil, preset: "v720", item: 1, jobId: "id", outDir: "/tmp/x" })]) {
      expect(args.at(-1)).toBe(evil);
      expect(args.at(-2)).toBe("--");
    }
  });

  it("preset → format sort", async () => {
    const { presetArgs } = await import("@/lib/ytdlp/args");
    expect(presetArgs("best-compatible").join(" ")).toBe("-f bv*+ba/b -S +vcodec:avc,res,+acodec:m4a --merge-output-format mp4");
    expect(presetArgs("v1080").join(" ")).toContain("-S res:1080,+vcodec:avc,+acodec:m4a");
    expect(presetArgs("v2160").join(" ")).toContain("res:2160");
    expect(presetArgs("audio-mp3").join(" ")).toContain("-x --audio-format mp3 --audio-quality 0");
    expect(presetArgs("audio-m4a").join(" ")).toContain("ba[ext=m4a]/b[acodec^=aac]");
  });

  it("downloadArgs: batas ukuran dari env, nama file = jobId, item carousel", async () => {
    process.env.MAX_FILESIZE_MB = "500";
    const { downloadArgs } = await import("@/lib/ytdlp/args");
    const args = downloadArgs({ url: "https://youtu.be/x", preset: "best-compatible", item: 3, jobId: "1234", outDir: "/tmp/dl" });
    const joined = args.join(" ");
    expect(joined).toContain("--max-filesize 500M");
    expect(joined).toContain("--playlist-items 3");
    expect(args[args.indexOf("-o") + 1]).toMatch(/[\\/]tmp[\\/]dl[\\/]1234\.%\(ext\)s$/);
    expect(joined).toContain("--print after_move:__SLDONE__%(filepath)j|SL|%(title)j");
  });
});

describe("getClientIp", () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it("x-forwarded-for: pakai entri paling kanan (dari proxy kita)", async () => {
    process.env.TRUST_PROXY_HEADER = "x-forwarded-for";
    const { getClientIp } = await import("@/lib/request-ip");
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(headers({ "x-forwarded-for": "::ffff:198.51.100.7" }))).toBe("198.51.100.7");
    expect(getClientIp(headers({}))).toBe("unknown");
  });

  it("cf-connecting-ip saat di belakang Cloudflare", async () => {
    process.env.TRUST_PROXY_HEADER = "cf-connecting-ip";
    const { getClientIp } = await import("@/lib/request-ip");
    expect(getClientIp(headers({ "cf-connecting-ip": "198.51.100.1", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.1");
  });

  it("header palsu bukan IP diabaikan", async () => {
    process.env.TRUST_PROXY_HEADER = "x-real-ip";
    const { getClientIp } = await import("@/lib/request-ip");
    expect(getClientIp(headers({ "x-real-ip": "<script>" }))).toBe("unknown");
  });
});
