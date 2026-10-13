import "server-only";
import { AppError, isAppError, makeApiError } from "@/lib/errors";
import { log } from "@/lib/log";
import type { ApiError } from "@/types/video";

const NO_STORE = { "Cache-Control": "no-store" };

export function jsonError(error: ApiError, status: number, headers: Record<string, string> = {}): Response {
  const extra: Record<string, string> = { ...NO_STORE, ...headers };
  if (error.retryAfterSec) extra["Retry-After"] = String(error.retryAfterSec);
  return Response.json({ error }, { status, headers: extra });
}

/** Ubah error apa pun menjadi response JSON yang aman (tanpa stack trace ke user). */
export function errorResponse(err: unknown, context: Record<string, unknown> = {}): Response {
  if (isAppError(err)) return jsonError(err.apiError, err.status);
  log("error", "api.unhandled", { ...context, message: err instanceof Error ? err.message : String(err) });
  return jsonError(makeApiError("UNKNOWN"), 500);
}

export function json<T>(data: T, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return Response.json(data, { status: init.status ?? 200, headers: { ...NO_STORE, ...init.headers } });
}

export async function readJsonBody(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new AppError("INVALID_URL");
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("INVALID_URL");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("INVALID_URL");
  }
}

export type ByteRange = { start: number; end: number };

/** Parse header Range satu-rentang. null = kirim file utuh; "invalid" = 416. */
export function parseRange(header: string | null, size: number): ByteRange | "invalid" | null {
  if (!header) return null;
  const m = header.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!m) return header.includes(",") ? null : "invalid";
  const [, rawStart, rawEnd] = m;
  if (!rawStart && !rawEnd) return "invalid";
  let start: number;
  let end: number;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!suffix) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return "invalid";
  return { start, end };
}
