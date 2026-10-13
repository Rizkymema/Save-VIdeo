import "server-only";

type Level = "info" | "warn" | "error";

/**
 * Log terstruktur (satu JSON per baris) agar mudah dibaca `docker logs` / dikirim ke log collector.
 * Jangan pernah mencatat URL lengkap user — cukup host/platform.
 */
export function log(level: Level, event: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
