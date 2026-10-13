import "server-only";
import { env } from "@/lib/env";
import { jobsState } from "@/lib/jobs/store";
import { log } from "@/lib/log";
import { invalidateVersionCache, runCommand } from "@/lib/system";

const DAY_MS = 24 * 60 * 60_000;
const RETRY_WHEN_BUSY_MS = 10 * 60_000;

const g = globalThis as unknown as { __savelinkUpdater?: { timer?: ReturnType<typeof setTimeout>; last?: { at: number; ok: boolean; output: string } } };
const state = (g.__savelinkUpdater ??= {});

/**
 * Platform sering berubah, yt-dlp harus selalu terbaru. Bila YTDLP_AUTO_UPDATE=true,
 * jalankan `yt-dlp -U` saat start lalu tiap 24 jam (hanya ketika tidak ada download berjalan).
 */
export function startAutoUpdate(): void {
  if (!env().YTDLP_AUTO_UPDATE || state.timer) return;
  const schedule = (ms: number) => {
    state.timer = setTimeout(run, ms);
    state.timer.unref?.();
  };
  const run = async () => {
    if (jobsState().running.size > 0) return schedule(RETRY_WHEN_BUSY_MS);
    const result = await runCommand(env().YTDLP_PATH, ["-U"], 180_000);
    const output = (result.stdout + result.stderr).trim().split(/\r?\n/).slice(-3).join(" | ");
    state.last = { at: Date.now(), ok: result.ok, output };
    invalidateVersionCache();
    log(result.ok ? "info" : "warn", "ytdlp.update", { ok: result.ok, output });
    schedule(DAY_MS);
  };
  schedule(5_000);
}

export function lastUpdate() {
  return state.last;
}
