import "server-only";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import type { ApiErrorCode, Platform } from "@/types/video";

/**
 * Pantau rasio kegagalan per platform. Hanya error "sisi sistem" yang dihitung
 * (platform memblokir, timeout, error tak dikenal) — bukan kesalahan user seperti link privat.
 */
const SYSTEM_FAILURES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  "BLOCKED_BY_PLATFORM",
  "TIMEOUT",
  "UNKNOWN",
  "FORMAT_UNAVAILABLE",
]);

const WINDOW_MS = 30 * 60_000;
const MIN_SAMPLES = 10;
const ALERT_RATIO = 0.5;
const ALERT_COOLDOWN_MS = 60 * 60_000;

interface Sample {
  t: number;
  ok: boolean;
  code?: ApiErrorCode;
}

interface MetricsState {
  samples: Map<Platform, Sample[]>;
  lastAlert: Map<Platform, number>;
  totals: { info: number; jobs: number; failures: number };
}

const g = globalThis as unknown as { __savelinkMetrics?: MetricsState };
const state: MetricsState = (g.__savelinkMetrics ??= {
  samples: new Map<Platform, Sample[]>(),
  lastAlert: new Map<Platform, number>(),
  totals: { info: 0, jobs: 0, failures: 0 },
});

export function recordOutcome(platform: Platform, kind: "info" | "job", ok: boolean, code?: ApiErrorCode): void {
  if (kind === "info") state.totals.info++;
  else state.totals.jobs++;
  if (!ok && code && !SYSTEM_FAILURES.has(code)) return;
  if (!ok) state.totals.failures++;

  const now = Date.now();
  const list = (state.samples.get(platform) ?? []).filter((s) => s.t > now - WINDOW_MS);
  list.push({ t: now, ok, code });
  state.samples.set(platform, list);

  const failures = list.filter((s) => !s.ok).length;
  if (list.length >= MIN_SAMPLES && failures / list.length >= ALERT_RATIO) {
    const last = state.lastAlert.get(platform) ?? 0;
    if (now - last > ALERT_COOLDOWN_MS) {
      state.lastAlert.set(platform, now);
      const codes = [...new Set(list.filter((s) => !s.ok).map((s) => s.code))].join(", ");
      const text = `⚠️ SaveLink: ${failures}/${list.length} permintaan ${platform} gagal dalam 30 menit terakhir (${codes}). Cek /api/health dan update yt-dlp.`;
      log("warn", "alert.error_rate", { platform, failures, samples: list.length, codes });
      void sendAlert(text);
    }
  }
}

async function sendAlert(text: string): Promise<void> {
  const url = env().ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    // `text` untuk Slack, `content` untuk Discord.
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    log("warn", "alert.send_failed", { message: err instanceof Error ? err.message : String(err) });
  }
}

export function metricsSnapshot() {
  const now = Date.now();
  const platforms: Record<string, { samples: number; failures: number }> = {};
  for (const [platform, list] of state.samples) {
    const recent = list.filter((s) => s.t > now - WINDOW_MS);
    platforms[platform] = { samples: recent.length, failures: recent.filter((s) => !s.ok).length };
  }
  return { totals: { ...state.totals }, last30min: platforms };
}
