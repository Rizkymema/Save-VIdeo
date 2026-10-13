import { Translate } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";

const navLink =
  "inline-flex h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function SiteHeader({ locale, dict, switchHref }: { locale: Locale; dict: Dictionary; switchHref: string }) {
  const home = localePath(locale, "/");
  const otherLocale: Locale = locale === "id" ? "en" : "id";
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {dict.nav.skip}
      </a>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={home} aria-label={dict.nav.home} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo />
          </Link>
          <nav aria-label={dict.meta.siteName}>
            <ul className="flex items-center gap-0.5">
              <li className="hidden sm:block">
                <a href={`${home === "/" ? "" : home}#how`} className={navLink}>
                  {dict.nav.how}
                </a>
              </li>
              <li className="hidden sm:block">
                <a href={`${home === "/" ? "" : home}#faq`} className={navLink}>
                  {dict.nav.faq}
                </a>
              </li>
              <li>
                <Link
                  prefetch={false}
                  href={switchHref}
                  hrefLang={otherLocale}
                  aria-label={`${dict.nav.language}: ${dict.nav.languageName}`}
                  className={`${navLink} gap-1.5 font-semibold`}
                >
                  <Translate weight="bold" className="size-[18px]" aria-hidden />
                  {dict.nav.languageShort}
                </Link>
              </li>
              <li>
                <ThemeToggle label={dict.nav.theme} />
              </li>
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
