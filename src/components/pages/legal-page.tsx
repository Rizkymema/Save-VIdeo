import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { HtmlLang } from "@/components/layout/html-lang";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { localePath, switchLocalePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export function LegalPage({ locale, kind }: { locale: Locale; kind: "terms" | "privacy" }) {
  const dict = getDictionary(locale);
  const doc = dict.legal[kind];
  const path = `/${kind}`;
  return (
    <>
      <HtmlLang locale={locale} />
      <SiteHeader locale={locale} dict={dict} switchHref={switchLocalePath(localePath(locale, path), locale === "id" ? "en" : "id")} />
      <main id="main" lang={locale === "id" ? "id" : "en"} className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href={localePath(locale, "/")}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft weight="bold" className="size-4" aria-hidden />
          {dict.legal.back}
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dict.legal.updated}</p>
        <p className="mt-6 text-base leading-relaxed">{doc.intro}</p>
        <div className="mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.h}>
              <h2 className="text-lg font-semibold tracking-tight">{section.h}</h2>
              <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                {section.p.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter locale={locale} dict={dict} />
    </>
  );
}
