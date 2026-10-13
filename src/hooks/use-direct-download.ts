"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DownloadJobState, StartJobInput } from "@/hooks/use-download-job";
import { apiUrl } from "@/lib/api-base";
import { clientError } from "@/lib/client-errors";
import { DOWNLOAD_COOKIE_PREFIX, decodeSignal } from "@/lib/download-cookie";
import type { JobProgress, QualityOption } from "@/types/video";

const POLL_MS = 400;
/** Sedikit di atas batas function Vercel (300 dtk) — setelah itu pasti tidak ada jawaban lagi. */
const TIMEOUT_MS = 330_000;

function randomToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * Mode "direct" (serverless/Vercel): satu navigasi ke /api/download yang memproses lalu langsung
 * mengirim file. Halaman tahu hasilnya dari cookie singkat yang diset server (lihat download-cookie.ts).
 * Antarmuka sama dengan useDownloadJob agar Downloader tinggal memilih salah satu.
 */
export function useDirectDownload(onReady?: (jobId: string, progress: JobProgress, option: QualityOption) => void) {
  const [state, setState] = useState<DownloadJobState>({ status: "idle" });
  const timersRef = useRef<{ poll?: ReturnType<typeof setInterval>; timeout?: ReturnType<typeof setTimeout> }>({});
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const stop = useCallback(() => {
    clearInterval(timersRef.current.poll);
    clearTimeout(timersRef.current.timeout);
    timersRef.current = {};
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    async ({ url, item, option, turnstileToken }: StartJobInput) => {
      stop();
      const token = randomToken();
      const cookieName = `${DOWNLOAD_COOKIE_PREFIX}${token}`;
      const query = new URLSearchParams({ url, preset: option.preset, t: token });
      if (item > 1) query.set("item", String(item));
      if (turnstileToken) query.set("ts", turnstileToken);

      setState({ status: "active", option, jobId: token, progress: { jobId: token, stage: "downloading", percent: 0 } });

      // Navigasi biasa (bukan fetch): browser menulis file besar langsung ke disk, bukan ke RAM.
      // Tanpa atribut `download` → bila server menjawab 204 (gagal), halaman tetap di tempat.
      const link = document.createElement("a");
      link.href = apiUrl(`/api/download?${query}`);
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();

      timersRef.current.poll = setInterval(() => {
        const raw = readCookie(cookieName);
        if (!raw) return;
        clearCookie(cookieName);
        stop();
        const signal = decodeSignal(raw);
        if (signal?.ok) {
          const progress: JobProgress = {
            jobId: token,
            stage: "ready",
            percent: 100,
            ...(signal.fileName ? { fileName: signal.fileName } : {}),
            ...(signal.fileSize ? { fileSize: signal.fileSize } : {}),
          };
          setState({ status: "ready", option, jobId: token, progress });
          onReadyRef.current?.(token, progress, option);
        } else {
          setState({ status: "error", option, jobId: token, error: signal ? signal.error : clientError("UNKNOWN") });
        }
      }, POLL_MS);

      timersRef.current.timeout = setTimeout(() => {
        stop();
        setState({ status: "error", option, jobId: token, error: clientError("TIMEOUT") });
      }, TIMEOUT_MS);
    },
    [stop],
  );

  const cancel = useCallback(async () => {
    stop();
    // Hentikan navigasi unduhan yang masih berjalan → server ikut menghentikan yt-dlp.
    try {
      window.stop();
    } catch {
      /* abaikan */
    }
    setState((s) => ("option" in s ? { status: "canceled", option: s.option } : { status: "idle" }));
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setState({ status: "idle" });
  }, [stop]);

  return { state, start, cancel, reset };
}
