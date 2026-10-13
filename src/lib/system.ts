import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { env } from "@/lib/env";

export function runCommand(cmd: string, args: string[], timeoutMs = 15_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

const execCache = new Map<string, string>();

/**
 * Path binary yang pasti bisa dieksekusi. Di bundel serverless (Vercel) izin eksekusi bisa hilang,
 * jadi binary disalin ke /tmp lalu di-chmod. Nama perintah biasa (mis. "yt-dlp") dicari di PATH.
 */
export function executablePath(binary: string): string {
  if (!binary || !/[\\/]/.test(binary)) return binary;
  const cached = execCache.get(binary);
  if (cached) return cached;
  let result = binary;
  if (process.platform !== "win32") {
    try {
      fs.accessSync(binary, fs.constants.X_OK);
    } catch {
      try {
        const dir = path.join(os.tmpdir(), "savelink-bin");
        fs.mkdirSync(dir, { recursive: true });
        const dest = path.join(dir, path.basename(binary));
        if (!fs.existsSync(dest)) fs.copyFileSync(binary, dest);
        fs.chmodSync(dest, 0o755);
        result = dest;
      } catch {
        /* biarkan path asli; error akan muncul saat dijalankan */
      }
    }
  }
  execCache.set(binary, result);
  return result;
}

/** `--ffmpeg-location` / `--js-runtimes` boleh berupa folder; ubah jadi path binary. */
function resolveBinary(location: string, name: string): string {
  if (!location) return name;
  try {
    if (fs.statSync(location).isDirectory()) return path.join(location, name);
  } catch {
    /* bukan path lokal — biarkan apa adanya (dicari di PATH) */
  }
  return location;
}

export function ffmpegBinary(): string {
  return executablePath(resolveBinary(env().FFMPEG_PATH, "ffmpeg"));
}

/** JS runtime yang dipakai yt-dlp untuk tantangan YouTube: Deno (default) atau Node (Vercel). */
function jsRuntime(): { name: "deno" | "node"; location: string } {
  const entries = env()
    .YTDLP_JS_RUNTIMES.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const node = entries.find((s) => s === "node" || s.startsWith("node:"));
  if (node && !entries.some((s) => s.startsWith("deno"))) return { name: "node", location: node.slice(5) };
  const deno = entries.find((s) => s === "deno" || s.startsWith("deno:"));
  return { name: "deno", location: deno && deno.startsWith("deno:") ? deno.slice(5) : "" };
}

export interface ToolVersions {
  ytdlp?: string;
  ffmpeg?: string;
  /** Mis. "deno 2.9.7" atau "node 24.1.0". */
  jsRuntime?: string;
}

let versionCache: { at: number; value: ToolVersions } | null = null;

export function invalidateVersionCache(): void {
  versionCache = null;
}

export async function toolVersions(): Promise<ToolVersions> {
  if (versionCache && Date.now() - versionCache.at < 5 * 60_000) return versionCache.value;
  const runtime = jsRuntime();
  const [ytdlp, ffmpeg, deno] = await Promise.all([
    runCommand(executablePath(env().YTDLP_PATH), ["--version"], 30_000),
    runCommand(ffmpegBinary(), ["-version"]),
    runtime.name === "deno" ? runCommand(resolveBinary(runtime.location, "deno"), ["--version"]) : Promise.resolve(null),
  ]);
  const value: ToolVersions = {};
  if (ytdlp.ok) value.ytdlp = ytdlp.stdout.trim().split(/\s+/)[0];
  if (ffmpeg.ok) value.ffmpeg = ffmpeg.stdout.match(/ffmpeg version (\S+)/)?.[1] ?? "unknown";
  if (runtime.name === "node") value.jsRuntime = `node ${process.versions.node}`;
  else if (deno?.ok) value.jsRuntime = `deno ${deno.stdout.match(/deno (\S+)/)?.[1] ?? "?"}`;
  versionCache = { at: Date.now(), value };
  return value;
}
