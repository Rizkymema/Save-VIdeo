import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary, PlatformSlug } from "@/i18n/dictionaries/id";
import { PLATFORM_LABELS } from "@/lib/platforms";

const PLATFORM_LINKS: PlatformSlug[] = ["youtube", "tiktok", "instagram", "facebook", "twitter"];
const footerLink =
  "inline-flex min-h-9 items-center gap-2 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <footer className="mt-8 border-t border-border/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">{dict.footer.tagline}</p>
          <p className="mt-4 max-w-md text-xs leading-relaxed text-muted-foreground">{dict.footer.disclaimer}</p>
        </div>
        <nav aria-labelledby="footer-downloaders">
          <h2 id="footer-downloaders" className="text-sm font-semibold">
            {dict.footer.downloaders}
          </h2>
          <ul className="mt-2 text-sm">
            {PLATFORM_LINKS.map((slug) => (
              <li key={slug}>
                <Link href={localePath(locale, `/${slug}`)} prefetch={false} className={footerLink}>
                  <PlatformIcon platform={slug} className="size-4" />
                  {PLATFORM_LABELS[slug]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-legal">
          <h2 id="footer-legal" className="text-sm font-semibold">
            {dict.footer.legal}
          </h2>
          <ul className="mt-2 text-sm">
            <li>
              <Link href={localePath(locale, "/terms")} prefetch={false} className={footerLink}>
                {dict.footer.terms}
              </Link>
            </li>
            <li>
              <Link href={localePath(locale, "/privacy")} prefetch={false} className={footerLink}>
                {dict.footer.privacy}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>© SaveLink</span>
          <span>yt-dlp · ffmpeg · Next.js</span>
        </div>
      </div>
    </footer>
  );
}
