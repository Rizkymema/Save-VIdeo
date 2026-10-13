"use client";

import { Check, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JobProgress, QualityOption } from "@/types/video";

function stepIndex(progress?: JobProgress): number {
  switch (progress?.stage) {
    case "downloading":
      return 1;
    case "merging":
    case "converting":
      return 2;
    case "ready":
      return 3;
    default:
      return 0;
  }
}

export function DownloadProgress({
  option,
  progress,
  onCancel,
}: {
  option: QualityOption;
  progress?: JobProgress;
  onCancel: () => void;
}) {
  const { dict, t, locale } = useI18n();
  const stage = progress?.stage;
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const label = option.kind === "audio" ? option.label : option.recommended ? `${dict.quality.best} ${option.label}` : option.label;

  let status: string = dict.progress.starting;
  if (stage === "queued") {
    status = progress?.queuePosition ? t(dict.progress.queued, { n: progress.queuePosition }) : dict.progress.queuedShort;
  } else if (stage === "downloading") {
    status = progress?.step === "audio" ? dict.progress.audio : progress?.step === "video" ? dict.progress.video : dict.progress.file;
  } else if (stage === "merging") {
    status = dict.progress.merging;
  } else if (stage === "converting") {
    status = dict.progress.converting;
  }

  const indeterminate = !progress || stage === "queued" || stage === "merging" || stage === "converting";
  const speed = stage === "downloading" ? formatBytes(progress?.speedBps, locale) : undefined;
  const eta = stage === "downloading" && progress?.etaSec ? formatDuration(progress.etaSec) : undefined;
  const done = formatBytes(progress?.downloadedBytes, locale);
  const total = formatBytes(progress?.totalBytes, locale);
  const steps = [dict.progress.steps.queued, dict.progress.steps.download, dict.progress.steps.process, dict.progress.steps.done];
  const current = stepIndex(progress);

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t(dict.progress.title, { label })}</p>
          <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
            {status}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} className="-mt-1 -mr-1.5">
          <X weight="bold" aria-hidden />
          {dict.progress.cancel}
        </Button>
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-2" aria-hidden>
        {steps.map((name, i) => (
          <li key={name} className="flex flex-col gap-1.5">
            <span
              className={cn(
                "h-1 rounded-full transition-colors duration-300",
                i < current ? "bg-primary" : i === current ? "bg-primary/60" : "bg-border",
              )}
            />
            <span
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium",
                i <= current ? "text-foreground" : "text-muted-foreground/70",
              )}
            >
              {i < current && <Check weight="bold" className="size-3 text-primary" />}
              {name}
            </span>
          </li>
        ))}
      </ol>

      <div
        role="progressbar"
        aria-label={status}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(percent)}
        className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted"
      >
        {indeterminate ? (
          <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full bg-primary" />
        ) : (
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out-expo"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground tabular-nums">
        <span>{indeterminate && stage !== "queued" && progress ? "95%" : `${Math.round(percent)}%`}</span>
        <span className="flex flex-wrap gap-x-3">
          {done && total && (
            <span>
              {done} / {total}
            </span>
          )}
          {speed && <span>{t(dict.progress.speed, { speed })}</span>}
          {eta && <span>{t(dict.progress.eta, { time: eta })}</span>}
        </span>
      </div>
    </div>
  );
}
