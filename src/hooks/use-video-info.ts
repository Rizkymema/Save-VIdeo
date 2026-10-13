"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { clientError, readApiError } from "@/lib/client-errors";
import type { ApiError, VideoInfo } from "@/types/video";

export type VideoInfoState =
  | { status: "idle" }
  | { status: "loading"; url: string; item?: number; previous?: VideoInfo }
  | { status: "ready"; info: VideoInfo }
  | { status: "error"; url: string; error: ApiError };

/** POST /api/info dengan pembatalan request lama (paste beruntun / ganti item carousel). */
export function useVideoInfo() {
  const [state, setState] = useState<VideoInfoState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const lastInfoRef = useRef<VideoInfo | undefined>(undefined);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const fetchInfo = useCallback(async (url: string, item?: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading", url, item, previous: item ? lastInfoRef.current : undefined });

    try {
      const res = await fetch(apiUrl("/api/info"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item ? { url, item } : { url }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const error = await readApiError(res);
        if (!controller.signal.aborted) setState({ status: "error", url, error });
        return;
      }
      const info = (await res.json()) as VideoInfo;
      if (controller.signal.aborted) return;
      lastInfoRef.current = info;
      setState({ status: "ready", info });
    } catch {
      if (controller.signal.aborted) return;
      setState({ status: "error", url, error: clientError("UNKNOWN", "network") });
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    lastInfoRef.current = undefined;
    setState({ status: "idle" });
  }, []);

  return { state, fetchInfo, reset };
}
