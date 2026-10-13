import { Downloader } from "@/components/downloader/downloader";
import { SupportedPlatforms } from "@/components/downloader/supported-platforms";
import { HtmlLang } from "@/components/layout/html-lang";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AmbientBackground, Faq, Features, HowItWorks, JsonLd } from "@/components/sections/sections";
import { pickClientDict } from "@/i18n/client-dict";
import { localePath, switchLocalePath, type Locale } from "@/i18n/config";
import type { PlatformSlug } from "@/i18n/dictionaries/id";
import { getDictionary } from "@/i18n/get-dictionary";
import { I18nProvider } from "@/i18n/provider";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

/** Halaman utama & halaman per-platform (/tiktok, /en/youtube, ...) memakai komponen yang sama. */
export function HomePage({ locale, platform }: { locale: Locale; platform?: PlatformSlug }) {
  const dict = getDictionary(locale);
  const copy = platform ? dict.platformPages[platform] : undefined;
  const path = platform ? `/${platform}` : "/";
  const faqItems = copy ? [...copy.faq, ...dict.faq.items] : dict.faq.items;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: absoluteUrl(localePath(locale, path)),
      description: copy?.description ?? dict.meta.description,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      inLanguage: locale === "id" ? "id-ID" : "en",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  return (
    <I18nProvider locale={locale} dict={pickClientDict(dict)}>
      <HtmlLang locale={locale} />
      <SiteHeader locale={locale} dict={dict} switchHref={switchLocalePath(localePath(locale, path), locale === "id" ? "en" : "id")} />
      <main id="main" lang={locale === "id" ? "id" : "en"}>
        <section className="relative isolate">
          <AmbientBackground />
          <div className="mx-auto max-w-6xl px-4 pt-10 pb-10 sm:px-6 sm:pt-16 lg:pt-20">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-[1.875rem] leading-[1.1] font-bold tracking-[-0.03em] sm:text-[2.75rem] lg:text-5xl">
                {copy?.h1 ?? dict.hero.title} <span className="text-primary">{copy?.highlight ?? dict.hero.highlight}</span>
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {copy?.subtitle ?? dict.hero.subtitle}
              </p>
            </div>
            <div className="mx-auto mt-6 max-w-3xl sm:mt-8">
              <Downloader
                placeholder={copy?.placeholder}
                below={<SupportedPlatforms locale={locale} dict={dict} active={platform} />}
              />
            </div>
          </div>
        </section>
        <HowItWorks dict={dict} />
        <Features dict={dict} />
        <Faq title={dict.faq.title} items={faqItems} />
      </main>
      <SiteFooter locale={locale} dict={dict} />
      <JsonLd data={jsonLd} />
    </I18nProvider>
  );
}
