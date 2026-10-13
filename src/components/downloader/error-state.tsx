"use client";

import { ArrowClockwise, PencilSimple, SlidersHorizontal, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { errorMessage } from "@/lib/client-errors";
import type { ApiError } from "@/types/video";

/** Error selalu disertai jalan keluar (retry / kualitas lain / periksa link). */
export function ErrorState({
  error,
  onRetry,
  onOtherQuality,
  onEditLink,
}: {
  error: ApiError;
  onRetry?: () => void;
  onOtherQuality?: () => void;
  onEditLink?: () => void;
}) {
  const { dict, t } = useI18n();
  const [countdown, setCountdown] = useState(error.retryAfterSec ?? 0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/[0.07] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <WarningCircle weight="fill" className="size-6 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{dict.errors.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error, dict)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {error.retryable && onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} disabled={countdown > 0}>
                <ArrowClockwise weight="bold" aria-hidden />
                {countdown > 0 ? t(dict.errors.retryIn, { s: countdown }) : dict.errors.retry}
              </Button>
            )}
            {onOtherQuality && (
              <Button variant="ghost" size="sm" onClick={onOtherQuality}>
                <SlidersHorizontal weight="bold" aria-hidden />
                {dict.errors.otherQuality}
              </Button>
            )}
            {onEditLink && (
              <Button variant="ghost" size="sm" onClick={onEditLink}>
                <PencilSimple weight="bold" aria-hidden />
                {dict.errors.editLink}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
