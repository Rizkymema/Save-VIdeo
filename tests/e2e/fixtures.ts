import type { Page, Route } from "@playwright/test";
import type { ApiError, JobProgress, VideoInfo } from "../../src/types/video";

export const YT_URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
export const JOB_ID = "11111111-2222-4333-8444-555555555555";

export const VIDEO_INFO: VideoInfo = {
  sourceUrl: YT_URL,
  platform: "youtube",
  title: "Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film",
  uploader: "Blender",
  durationSec: 635,
  orientation: "landscape",
  item: 1,
  options: [
    { preset: "best-compatible", kind: "video", label: "1080p", ext: "mp4", height: 1080, fps: 60, codec: "h264", approxBytes: 257_619_653, needsMerge: true, recommended: true },
    { preset: "v2160", kind: "video", label: "4K", ext: "mp4", height: 2160, fps: 60, codec: "vp9", approxBytes: 1_362_269_481, needsMerge: true },
    { preset: "v1440", kind: "video", label: "1440p", ext: "mp4", height: 1440, fps: 60, codec: "vp9", approxBytes: 473_363_704, needsMerge: true },
    { preset: "v720", kind: "video", label: "720p", ext: "mp4", height: 720, fps: 60, codec: "h264", approxBytes: 150_524_867, needsMerge: true },
    { preset: "v480", kind: "video", label: "480p", ext: "mp4", height: 480, fps: 30, codec: "h264", approxBytes: 28_207_144, needsMerge: true },
    { preset: "audio-m4a", kind: "audio", label: "M4A", ext: "m4a", approxBytes: 10_271_496 },
    { preset: "audio-mp3", kind: "audio", label: "MP3", ext: "mp3", approxBytes: 19_446_875 },
  ],
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Mock /api/info: kembalikan VIDEO_INFO (atau error) setelah jeda kecil agar skeleton terlihat. */
export async function mockInfo(page: Page, opts: { error?: ApiError; status?: number; delayMs?: number } = {}) {
  await page.route("**/api/info", async (route) => {
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 250));
    if (opts.error) return json(route, { error: opts.error }, opts.status ?? 400);
    return json(route, VIDEO_INFO);
  });
}

function sse(events: JobProgress[], keepOpen: boolean) {
  // retry besar → EventSource tidak langsung reconnect saat body mock selesai.
  return `retry: ${keepOpen ? 600000 : 3000}\n\n` + events.map((e) => `event: progress\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

/** Mock alur download: POST /api/jobs → SSE progress → file. */
export async function mockJob(page: Page, opts: { finish?: boolean; failWith?: ApiError } = {}) {
  await page.route("**/api/jobs", (route) => json(route, { jobId: JOB_ID }, 202));
  const events: JobProgress[] = [
    { jobId: JOB_ID, stage: "downloading", percent: 41.5, step: "video", downloadedBytes: 104_857_600, totalBytes: 247_463_936, speedBps: 6_291_456, etaSec: 23 },
  ];
  if (opts.failWith) events.push({ jobId: JOB_ID, stage: "error", percent: 41.5, error: opts.failWith });
  else if (opts.finish) {
    events.push({ jobId: JOB_ID, stage: "merging", percent: 95 });
    events.push({ jobId: JOB_ID, stage: "ready", percent: 100, fileName: "Big Buck Bunny 60fps 4K (1080p).mp4", fileSize: 257_619_653 });
  }
  const keepOpen = !opts.finish && !opts.failWith;
  await page.route(`**/api/jobs/${JOB_ID}/events`, (route) =>
    route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body: sse(events, keepOpen) }),
  );
  await page.route(`**/api/jobs/${JOB_ID}/file`, (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="Big Buck Bunny 60fps 4K (1080p).mp4"`,
      },
      body: "fake-mp4-bytes",
    }),
  );
  await page.route(`**/api/jobs/${JOB_ID}`, (route) =>
    route.request().method() === "DELETE"
      ? json(route, { jobId: JOB_ID, stage: "canceled", percent: 41.5 })
      : json(route, events.at(-1)),
  );
}

export async function submitUrl(page: Page, url = YT_URL) {
  const input = page.getByLabel(/Link video|Video link/);
  await input.fill(url);
  await input.press("Enter");
}
