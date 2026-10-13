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
      <div className={cn("flex gap-4", portrait ? "flex-row items-start" : "flex-col sm:flex-row sm:items-start")}>
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-2xl bg-secondary ring-1 ring-border",
            portrait ? "aspect-[9/16] w-24 sm:w-28" : "aspect-video w-full sm:w-60",
          )}
        >
          <Thumbnail
            key={info.thumbnail ?? info.title}
            src={info.thumbnail}
            alt={t(dict.preview.thumbAlt, { title: info.title })}
            platform={info.platform}
            sizes={portrait ? "112px" : "(max-width: 640px) 100vw, 240px"}
          />
          {duration && (
            <span className="absolute right-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white tabular-nums">
              {duration}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <PlatformIcon platform={info.platform} brandColor className="size-3.5" />
            {platformName}
          </p>
          <h2 className="line-clamp-3 text-lg leading-snug font-semibold tracking-tight sm:text-xl">{info.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {info.uploader && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <User className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t(dict.preview.by, { name: info.uploader })}</span>
              </span>
            )}
            {duration && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden />
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
