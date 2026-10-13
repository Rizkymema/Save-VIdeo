import { HomePage } from "@/components/pages/home-page";
import { en } from "@/i18n/dictionaries/en";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  locale: "en",
  path: "/",
  title: en.meta.title,
  description: en.meta.description,
  absoluteTitle: true,
});

export default function Page() {
  return <HomePage locale="en" />;
}
