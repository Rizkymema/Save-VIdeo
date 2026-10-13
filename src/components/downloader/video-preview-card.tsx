"use client";

import { Clock, User } from "@phosphor-icons/react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Thumbnail } from "@/components/downloader/thumbnail";
import { useI18n } from "@/i18n/provider";
import { formatDuration } from "@/lib/format";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import type { VideoInfo } from "@/types/video";

export function VideoPreviewCard({
  info,
  onSelectItem,
  switchingItem,
}: {
  info: VideoInfo;
  onSelectItem: (item: number) => void;
  switchingItem?: number;
}) {
  const { dict, t } = useI18n();
  const portrait = info.orientation === "portrait";
  const duration = formatDuration(info.durationSec);
  const platformName = info.platform === "other" ? dict.platforms.other : PLATFORM_LABELS[info.platform];

  return (
    <div>
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-border",
            portrait ? "aspect-[9/16] w-16 sm:w-20" : "aspect-video w-28 sm:w-40",
          )}
        >
          <Thumbnail
            key={info.thumbnail ?? info.title}
            src={info.thumbnail}
            alt={t(dict.preview.thumbAlt, { title: info.title })}
            platform={info.platform}
            sizes={portrait ? "80px" : "160px"}
          />
          {duration && (
            <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 py-px font-mono text-[10px] font-medium text-white tabular-nums">
              {duration}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <PlatformIcon platform={info.platform} brandColor className="size-3.5" />
            {platformName}
          </p>
          <h2 className="mt-1 line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight sm:text-base">
            {info.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {info.uploader && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <User className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{t(dict.preview.by, { name: info.uploader })}</span>
              </span>
            )}
            {duration && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {t(dict.preview.duration, { time: duration })}
              </span>
            )}
          </div>
        </div>
      </div>

      {info.items && info.items.length > 1 && (
        <div className="mt-5">
          <p className="mb-2.5 text-sm text-muted-foreground">{t(dict.preview.multi, { count: info.items.length })}</p>
          <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {info.items.map((item) => {
              const selected = (switchingItem ?? info.item) === item.index;
              return (
                <li key={item.index} className="snap-start">
                  <button
                    type="button"
                    onClick={() => onSelectItem(item.index)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-12 items-center gap-2 rounded-xl border px-2 pr-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    <span className="relative size-8 overflow-hidden rounded-md bg-secondary">
                      <Thumbnail src={item.thumbnail} alt="" platform={info.platform} sizes="32px" iconClassName="size-4" />
                    </span>
                    {t(dict.preview.item, { n: item.index })}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
