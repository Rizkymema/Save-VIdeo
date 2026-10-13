import { LegalPage } from "@/components/pages/legal-page";
import { id } from "@/i18n/dictionaries/id";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  locale: "id",
  path: "/terms",
  title: id.legal.terms.title,
  description: id.legal.terms.intro,
});

export default function Page() {
  return <LegalPage locale="id" kind="terms" />;
}
