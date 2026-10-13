"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { formatDuration } from "@/lib/format";
import type { QualityOption } from "@/types/video";

/** Mode direct: server memproses tanpa laporan persen → tampilkan status + waktu berjalan. */
export function DirectProgress({ option, onCancel }: { option: QualityOption; onCancel: () => void }) {
  const { dict, t } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  const label = option.kind === "audio" ? option.label : option.recommended ? `${dict.quality.best} ${option.label}` : option.label;

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t(dict.progress.title, { label })}</p>
          <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
            {dict.progress.preparing}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} className="-mt-1 -mr-1.5">
          <X weight="bold" aria-hidden />
          {dict.progress.cancel}
        </Button>
      </div>

      <div role="progressbar" aria-label={dict.progress.preparing} className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full bg-primary" />
      </div>
      <p className="mt-2 font-mono text-xs text-muted-foreground tabular-nums">
        {t(dict.progress.elapsed, { time: formatDuration(elapsed) ?? "0:00" })}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{dict.progress.preparingHint}</p>
    </div>
  );
}
