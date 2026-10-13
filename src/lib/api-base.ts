/**
 * Alamat API. Kosong = same-origin (UI & API di server yang sama, mis. Docker/VPS).
 * Isi NEXT_PUBLIC_API_BASE (mis. "https://api.savelink.com") saat UI di-deploy di Vercel
 * dan mesin download berjalan di server Docker terpisah. Di-inline saat build.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim().replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
