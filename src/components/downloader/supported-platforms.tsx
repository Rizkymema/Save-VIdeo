import Link from "next/link";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary, PlatformSlug } from "@/i18n/dictionaries/id";
import { PLATFORM_LABELS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const ORDER: PlatformSlug[] = ["youtube", "tiktok", "instagram", "facebook", "twitter"];

/** Deretan logo platform; tiap logo menuju halaman downloader khususnya. */
export function SupportedPlatforms({ locale, dict, active }: { locale: Locale; dict: Dictionary; active?: PlatformSlug }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{dict.platforms.label}</p>
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        {ORDER.map((slug) => (
          <li key={slug}>
            <Link
              prefetch={false}
              href={localePath(locale, `/${slug}`)}
              aria-current={active === slug ? "page" : undefined}
              className={cn(
                "group inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active === slug
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-card/70 hover:text-foreground",
              )}
            >
              <PlatformIcon platform={slug} className="size-[18px]" />
              <span className="hidden sm:inline">{PLATFORM_LABELS[slug]}</span>
              <span className="sr-only sm:hidden">{PLATFORM_LABELS[slug]}</span>
            </Link>
          </li>
        ))}
        <li className="px-2 text-sm font-medium text-muted-foreground">{dict.platforms.more}</li>
      </ul>
    </div>
  );
}
