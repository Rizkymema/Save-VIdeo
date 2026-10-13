import { HomePage } from "@/components/pages/home-page";
import { platformMetadata } from "@/components/pages/platform-route";

export const metadata = platformMetadata("id", "twitter");

export default function Page() {
  return <HomePage locale="id" platform="twitter" />;
}
