import { LegalPage } from "@/components/pages/legal-page";
import { en } from "@/i18n/dictionaries/en";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  locale: "en",
  path: "/privacy",
  title: en.legal.privacy.title,
  description: en.legal.privacy.intro,
});

export default function Page() {
  return <LegalPage locale="en" kind="privacy" />;
}
