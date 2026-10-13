import { NextResponse, type NextRequest } from "next/server";

/**
 * CORS untuk mode "hybrid": UI di Vercel (domain lain) memanggil API di server Docker ini.
 * Aktif hanya bila CORS_ORIGINS diisi, mis. "https://savelink.vercel.app,https://savelink.com".
 * Tanpa CORS_ORIGINS → perilaku sama seperti biasa (same-origin saja).
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Turnstile-Token",
  "Access-Control-Expose-Headers": "Content-Disposition, Content-Length, Retry-After",
  "Access-Control-Max-Age": "86400",
};

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const allowed = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (allowed.includes("*") || allowed.includes(origin)) return origin;
  return null;
}

export function proxy(request: NextRequest) {
  const origin = allowedOrigin(request.headers.get("origin"));

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: origin ? 204 : 403,
      headers: origin ? { ...CORS_HEADERS, "Access-Control-Allow-Origin": origin, Vary: "Origin" } : { Vary: "Origin" },
    });
  }

  const response = NextResponse.next();
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
