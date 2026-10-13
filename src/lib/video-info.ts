import "server-only";
import { TtlCache } from "@/lib/cache";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { recordOutcome } from "@/lib/metrics";
import { infoArgs } from "@/lib/ytdlp/args";
import { extractErrorLine, mapYtDlpError } from "@/lib/ytdlp/errors";
import { parseInfo, type RawInfo } from "@/lib/ytdlp/parse-formats";
import { runYtDlp } from "@/lib/ytdlp/runner";
import type { Platform, VideoInfo } from "@/types/video";

export function limitParams() {
  const e = env();
  return { maxMinutes: Math.round(e.MAX_DURATION_SEC / 60), maxMb: e.MAX_FILESIZE_MB };
}

interface InfoState {
  cache: TtlCache<VideoInfo[]>;
  inflight: Map<string, Promise<VideoInfo[]>>;
}

const g = globalThis as unknown as { __savelinkInfo?: InfoState };

function state(): InfoState {
  g.__savelinkInfo ??= {
    cache: new TtlCache<VideoInfo[]>(300, env().INFO_CACHE_MINUTES * 60_000),
    inflight: new Map(),
  };
  return g.__savelinkInfo;
}

/**
 * Metadata + opsi kualitas untuk satu video. Hasil di-cache per URL (10 menit) dan
 * permintaan paralel untuk URL yang sama digabung jadi satu proses yt-dlp.
 */
export async function getVideoInfo(url: string, platform: Platform, item = 1): Promise<VideoInfo> {
  const entries = await getEntries(url, platform);
  const info = entries.find((e) => e.item === item);
  if (!info) throw new AppError("NOT_FOUND");
  const { MAX_DURATION_SEC } = env();
  if (info.durationSec && info.durationSec > MAX_DURATION_SEC) {
    throw new AppError("TOO_LONG", { params: limitParams() });
  }
  return info;
}

/** Info dari cache saja (tanpa memanggil yt-dlp). */
export function peekVideoInfo(url: string, item = 1): VideoInfo | undefined {
  return state().cache.get(url)?.find((e) => e.item === item);
}

function getEntries(url: string, platform: Platform): Promise<VideoInfo[]> {
  const { cache, inflight } = state();
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(url);
  if (pending) return pending;
  const promise = fetchEntries(url, platform).finally(() => inflight.delete(url));
  inflight.set(url, promise);
  return promise;
}

async function fetchEntries(url: string, platform: Platform): Promise<VideoInfo[]> {
  const started = Date.now();
  const host = new URL(url).hostname;
  const { done } = runYtDlp(infoArgs(url), {
    timeoutMs: env().INFO_TIMEOUT_SEC * 1000,
    maxStdoutBytes: 48 * 1024 * 1024,
  });
  const result = await done;

  if (result.code !== 0) {
    const err = mapYtDlpError(result.stderr, result);
    log("warn", "info.failed", {
      platform,
      host,
      code: err.apiError.code,
      ms: Date.now() - started,
      reason: result.spawnError ?? extractErrorLine(result.stderr),
    });
    recordOutcome(platform, "info", false, err.apiError.code);
    throw err;
  }

  let raw: RawInfo;
  try {
    raw = JSON.parse(result.stdout) as RawInfo;
  } catch {
    log("error", "info.bad_json", { platform, host, bytes: result.stdout.length });
    recordOutcome(platform, "info", false, "UNKNOWN");
    throw new AppError("UNKNOWN");
  }

  try {
    const entries = parseInfo(raw, url, platform);
    state().cache.set(url, entries);
    log("info", "info.ok", { platform, host, ms: Date.now() - started, items: entries.length });
    recordOutcome(platform, "info", true);
    return entries;
  } catch (err) {
    if (err instanceof AppError) recordOutcome(platform, "info", false, err.apiError.code);
    throw err;
  }
}
