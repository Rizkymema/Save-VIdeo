import "server-only";
import { env } from "@/lib/env";
import { log } from "@/lib/log";

export function turnstileEnabled(): boolean {
  return Boolean(env().TURNSTILE_SECRET_KEY);
}

/** Verifikasi token Cloudflare Turnstile. Selalu lolos bila Turnstile tidak dikonfigurasi. */
export async function verifyTurnstile(token: string | null | undefined, ip: string): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown" && ip !== "global") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) log("warn", "turnstile.rejected", { codes: data["error-codes"] });
    return data.success === true;
  } catch (err) {
    log("warn", "turnstile.unreachable", { message: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
