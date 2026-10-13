import { LegalPage } from "@/components/pages/legal-page";
import { en } from "@/i18n/dictionaries/en";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  locale: "en",
  path: "/terms",
  title: en.legal.terms.title,
  description: en.legal.terms.intro,
});

export default function Page() {
  return <LegalPage locale="en" kind="terms" />;
}
