"use client";

import { DownloadSimple, FilmStrip, MusicNotes, Star } from "@phosphor-icons/react";
import { m, type Variants } from "motion/react";
import { resolutionTier } from "@/constants/presets";
import { useI18n } from "@/i18n/provider";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { QualityOption } from "@/types/video";

const list: Variants = { show: { transition: { staggerChildren: 0.045 } } };
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
};

export function QualitySelector({
  options,
  onSelect,
  disabled,
  limitMb,
}: {
  options: QualityOption[];
  onSelect: (option: QualityOption) => void;
  disabled?: boolean;
  /** Mode direct: batas ukuran server untuk pesan opsi yang terlalu besar. */
  limitMb?: number;
}) {
  const { dict } = useI18n();
  const video = options.filter((o) => o.kind === "video");
  const audio = options.filter((o) => o.kind === "audio");
  const merges = video.some((o) => o.needsMerge);

  return (
    <div className="space-y-6">
      {video.length > 0 && (
        <div role="group" aria-labelledby="quality-video">
          <h3
            id="quality-video"
            className="mb-2.5 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
          >
            <FilmStrip className="size-4" weight="bold" aria-hidden />
            {dict.quality.video}
          </h3>
          <m.ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" variants={list} initial="hidden" animate="show">
            {video.map((option) => (
              <m.li key={option.preset} variants={itemVariants}>
                <OptionButton option={option} onSelect={onSelect} disabled={disabled} limitMb={limitMb} />
              </m.li>
            ))}
          </m.ul>
          {merges && <p className="mt-2.5 text-xs text-muted-foreground">{dict.quality.mergeNote}</p>}
        </div>
      )}

      {audio.length > 0 && (
        <div role="group" aria-labelledby="quality-audio">
          <h3
            id="quality-audio"
            className="mb-2.5 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
          >
            <MusicNotes className="size-4" weight="bold" aria-hidden />
            {dict.quality.audio}
          </h3>
          <m.ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" variants={list} initial="hidden" animate="show">
            {audio.map((option) => (
              <m.li key={option.preset} variants={itemVariants}>
                <OptionButton option={option} onSelect={onSelect} disabled={disabled} limitMb={limitMb} />
              </m.li>
            ))}
          </m.ul>
        </div>
      )}
    </div>
  );
}

function OptionButton({
  option,
  onSelect,
  disabled,
  limitMb,
}: {
  option: QualityOption;
  onSelect: (option: QualityOption) => void;
  disabled?: boolean;
  limitMb?: number;
}) {
  const { dict, t, locale } = useI18n();
  const size = formatBytes(option.approxBytes, locale);
  const tier = option.kind === "video" ? resolutionTier(option.height) : undefined;
  const meta = [
    tier ? dict.quality.tiers[tier] : undefined,
    option.fps && option.fps >= 48 ? `${option.fps}fps` : undefined,
    option.hdr ? dict.quality.hdr : undefined,
  ].filter(Boolean);

  const note = option.tooLarge
    ? t(dict.quality.tooLarge, { maxMb: limitMb ?? "?" })
    : option.kind === "audio"
      ? option.preset === "audio-m4a"
        ? dict.quality.audioM4a
        : dict.quality.audioMp3
      : option.recommended && option.codec === "h264"
        ? dict.quality.codec.h264
        : option.codec === "vp9" || option.codec === "av1" || option.codec === "h265"
          ? dict.quality.codec[option.codec]
          : undefined;

  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      disabled={disabled || option.tooLarge}
      aria-label={t(
        dict.quality.downloadAria,
        option.kind === "audio"
          ? { label: dict.quality.audio, ext: option.label }
          : { label: option.recommended ? `${dict.quality.best} ${option.label}` : option.label, ext: option.ext.toUpperCase() },
      )}
      className={cn(
        "group flex h-full min-h-[84px] w-full flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-[border-color,background-color,transform] duration-200 ease-out-expo focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        option.recommended
          ? "border-primary/60 bg-primary/[0.08] hover:border-primary hover:bg-primary/[0.13]"
          : "border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/80",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[17px] leading-tight font-semibold tracking-tight">{option.label}</span>
          {option.recommended && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] leading-none font-semibold text-primary-foreground">
              <Star weight="fill" className="size-3" aria-hidden />
              {dict.quality.best}
            </span>
          )}
        </span>
        <DownloadSimple
          weight="bold"
          aria-hidden
          className="mt-0.5 size-[18px] shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-primary"
        />
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {meta.length > 0 && <span>{meta.join(" · ")}</span>}
        {meta.length > 0 && size && <span aria-hidden>·</span>}
        <span className="font-mono tabular-nums">{size ? t(dict.quality.approx, { size }) : option.ext.toUpperCase()}</span>
      </span>
      {note && <span className="text-[11.5px] leading-snug text-muted-foreground">{note}</span>}
    </button>
  );
}
