import { SiFacebook, SiInstagram, SiTiktok, SiX, SiYoutube } from "@icons-pack/react-simple-icons";
import { GlobeSimple } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types/video";

/** Warna brand resmi (dipakai saat hover/aktif; default ikut warna teks). */
export const PLATFORM_COLORS: Record<Platform, string> = {
  youtube: "#FF0000",
  tiktok: "#FE2C55",
  instagram: "#E4405F",
  facebook: "#0866FF",
  twitter: "currentColor",
  other: "currentColor",
};

export function PlatformIcon({
  platform,
  className,
  brandColor = false,
}: {
  platform: Platform;
  className?: string;
  brandColor?: boolean;
}) {
  const props = {
    className: cn("size-5 shrink-0", className),
    "aria-hidden": true,
    color: brandColor ? PLATFORM_COLORS[platform] : "currentColor",
  } as const;
  switch (platform) {
    case "youtube":
      return <SiYoutube {...props} />;
    case "tiktok":
      return <SiTiktok {...props} />;
    case "instagram":
      return <SiInstagram {...props} />;
    case "facebook":
      return <SiFacebook {...props} />;
    case "twitter":
      return <SiX {...props} />;
    default:
      return <GlobeSimple className={props.className} aria-hidden weight="bold" />;
  }
}
