import type { ApiError } from "@/types/video";

/**
 * Mode "direct" (serverless): browser mengunduh lewat navigasi biasa ke /api/download, jadi
 * halaman tidak bisa membaca response-nya. Server memberi kabar lewat cookie singkat
 * `sl_dl_<token>` — "berhasil (nama file)" atau "gagal (ApiError)" — yang dipantau halaman.
 */
export const DOWNLOAD_COOKIE_PREFIX = "sl_dl_";
export const DOWNLOAD_TOKEN = /^[a-z0-9]{8,32}$/i;

export type DownloadSignal =
  | { ok: true; fileName?: string; fileSize?: number }
  | { ok: false; error: ApiError };

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "===".slice((b64.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeSignal(signal: DownloadSignal): string {
  return toBase64Url(JSON.stringify(signal));
}

export function decodeSignal(value: string): DownloadSignal | null {
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as DownloadSignal;
    if (parsed && typeof parsed.ok === "boolean") return parsed;
  } catch {
    /* nilai rusak */
  }
  return null;
}

/** Header Set-Cookie (bukan HttpOnly: memang harus dibaca halaman; isinya tidak rahasia). */
export function signalCookie(token: string, signal: DownloadSignal): string {
  return `${DOWNLOAD_COOKIE_PREFIX}${token}=${encodeSignal(signal)}; Path=/; Max-Age=120; SameSite=Lax`;
}
