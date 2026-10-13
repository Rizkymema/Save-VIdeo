import { LegalPage } from "@/components/pages/legal-page";
import { id } from "@/i18n/dictionaries/id";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  locale: "id",
  path: "/privacy",
  title: id.legal.privacy.title,
  description: id.legal.privacy.intro,
});

export default function Page() {
  return <LegalPage locale="id" kind="privacy" />;
}
