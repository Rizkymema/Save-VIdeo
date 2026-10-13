import { HomePage } from "@/components/pages/home-page";
import { platformMetadata } from "@/components/pages/platform-route";

export const metadata = platformMetadata("id", "facebook");

export default function Page() {
  return <HomePage locale="id" platform="facebook" />;
}
