"use client";

import { AnimatePresence, LazyMotion, MotionConfig, m, type HTMLMotionProps } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { DirectProgress } from "@/components/downloader/direct-progress";
import { DownloadProgress } from "@/components/downloader/download-progress";
import { ErrorState } from "@/components/downloader/error-state";
import { HistoryList } from "@/components/downloader/history-list";
import { QualitySelector } from "@/components/downloader/quality-selector";
import { ReadyPanel } from "@/components/downloader/ready-panel";
import { UrlInputForm } from "@/components/downloader/url-input-form";
import { VideoPreviewCard } from "@/components/downloader/video-preview-card";
import { VideoPreviewSkeleton } from "@/components/downloader/video-preview-skeleton";
import { useDirectDownload } from "@/hooks/use-direct-download";
import { fileUrl, useDownloadJob } from "@/hooks/use-download-job";
import { useHistory } from "@/hooks/use-history";
import { useTurnstile } from "@/hooks/use-turnstile";
import { useVideoInfo } from "@/hooks/use-video-info";
import { useI18n } from "@/i18n/provider";
import { extractUrl, validateVideoUrl } from "@/lib/platforms";
import type { JobProgress, QualityOption, VideoInfo } from "@/types/video";

const fade: HTMLMotionProps<"div"> = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16 } },
};

const CARD =
  "mt-6 rounded-3xl border border-border bg-card/85 p-4 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.6)] backdrop-blur-md sm:p-6";

// Fitur animasi dimuat terpisah setelah halaman tampil (bundle awal lebih ringan).
const loadMotionFeatures = () => import("@/lib/motion-features").then((mod) => mod.default);

// Ditentukan saat build: Vercel → "direct" (satu request per unduhan),
// Docker/VPS → "jobs" (antrean + progress real-time lewat SSE).
const DIRECT_MODE = process.env.NEXT_PUBLIC_DOWNLOAD_MODE === "direct";
const useDownloader = DIRECT_MODE ? useDirectDownload : useDownloadJob;

