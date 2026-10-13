import { HomePage } from "@/components/pages/home-page";
import { platformMetadata } from "@/components/pages/platform-route";

export const metadata = platformMetadata("en", "youtube");

export default function Page() {
  return <HomePage locale="en" platform="youtube" />;
}
