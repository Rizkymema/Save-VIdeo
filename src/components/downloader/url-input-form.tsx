"use client";

import { ArrowRight, CircleNotch, ClipboardText, LinkSimple, X } from "@phosphor-icons/react";
import { AnimatePresence, m } from "motion/react";
import { useSyncExternalStore, type ClipboardEvent, type RefObject } from "react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import { PLATFORM_LABELS, detectPlatform } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const noop = () => () => {};
const clipboardSupported = () => typeof navigator !== "undefined" && Boolean(navigator.clipboard?.readText);

export function UrlInputForm({
  value,
  onChange,
  onSubmit,
  onPaste,
  onPasteButton,
  onClear,
  loading,
  error,
  notice,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  onPasteButton: () => void;
  onClear: () => void;
  loading: boolean;
  error?: string | null;
  notice?: string | null;
  placeholder?: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const { dict, t } = useI18n();
  const canPaste = useSyncExternalStore(noop, clipboardSupported, () => false);
  const platform = value ? detectPlatform(value) : null;
  const platformName = platform && platform !== "other" ? PLATFORM_LABELS[platform] : null;
  const helper = error ?? notice ?? (platformName ? t(dict.input.detected, { platform: platformName }) : dict.input.hint);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="video-url" className="sr-only">
        {dict.input.label}
      </label>
      <div
        className={cn(
          "flex flex-col gap-2 rounded-[1.4rem] border bg-card/85 p-2 shadow-[0_24px_70px_-30px_rgb(0_0_0/0.55)] backdrop-blur-md transition-[border-color,box-shadow] duration-200 sm:flex-row sm:items-center",
          "focus-within:border-primary/70 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_20%,transparent),0_24px_70px_-30px_rgb(0_0_0/0.55)]",
          error ? "border-destructive/70" : "border-border",
        )}
      >
        <div className="relative flex min-w-0 flex-1 items-center">
          <span className="pointer-events-none absolute left-3.5 flex size-6 items-center justify-center text-muted-foreground">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                key={platform ?? "link"}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.18 }}
                className="flex"
              >
                {platform ? (
                  <PlatformIcon platform={platform} brandColor className="size-5" />
                ) : (
                  <LinkSimple weight="bold" className="size-5" aria-hidden />
                )}
              </m.span>
            </AnimatePresence>
          </span>
          <input
            ref={inputRef}
            id="video-url"
            name="url"
            type="url"
            inputMode="url"
            enterKeyHint="go"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder ?? dict.input.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            aria-invalid={Boolean(error)}
            aria-describedby="video-url-helper"
            className="h-14 w-full min-w-0 rounded-2xl bg-transparent pr-28 pl-12 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="absolute right-1.5 flex items-center">
            {value ? (
              <button
                type="button"
                onClick={onClear}
                aria-label={dict.input.clear}
                className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <X weight="bold" className="size-[18px]" aria-hidden />
              </button>
            ) : (
              canPaste && (
                <button
                  type="button"
                  onClick={onPasteButton}
                  aria-label={dict.input.pasteAria}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-secondary px-3.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ClipboardText weight="bold" className="size-[18px]" aria-hidden />
                  {dict.input.paste}
                </button>
              )
            )}
          </div>
        </div>
        <Button type="submit" size="xl" disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <CircleNotch weight="bold" className="size-5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight weight="bold" className="size-5" aria-hidden />
          )}
          {loading ? dict.input.submitting : dict.input.submit}
        </Button>
      </div>
      <p
        id="video-url-helper"
        aria-live="polite"
        className={cn("mt-3 px-1 text-center text-sm", error ? "font-medium text-destructive" : "text-muted-foreground")}
      >
        {helper}
      </p>
    </form>
  );
}
