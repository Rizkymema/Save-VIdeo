import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";

export function runCommand(cmd: string, args: string[], timeoutMs = 15_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
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
  return resolveBinary(env().FFMPEG_PATH, "ffmpeg");
}

export function denoBinary(): string {
  const entry = env()
    .YTDLP_JS_RUNTIMES.split(",")
    .map((s) => s.trim())
    .find((s) => s === "deno" || s.startsWith("deno:"));
  const location = entry && entry.startsWith("deno:") ? entry.slice(5) : "";
  return resolveBinary(location, "deno");
}

export interface ToolVersions {
  ytdlp?: string;
  ffmpeg?: string;
  deno?: string;
}

let versionCache: { at: number; value: ToolVersions } | null = null;

export function invalidateVersionCache(): void {
  versionCache = null;
}

export async function toolVersions(): Promise<ToolVersions> {
  if (versionCache && Date.now() - versionCache.at < 5 * 60_000) return versionCache.value;
  const [ytdlp, ffmpeg, deno] = await Promise.all([
    runCommand(env().YTDLP_PATH, ["--version"]),
    runCommand(ffmpegBinary(), ["-version"]),
    runCommand(denoBinary(), ["--version"]),
  ]);
  const value: ToolVersions = {};
  if (ytdlp.ok) value.ytdlp = ytdlp.stdout.trim().split(/\s+/)[0];
  if (ffmpeg.ok) value.ffmpeg = ffmpeg.stdout.match(/ffmpeg version (\S+)/)?.[1] ?? "unknown";
  if (deno.ok) value.deno = deno.stdout.match(/deno (\S+)/)?.[1] ?? "unknown";
  versionCache = { at: Date.now(), value };
  return value;
}
