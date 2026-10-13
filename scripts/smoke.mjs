// Smoke test NYATA ke platform: /api/info → /api/jobs → SSE progress → unduh file → cek ffprobe.
// Pakai (server harus jalan):  npm run smoke -- <url> [preset] [baseUrl]
//   contoh: npm run smoke -- https://youtu.be/jNQXAC9IVRw best-compatible
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const [url, preset = "best-compatible", base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000"] = process.argv.slice(2);
if (!url) {
  console.error("Pakai: npm run smoke -- <url-video> [preset] [baseUrl]");
  process.exit(2);
}

const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

async function post(pathname, body) {
  const res = await fetch(base + pathname, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(`${pathname} → ${res.status} ${data?.error?.code ?? ""}: ${data?.error?.message ?? ""}`);
  return data;
}

// 1) Info
const info = await post("/api/info", { url });
console.log(`✓ info (${secs()}): [${info.platform}] ${info.title}`);
for (const o of info.options) {
  const size = o.approxBytes ? `≈ ${(o.approxBytes / 1048576).toFixed(1)} MB` : "";
  console.log(`   - ${o.preset.padEnd(15)} ${o.label.padEnd(6)} ${o.codec ?? ""} ${o.fps ? `${o.fps}fps` : ""} ${size}${o.recommended ? "  ★" : ""}`);
}
if (!info.options.some((o) => o.preset === preset)) fail(`preset "${preset}" tidak tersedia untuk video ini`);

// 2) Job
const { jobId } = await post("/api/jobs", { url, preset });
console.log(`✓ job ${jobId}`);

// 3) Ikuti SSE sampai selesai
const res = await fetch(`${base}/api/jobs/${jobId}/events`);
if (!res.ok || !res.body) fail(`SSE gagal: ${res.status}`);
const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
let buffer = "";
let final;
let lastStage = "";
while (!final) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += value;
  const chunks = buffer.split("\n\n");
  buffer = chunks.pop() ?? "";
  for (const chunk of chunks) {
    const data = chunk.split("\n").find((l) => l.startsWith("data: "));
    if (!data) continue;
    const p = JSON.parse(data.slice(6));
    const label = `${p.stage}${p.step ? `/${p.step}` : ""}`;
    if (label !== lastStage || ["ready", "error", "canceled", "expired"].includes(p.stage)) {
      console.log(`   ${secs().padStart(6)}  ${label.padEnd(20)} ${p.percent ?? 0}%`);
      lastStage = label;
    }
    if (["ready", "error", "canceled", "expired"].includes(p.stage)) final = p;
  }
}
await reader.cancel().catch(() => {});
if (!final) fail("SSE berakhir tanpa status akhir");
if (final.stage !== "ready") fail(`job berakhir ${final.stage}: ${final.error?.code} ${final.error?.message ?? ""}`);

// 4) Unduh file
const fileRes = await fetch(`${base}/api/jobs/${jobId}/file`);
if (!fileRes.ok) fail(`unduh file gagal: ${fileRes.status}`);
const buf = Buffer.from(await fileRes.arrayBuffer());
const outDir = path.join(os.tmpdir(), "savelink-smoke");
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, final.fileName ?? `${jobId}.bin`);
await writeFile(outFile, buf);
console.log(`✓ file (${secs()}): ${outFile} — ${(buf.length / 1048576).toFixed(2)} MB`);
console.log(`  Content-Disposition: ${fileRes.headers.get("content-disposition")}`);

// 5) Verifikasi isi file dengan ffprobe (bila ada)
execFile(
  "ffprobe",
  ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,avg_frame_rate:format=duration", "-of", "compact", outFile],
  { windowsHide: true },
  (err, stdout) => {
    if (err) {
      console.log("  (ffprobe tidak tersedia — lewati verifikasi codec)");
      return;
    }
    console.log(stdout.trim().split(/\r?\n/).map((l) => `  ${l}`).join("\n"));
    console.log(`✓ selesai dalam ${secs()}`);
  },
);
