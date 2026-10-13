import { HomePage } from "@/components/pages/home-page";
import { platformMetadata } from "@/components/pages/platform-route";

export const metadata = platformMetadata("en", "twitter");

export default function Page() {
  return <HomePage locale="en" platform="twitter" />;
}
