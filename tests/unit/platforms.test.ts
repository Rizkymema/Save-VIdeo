import { describe, expect, it } from "vitest";
import { detectPlatform, extractUrl, normalizeVideoUrl, validateVideoUrl } from "@/lib/platforms";

describe("extractUrl", () => {
  it("mengambil URL dari teks bagikan aplikasi", () => {
    expect(extractUrl("Lihat video ini! https://vt.tiktok.com/ZSabc123/ keren")).toBe("https://vt.tiktok.com/ZSabc123/");
    expect(extractUrl("Check this out: https://youtu.be/jNQXAC9IVRw?si=xyz.")).toBe("https://youtu.be/jNQXAC9IVRw?si=xyz");
    expect(extractUrl("(https://www.instagram.com/reel/Chunk8-jurw/)")).toBe("https://www.instagram.com/reel/Chunk8-jurw/");
  });

  it("mengenali domain tanpa https://", () => {
    expect(extractUrl("youtube.com/watch?v=abc")).toBe("youtube.com/watch?v=abc");
    expect(extractUrl("vm.tiktok.com/ZMabc/")).toBe("vm.tiktok.com/ZMabc/");
  });

  it("null untuk teks tanpa URL", () => {
    expect(extractUrl("")).toBeNull();
    expect(extractUrl("halo apa kabar")).toBeNull();
  });
});

describe("detectPlatform", () => {
  it.each([
    ["https://www.youtube.com/watch?v=jNQXAC9IVRw", "youtube"],
    ["https://youtu.be/jNQXAC9IVRw", "youtube"],
    ["https://m.youtube.com/shorts/YC7pwvv6t78", "youtube"],
    ["https://music.youtube.com/watch?v=abc", "youtube"],
    ["https://www.tiktok.com/@nba/video/7508215170003488031", "tiktok"],
    ["https://vt.tiktok.com/ZSabc/", "tiktok"],
    ["https://www.instagram.com/reel/Chunk8-jurw/", "instagram"],
    ["https://fb.watch/abc123/", "facebook"],
    ["https://web.facebook.com/watch?v=1", "facebook"],
    ["https://x.com/NASA/status/1491475671058681863", "twitter"],
    ["https://twitter.com/NASA/status/1", "twitter"],
    ["https://vimeo.com/76979871", "other"],
    ["notyoutube.com/watch", "other"],
  ])("%s → %s", (url, platform) => {
    expect(detectPlatform(url)).toBe(platform);
  });
});

describe("validateVideoUrl", () => {
  it.each([
    "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    "https://youtu.be/jNQXAC9IVRw",
    "https://www.youtube.com/shorts/YC7pwvv6t78",
    "https://www.youtube.com/live/abc123",
    "https://www.tiktok.com/@nba/video/7508215170003488031",
    "https://vm.tiktok.com/ZMabc123/",
    "https://www.tiktok.com/t/ZTabc/",
    "https://www.instagram.com/reel/Chunk8-jurw/",
    "https://www.instagram.com/p/BQ0eAlwhDrw/",
    "https://www.facebook.com/NASATechnology/videos/capstone-mission/762326434486859/",
    "https://fb.watch/abc123/",
    "https://x.com/NASA/status/1491475671058681863",
    "https://vimeo.com/76979871",
    "Lihat ini https://youtu.be/jNQXAC9IVRw?si=abc keren",
    "youtube.com/watch?v=jNQXAC9IVRw",
  ])("menerima %s", (url) => {
    const r = validateVideoUrl(url);
    expect(r.ok).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["halo", "invalid"],
    ["http://127.0.0.1/admin", "private"],
    ["http://10.0.0.5/video", "private"],
    ["http://[::1]/video", "private"],
    ["https://localhost/video", "private"],
    ["https://router.local/video", "private"],
    ["https://nas.internal/video", "private"],
    ["file:///etc/passwd", "protocol"],
    ["ftp://example.com/video.mp4", "protocol"],
    ["javascript:alert(1)", "protocol"],
    ["https://user:pass@youtube.com/watch?v=1", "credentials"],
    ["https://youtube.com:8080/watch?v=1", "port"],
    ["https://www.youtube.com/@MrBeast", "not_video"],
    ["https://www.youtube.com/playlist?list=PL123", "not_video"],
    ["https://www.youtube.com/channel/UC123", "not_video"],
    ["https://www.tiktok.com/@nba", "not_video"],
    ["https://www.instagram.com/natgeo/", "not_video"],
    ["https://x.com/NASA", "not_video"],
    ["https://example.com/", "not_video"],
    [`https://youtube.com/watch?v=${"a".repeat(3000)}`, "too_long"],
  ])("menolak %s (%s)", (url, reason) => {
    const r = validateVideoUrl(url);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  });
});

describe("normalizeVideoUrl", () => {
  it("membuang parameter pelacak & hash, mempertahankan id video", () => {
    const url = new URL("https://WWW.YouTube.com/watch?v=jNQXAC9IVRw&si=abc&utm_source=wa&feature=share#t=10");
    expect(normalizeVideoUrl(url)).toBe("https://www.youtube.com/watch?v=jNQXAC9IVRw");
    expect(normalizeVideoUrl(new URL("https://www.instagram.com/reel/X/?igsh=abc"))).toBe("https://www.instagram.com/reel/X/");
  });
});
