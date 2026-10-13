import { describe, expect, it } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { id } from "@/i18n/dictionaries/id";
import { localePath, switchLocalePath } from "@/i18n/config";
import { TtlCache } from "@/lib/cache";
import { clientError, errorMessage } from "@/lib/client-errors";
import { contentDisposition, contentTypeForExt, safeFileBase } from "@/lib/filename";
import { formatBytes, formatDuration, interpolate } from "@/lib/format";
import { parseRange } from "@/lib/http";
import { isPrivateAddress } from "@/lib/net";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { isOptimizableThumbnail } from "@/lib/thumbnail-hosts";

describe("safeFileBase", () => {
  it("membuang karakter ilegal Windows & kontrol", () => {
    expect(safeFileBase('Video: "Lucu" <1/2>?*|')).toBe("Video Lucu 1 2");
    expect(safeFileBase("a\u0000b\nc")).toBe("abc");
  });

  it("emoji & huruf non-Latin dipertahankan", () => {
    expect(safeFileBase("Semut 😱 ジャンプ")).toBe("Semut 😱 ジャンプ");
  });

  it("panjang dibatasi tanpa memotong emoji di tengah", () => {
    const base = safeFileBase("😀".repeat(200), 10);
    expect(Array.from(base)).toHaveLength(10);
  });

  it("nama kosong / terlarang → video", () => {
    expect(safeFileBase("   ...  ")).toBe("video");
    expect(safeFileBase("CON")).toBe("video");
  });
});

describe("contentDisposition", () => {
  it("ASCII fallback + filename* UTF-8", () => {
    const header = contentDisposition("Semut 😱 (1080p).mp4");
    expect(header).toContain('filename="Semut _ (1080p).mp4"');
    expect(header).toContain("filename*=UTF-8''Semut%20%F0%9F%98%B1%20%281080p%29.mp4");
  });

  it("tanda kutip di nama tidak merusak header", () => {
    expect(contentDisposition('a"b.mp4')).toContain('filename="a_b.mp4"');
  });

  it("content-type per ekstensi", () => {
    expect(contentTypeForExt("mp4")).toBe("video/mp4");
    expect(contentTypeForExt("MP3")).toBe("audio/mpeg");
    expect(contentTypeForExt("m4a")).toBe("audio/mp4");
    expect(contentTypeForExt("xyz")).toBe("application/octet-stream");
  });
});

describe("parseRange", () => {
  it.each([
    [null, 1000, null],
    ["bytes=0-99", 1000, { start: 0, end: 99 }],
    ["bytes=500-", 1000, { start: 500, end: 999 }],
    ["bytes=-100", 1000, { start: 900, end: 999 }],
    ["bytes=0-5000", 1000, { start: 0, end: 999 }],
    ["bytes=1000-", 1000, "invalid"],
    ["bytes=50-10", 1000, "invalid"],
    ["items=0-1", 1000, "invalid"],
    ["bytes=0-1,5-6", 1000, null],
  ])("%s (size %i) → %j", (header, size, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });
});

describe("SlidingWindowLimiter", () => {
  it("membatasi per key dan membuka lagi setelah jendela lewat", () => {
    const limiter = new SlidingWindowLimiter(2, 60_000);
    expect(limiter.hit("a", 0).ok).toBe(true);
    expect(limiter.hit("a", 1000).ok).toBe(true);
    const blocked = limiter.hit("a", 2000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(58);
    expect(limiter.hit("b", 2000).ok).toBe(true);
    expect(limiter.hit("a", 60_001).ok).toBe(true);
  });
});

describe("TtlCache", () => {
  it("LRU + kedaluwarsa", async () => {
    const cache = new TtlCache<number>(2, 20);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(cache.get("a")).toBeUndefined();
  });
});

describe("isPrivateAddress (anti-SSRF)", () => {
  it.each([
    ["127.0.0.1", true],
    ["10.1.2.3", true],
    ["172.20.0.1", true],
    ["192.168.1.39", true],
    ["169.254.169.254", true],
    ["100.64.1.1", true],
    ["0.0.0.0", true],
    ["::1", true],
    ["fd00::1", true],
    ["fe80::1", true],
    ["::ffff:127.0.0.1", true],
    ["142.250.4.100", false],
    ["2606:4700:4700::1111", false],
    ["bukan-ip", true],
  ])("%s → %s", (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });
});

describe("format", () => {
  it("formatBytes", () => {
    expect(formatBytes(undefined)).toBeUndefined();
    expect(formatBytes(512, "en")).toBe("512 B");
    expect(formatBytes(1536, "en")).toBe("1.5 KB");
    expect(formatBytes(257_619_653, "en")).toBe("246 MB");
    expect(formatBytes(1_362_269_481, "id")).toBe("1,3 GB");
  });

  it("formatDuration", () => {
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(635)).toBe("10:35");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("interpolate membiarkan placeholder tanpa nilai", () => {
    expect(interpolate("{a} & {b}", { a: 1 })).toBe("1 & {b}");
  });
});

describe("i18n", () => {
  it("path per bahasa", () => {
    expect(localePath("id", "/tiktok")).toBe("/tiktok");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/tiktok")).toBe("/en/tiktok");
    expect(switchLocalePath("/en/tiktok", "id")).toBe("/tiktok");
    expect(switchLocalePath("/", "en")).toBe("/en");
  });

  it("kamus EN punya semua kunci error yang sama dengan ID", () => {
    expect(Object.keys(en.errors.codes).sort()).toEqual(Object.keys(id.errors.codes).sort());
    expect(Object.keys(en.errors.details).sort()).toEqual(Object.keys(id.errors.details).sort());
  });

  it("pesan error di client mengikuti bahasa UI", () => {
    const error = { ...clientError("TOO_LONG"), params: { maxMinutes: 120 } };
    expect(errorMessage(error, id)).toBe("Video terlalu panjang (maks 120 menit).");
    expect(errorMessage(error, en)).toBe("This video is too long (max 120 minutes).");
    expect(errorMessage(clientError("UNKNOWN", "network"), en)).toMatch(/Connection lost/);
  });
});

describe("thumbnail hosts", () => {
  it.each([
    ["https://i.ytimg.com/vi/x/hq.jpg", true],
    ["https://p16-common-sign.tiktokcdn.com/a.jpg", true],
    ["https://scontent.fcgk33-1.fna.fbcdn.net/a.jpg", true],
    ["https://instagram.fcgk33-1.fna.fbcdn.net/a.jpg", true],
    ["https://pbs.twimg.com/a.jpg", true],
    ["http://i.ytimg.com/a.jpg", false],
    ["https://evil-ytimg.com/a.jpg", false],
    ["https://example.com/a.jpg", false],
  ])("%s → %s", (src, expected) => {
    expect(isOptimizableThumbnail(src)).toBe(expected);
  });
});
