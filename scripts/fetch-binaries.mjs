// Unduh binary Linux (yt-dlp resmi + ffmpeg statis) ke vendor/bin saat build di Vercel.
// Di komputer lokal/Docker script ini dilewati (tool sudah terpasang di sistem).
// Paksa jalan dengan FETCH_BINARIES=1 (mis. untuk menguji build serverless di Linux).
import { createWriteStream } from "node:fs";
import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

const shouldRun = process.env.VERCEL === "1" || process.env.FETCH_BINARIES === "1";
if (!shouldRun) {
  console.log("[binaries] dilewati (bukan build Vercel)");
  process.exit(0);
}
if (process.platform !== "linux" || process.arch !== "x64") {
  console.warn(`[binaries] platform ${process.platform}-${process.arch} tidak didukung, dilewati`);
  process.exit(0);
}

const YTDLP_VERSION = process.env.YTDLP_VERSION || "latest";
const FFMPEG_TAG = process.env.FFMPEG_STATIC_TAG || "b6.1.1";
const ytdlpUrl =
  YTDLP_VERSION === "latest"
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux"
    : `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux`;
const ffmpegUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_TAG}/ffmpeg-linux-x64.gz`;

const dir = path.join(process.cwd(), "vendor", "bin");
await mkdir(dir, { recursive: true });

async function download(url, dest, { gunzip = false } = {}) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`gagal mengunduh ${url}: HTTP ${res.status}`);
  const body = Readable.fromWeb(res.body);
  if (gunzip) await pipeline(body, createGunzip(), createWriteStream(dest));
  else await pipeline(body, createWriteStream(dest));
  await chmod(dest, 0o755);
  const { size } = await stat(dest);
  console.log(`[binaries] ${path.basename(dest)}: ${(size / 1048576).toFixed(1)} MB`);
}

await Promise.all([
  download(ytdlpUrl, path.join(dir, "yt-dlp")),
  download(ffmpegUrl, path.join(dir, "ffmpeg"), { gunzip: true }),
]);
await writeFile(
  path.join(dir, "VERSIONS.json"),
  JSON.stringify({ ytdlp: YTDLP_VERSION, ffmpeg: FFMPEG_TAG, fetchedAt: new Date().toISOString() }, null, 2),
);
console.log("[binaries] siap di vendor/bin");