/** Klik link unduhan secara programatik (file besar langsung ditangani browser, tidak lewat RAM). */
function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function Downloader({ placeholder, below }: { placeholder?: string; below?: ReactNode }) {
  const { dict, t } = useI18n();
  const [value, setValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const latestInfo = useRef<VideoInfo | null>(null);
  const sharedHandled = useRef(false);

  const { state: infoState, fetchInfo, reset: resetInfo } = useVideoInfo();
  const { add: addHistory } = useHistory();
  const { containerRef: turnstileRef, getToken, enabled: turnstileEnabled } = useTurnstile();

  const onReady = useCallback(
    (jobId: string, progress: JobProgress, option: QualityOption) => {
      // Mode direct: browser sudah mengunduh lewat navigasi /api/download.
      if (!DIRECT_MODE) triggerDownload(fileUrl(jobId));
      const info = latestInfo.current;
      if (info) {
        addHistory({
          id: jobId,
          url: info.sourceUrl,
          title: info.title,
          platform: info.platform,
          thumbnail: info.thumbnail,
          label: option.kind === "video" ? `${option.label} · MP4` : option.label,
          at: Date.now(),
        });
      }
      toast.success(t(dict.ready.toast, { name: progress.fileName ?? info?.title ?? "" }));
    },
    [addHistory, dict.ready.toast, t],
  );
  const { state: jobState, start, cancel, reset: resetJob } = useDownloader(onReady);

  const info = infoState.status === "ready" ? infoState.info : infoState.status === "loading" ? infoState.previous : undefined;

  useEffect(() => {
    if (infoState.status !== "ready") return;
    latestInfo.current = infoState.info;
    // Tutup keyboard HP & tampilkan hasil.
    inputRef.current?.blur();
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [infoState]);

  const submit = useCallback(
    (raw: string) => {
      const check = validateVideoUrl(raw);
      if (!check.ok) {
        const reason = check.reason === "empty" || check.reason === "not_video" ? check.reason : "invalid";
        setInputError(dict.input.invalid[reason]);
        inputRef.current?.focus();
        return;
      }
      const url = extractUrl(raw) ?? raw.trim();
      setInputError(null);
      setValue(url);
      resetJob();
      void fetchInfo(url);
    },
    [dict.input.invalid, fetchInfo, resetJob],
  );

  // Link dari Web Share Target (Bagikan → SaveLink) atau ?url=... langsung diproses.
  useEffect(() => {
    if (sharedHandled.current) return;
    sharedHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const shared = ["url", "text", "title"].map((k) => extractUrl(params.get(k) ?? "")).find(Boolean);
    if (!shared) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    queueMicrotask(() => {
      setNotice(dict.input.shared);
      submit(shared);
    });
  }, [dict.input.shared, submit]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      const url = extractUrl(event.clipboardData.getData("text"));
      if (!url) return;
      event.preventDefault();
      setNotice(null);
      submit(url);
    },
    [submit],
  );

  const handlePasteButton = useCallback(async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      const url = extractUrl(text);
      if (url) {
        setNotice(null);
        submit(url);
      } else {
        setValue(text);
        if (text) setInputError(dict.input.invalid.invalid);
        inputRef.current?.focus();
      }
    } catch {
      toast.error(dict.input.pasteDenied);
      inputRef.current?.focus();
    }
  }, [dict.input.invalid.invalid, dict.input.pasteDenied, submit]);

  const handleSelect = useCallback(
    async (option: QualityOption) => {
      if (!info) return;
      const turnstileToken = turnstileEnabled ? await getToken() : undefined;
      void start({ url: info.sourceUrl, item: info.item, option, turnstileToken });
    },
    [getToken, info, start, turnstileEnabled],
  );

  const newLink = useCallback(() => {
    resetJob();
    resetInfo();
    latestInfo.current = null;
    setValue("");
    setNotice(null);
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus();
  }, [resetInfo, resetJob]);

  const loading = infoState.status === "loading";

  let jobPanel: ReactNode = null;
  if (info) {
    switch (jobState.status) {
      case "starting":
      case "active":
        jobPanel = DIRECT_MODE ? (
          <DirectProgress option={jobState.option} onCancel={cancel} />
        ) : (
          <DownloadProgress
            option={jobState.option}
            progress={jobState.status === "active" ? jobState.progress : undefined}
            onCancel={cancel}
          />
        );
        break;
      case "ready": {
        const readyOption = jobState.option;
        jobPanel = (
          <ReadyPanel
            jobId={jobState.jobId}
            progress={jobState.progress}
            onAnotherQuality={resetJob}
            onNewLink={newLink}
            direct={DIRECT_MODE}
            onSaveAgain={() => void handleSelect(readyOption)}
          />
        );
        break;
      }
      case "error":
        jobPanel = (
          <ErrorState
            error={jobState.error}
            onRetry={() => void handleSelect(jobState.option)}
            onOtherQuality={resetJob}
          />
        );
        break;
      default:
        jobPanel = (
          <>
            {jobState.status === "canceled" && (
              <p className="mb-4 text-sm text-muted-foreground" role="status">
                {dict.progress.canceled}
              </p>
            )}
            <QualitySelector
              options={info.options}
              onSelect={(o) => void handleSelect(o)}
              disabled={loading}
              limitMb={info.limitMb}
            />
          </>
        );
    }
  }

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <UrlInputForm
          value={value}
          onChange={(v) => {
            setValue(v);
            if (inputError) setInputError(null);
          }}
          onSubmit={() => submit(value)}
          onPaste={handlePaste}
          onPasteButton={() => void handlePasteButton()}
          onClear={() => {
            setValue("");
            setInputError(null);
            inputRef.current?.focus();
          }}
          loading={loading && !info}
          error={inputError}
          notice={notice}
          placeholder={placeholder}
          inputRef={inputRef}
        />

        {below}

        <div ref={turnstileRef} className="flex justify-center empty:hidden" />

        <div ref={resultRef} className="scroll-mt-24">
          <AnimatePresence mode="wait" initial={false}>
            {loading && !info && (
              <m.div key="loading" {...fade} className={CARD}>
                <VideoPreviewSkeleton label={dict.preview.loading} />
              </m.div>
            )}
            {infoState.status === "error" && (
              <m.div key="error" {...fade} className="mt-6">
                <ErrorState
                  error={infoState.error}
                  onRetry={() => void fetchInfo(infoState.url)}
                  onEditLink={["INVALID_URL", "UNSUPPORTED", "NOT_FOUND"].includes(infoState.error.code) ? focusInput : undefined}
                />
              </m.div>
            )}
            {info && (
              <m.div key={`info-${info.sourceUrl}`} {...fade} className={CARD} aria-busy={loading}>
                <div className={loading ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
                  <VideoPreviewCard
                    info={info}
                    switchingItem={infoState.status === "loading" ? infoState.item : undefined}
                    onSelectItem={(item) => {
                      if (item === info.item && !loading) return;
                      resetJob();
                      void fetchInfo(info.sourceUrl, item);
                    }}
                  />
                </div>
                <div className="my-5 h-px bg-border" />
                <AnimatePresence mode="wait" initial={false}>
                  <m.div key={jobState.status} {...fade}>
                    {jobPanel}
                  </m.div>
                </AnimatePresence>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <HistoryList
          onReuse={(url) => {
            setNotice(null);
            submit(url);
            inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      </MotionConfig>
    </LazyMotion>
  );
}
