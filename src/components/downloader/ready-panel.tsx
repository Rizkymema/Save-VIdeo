"use client";

import { ArrowCounterClockwise, CheckCircle, DownloadSimple, LinkSimple } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { fileUrl } from "@/hooks/use-download-job";
import { useI18n } from "@/i18n/provider";
import { formatBytes } from "@/lib/format";
import type { JobProgress } from "@/types/video";

const noop = () => () => {};
const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

export function ReadyPanel({
  jobId,
  progress,
  onAnotherQuality,
  onNewLink,
  direct = false,
  onSaveAgain,
}: {
  jobId: string;
  progress: JobProgress;
  onAnotherQuality: () => void;
  onNewLink: () => void;
  /** Mode direct: file sudah dikirim & tidak disimpan di server → "Unduh lagi" memproses ulang. */
  direct?: boolean;
  onSaveAgain?: () => void;
}) {
  const { dict, t, locale } = useI18n();
  const ios = useSyncExternalStore(noop, isAppleMobile, () => false);
  const size = formatBytes(progress.fileSize, locale);

  return (
    <div className="rounded-2xl border border-success/30 bg-success/[0.07] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <CheckCircle weight="fill" className="size-7 shrink-0 text-success" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold" role="status">
            {direct ? dict.ready.directTitle : dict.ready.title}
          </p>
          {progress.fileName && (
            <p className="mt-0.5 truncate text-sm text-foreground/90" title={progress.fileName}>
              {progress.fileName}
              {size && <span className="font-mono text-muted-foreground"> · {size}</span>}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{direct ? dict.ready.directSubtitle : dict.ready.subtitle}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {direct ? (
          <Button size="lg" className="sm:min-w-44" onClick={onSaveAgain}>
            <DownloadSimple weight="bold" aria-hidden />
            {dict.ready.again}
          </Button>
        ) : (
          <Button asChild size="lg" className="sm:min-w-44">
            <a href={fileUrl(jobId)} download={progress.fileName ?? ""}>
              <DownloadSimple weight="bold" aria-hidden />
              {dict.ready.save}
            </a>
          </Button>
        )}
        <Button variant="outline" size="lg" onClick={onAnotherQuality}>
          <ArrowCounterClockwise weight="bold" aria-hidden />
          {dict.ready.another}
        </Button>
        <Button variant="ghost" size="lg" onClick={onNewLink}>
          <LinkSimple weight="bold" aria-hidden />
          {dict.ready.newLink}
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {direct ? dict.ready.directNote : t(dict.ready.expires, { minutes: 30 })}
        {ios && <span className="mt-1 block">{dict.ready.ios}</span>}
      </p>
    </div>
  );
}
