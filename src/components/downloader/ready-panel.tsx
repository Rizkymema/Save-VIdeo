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
  const note = direct ? null : t(dict.ready.expires, { minutes: 30 });

  return (
    <div className="rounded-xl border border-success/30 bg-success/[0.07] p-3 sm:p-4">
      <div className="flex items-start gap-2.5">
        <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" role="status">
            {direct ? dict.ready.directTitle : dict.ready.title}
          </p>
          {progress.fileName && (
            <p className="truncate text-xs text-foreground/85" title={progress.fileName}>
              {progress.fileName}
              {size && <span className="font-mono text-muted-foreground"> · {size}</span>}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">{direct ? dict.ready.directSubtitle : dict.ready.subtitle}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
        {direct ? (
          <Button className="col-span-2 sm:min-w-36" onClick={onSaveAgain}>
            <DownloadSimple weight="bold" aria-hidden />
            {dict.ready.again}
          </Button>
        ) : (
          <Button asChild className="col-span-2 sm:min-w-36">
            <a href={fileUrl(jobId)} download={progress.fileName ?? ""}>
              <DownloadSimple weight="bold" aria-hidden />
              {dict.ready.save}
            </a>
          </Button>
        )}
        <Button variant="outline" onClick={onAnotherQuality}>
          <ArrowCounterClockwise weight="bold" aria-hidden />
          {dict.ready.another}
        </Button>
        <Button variant="ghost" onClick={onNewLink}>
          <LinkSimple weight="bold" aria-hidden />
          {dict.ready.newLink}
        </Button>
      </div>

      {(note || ios) && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {note}
          {ios && <span className={note ? "mt-0.5 block" : undefined}>{dict.ready.ios}</span>}
        </p>
      )}
    </div>
  );
}
