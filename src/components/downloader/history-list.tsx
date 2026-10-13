"use client";

import { ArrowClockwise, ClockCounterClockwise, Trash, X } from "@phosphor-icons/react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Thumbnail } from "@/components/downloader/thumbnail";
import { Button } from "@/components/ui/button";
import { useHistory } from "@/hooks/use-history";
import { useI18n } from "@/i18n/provider";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function relativeTime(at: number, locale: string, justNow: string): string {
  const diff = at - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return justNow;
}

/** Riwayat lokal — hanya dirender di browser (snapshot server selalu kosong). */
export function HistoryList({ onReuse }: { onReuse: (url: string) => void }) {
  const { dict, t, locale } = useI18n();
  const { items, remove, clear } = useHistory();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="history-title" className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="history-title" className="flex items-center gap-2 text-base font-semibold">
            <ClockCounterClockwise weight="bold" className="size-[18px] text-muted-foreground" aria-hidden />
            {dict.history.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{dict.history.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={clear}>
          <Trash weight="bold" aria-hidden />
          {dict.history.clear}
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/60">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 p-2.5 pl-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
              <Thumbnail src={item.thumbnail} alt="" platform={item.platform} sizes="48px" iconClassName="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={item.title}>
                {item.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <PlatformIcon platform={item.platform} className="size-3.5" />
                <span className="truncate">
                  {item.label} · {relativeTime(item.at, locale, dict.history.justNow)}
                </span>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onReuse(item.url)} className="shrink-0">
              <ArrowClockwise weight="bold" aria-hidden />
              <span className="hidden sm:inline">{dict.history.again}</span>
              <span className="sr-only sm:hidden">{dict.history.again}</span>
            </Button>
            <button
              type="button"
              onClick={() => remove(item.id)}
              aria-label={t(dict.history.remove, { title: item.title })}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X weight="bold" className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
