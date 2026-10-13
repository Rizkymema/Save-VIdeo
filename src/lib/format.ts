/** Formatter kecil yang dipakai client & server. */

export function formatBytes(bytes: number | undefined, locale = "id"): string | undefined {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return undefined;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

export function formatDuration(totalSec: number | undefined): string | undefined {
  if (totalSec === undefined || !Number.isFinite(totalSec) || totalSec < 0) return undefined;
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Ganti `{nama}` di template dengan nilai. */
export function interpolate(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    params[key] !== undefined ? String(params[key]) : match,
  );
}
