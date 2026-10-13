import { HomePage } from "@/components/pages/home-page";
import { id } from "@/i18n/dictionaries/id";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  locale: "id",
  path: "/",
  title: id.meta.title,
  description: id.meta.description,
  absoluteTitle: true,
});

export default function Page() {
  return <HomePage locale="id" />;
}
