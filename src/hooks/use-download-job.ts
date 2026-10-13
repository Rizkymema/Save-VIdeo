"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { clientError, readApiError } from "@/lib/client-errors";
import {
  TERMINAL_STAGES,
  type ApiError,
  type CreateJobResponse,
  type JobProgress,
  type QualityOption,
} from "@/types/video";

export type DownloadJobState =
  | { status: "idle" }
  | { status: "starting"; option: QualityOption }
  | { status: "active"; option: QualityOption; jobId: string; progress: JobProgress }
  | { status: "ready"; option: QualityOption; jobId: string; progress: JobProgress }
  | { status: "error"; option: QualityOption; error: ApiError; jobId?: string }
  | { status: "canceled"; option: QualityOption };

export interface StartJobInput {
  url: string;
  item: number;
  option: QualityOption;
  turnstileToken?: string;
}

const POLL_MS = 1000;

export function fileUrl(jobId: string): string {
  return apiUrl(`/api/jobs/${jobId}/file`);
}

/**
 * Buat job download lalu ikuti progress lewat Server-Sent Events.
 * Bila SSE diblokir proxy/jaringan, otomatis pindah ke polling GET /api/jobs/:id.
 */
export function useDownloadJob(onReady?: (jobId: string, progress: JobProgress, option: QualityOption) => void) {
  const [state, setState] = useState<DownloadJobState>({ status: "idle" });
  const sourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeJobRef = useRef<string | null>(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const stopListening = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => stopListening, [stopListening]);

  const handleProgress = useCallback(
    (jobId: string, option: QualityOption, progress: JobProgress) => {
      if (activeJobRef.current !== jobId) return;
      if (progress.stage === "ready") {
        stopListening();
        setState({ status: "ready", option, jobId, progress });
        onReadyRef.current?.(jobId, progress, option);
      } else if (progress.stage === "canceled") {
        stopListening();
        setState({ status: "canceled", option });
      } else if (TERMINAL_STAGES.includes(progress.stage)) {
        stopListening();
        setState({ status: "error", option, jobId, error: progress.error ?? clientError("UNKNOWN") });
      } else {
        setState({ status: "active", option, jobId, progress });
      }
    },
    [stopListening],
  );

  const poll = useCallback(
    (jobId: string, option: QualityOption) => {
      const tick = async () => {
        if (activeJobRef.current !== jobId) return;
        try {
          const res = await fetch(apiUrl(`/api/jobs/${jobId}`), { cache: "no-store" });
          if (!res.ok) {
            const error = await readApiError(res);
            if (activeJobRef.current === jobId) {
              stopListening();
              setState({ status: "error", option, jobId, error });
            }
            return;
          }
          const progress = (await res.json()) as JobProgress;
          handleProgress(jobId, option, progress);
          if (!TERMINAL_STAGES.includes(progress.stage)) pollRef.current = setTimeout(tick, POLL_MS);
        } catch {
          pollRef.current = setTimeout(tick, POLL_MS * 2);
        }
      };
      void tick();
    },
    [handleProgress, stopListening],
  );

  const listen = useCallback(
    (jobId: string, option: QualityOption) => {
      if (typeof EventSource === "undefined") return poll(jobId, option);
      const source = new EventSource(apiUrl(`/api/jobs/${jobId}/events`));
      sourceRef.current = source;
      source.addEventListener("progress", (event) => {
        try {
          handleProgress(jobId, option, JSON.parse((event as MessageEvent<string>).data) as JobProgress);
        } catch {
          /* abaikan event rusak */
        }
      });
      source.onerror = () => {
        // CLOSED = server menolak/terputus permanen → lanjut dengan polling.
        if (source.readyState === EventSource.CLOSED && activeJobRef.current === jobId) {
          sourceRef.current = null;
          poll(jobId, option);
        }
      };
    },
    [handleProgress, poll],
  );

  const start = useCallback(
    async ({ url, item, option, turnstileToken }: StartJobInput) => {
      stopListening();
      activeJobRef.current = null;
      setState({ status: "starting", option });
      try {
        const res = await fetch(apiUrl("/api/jobs"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, item, preset: option.preset, ...(turnstileToken ? { turnstileToken } : {}) }),
        });
        if (!res.ok) {
          setState({ status: "error", option, error: await readApiError(res) });
          return;
        }
        const { jobId } = (await res.json()) as CreateJobResponse;
        activeJobRef.current = jobId;
        setState({ status: "active", option, jobId, progress: { jobId, stage: "queued", percent: 0 } });
        listen(jobId, option);
      } catch {
        setState({ status: "error", option, error: clientError("UNKNOWN", "network") });
      }
    },
    [listen, stopListening],
  );

  const cancel = useCallback(async () => {
    const jobId = activeJobRef.current;
    stopListening();
    activeJobRef.current = null;
    setState((s) => ("option" in s ? { status: "canceled", option: s.option } : { status: "idle" }));
    if (jobId) await fetch(apiUrl(`/api/jobs/${jobId}`), { method: "DELETE" }).catch(() => undefined);
  }, [stopListening]);

  const reset = useCallback(() => {
    stopListening();
    activeJobRef.current = null;
    setState({ status: "idle" });
  }, [stopListening]);

  return { state, start, cancel, reset };
}
