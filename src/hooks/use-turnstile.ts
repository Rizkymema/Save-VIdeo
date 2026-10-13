"use client";

import { useCallback, useEffect, useRef } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (widget: string) => void;
  reset: (widget: string) => void;
  remove: (widget: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile script gagal dimuat"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile (opsional, tanpa login): aktif bila NEXT_PUBLIC_TURNSTILE_SITE_KEY diisi.
 * `getToken()` menghasilkan token baru sekali pakai untuk POST /api/jobs.
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);
  const pendingRef = useRef<((token: string | undefined) => void) | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetRef.current) return;
        widgetRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => pendingRef.current?.(token),
          "error-callback": () => pendingRef.current?.(undefined),
          "expired-callback": () => window.turnstile?.reset(widgetRef.current!),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, []);

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    await loadScript().catch(() => undefined);
    const widget = widgetRef.current;
    if (!widget || !window.turnstile) return undefined;
    return new Promise<string | undefined>((resolve) => {
      const timer = setTimeout(() => finish(undefined), 15_000);
      const finish = (token: string | undefined) => {
        clearTimeout(timer);
        pendingRef.current = null;
        resolve(token);
      };
      pendingRef.current = finish;
      window.turnstile!.reset(widget);
      window.turnstile!.execute(widget);
    });
  }, []);

  return { containerRef, getToken, enabled: Boolean(SITE_KEY) };
}
