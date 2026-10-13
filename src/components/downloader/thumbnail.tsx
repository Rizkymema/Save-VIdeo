"use client";

import Image from "next/image";
import { useState } from "react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { isOptimizableThumbnail } from "@/lib/thumbnail-hosts";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types/video";

/**
 * Thumbnail dari CDN platform. Host yang dikenal lewat next/image (server-side, lolos hotlink),
 * host lain lewat <img> biasa. Gagal dimuat → placeholder ikon platform.
 * Parent wajib `relative` + berukuran.
 */
export function Thumbnail({
  src,
  alt,
  platform,
  sizes,
  iconClassName,
}: {
  src?: string;
  alt: string;
  platform: Platform;
  sizes: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-muted text-muted-foreground/70">
        <PlatformIcon platform={platform} className={cn("size-8", iconClassName)} />
      </div>
    );
  }

  if (isOptimizableThumbnail(src)) {
    return <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" onError={() => setFailed(true)} />;
  }

  return (
    // Host di luar daftar next/image: tampilkan apa adanya tanpa optimasi.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="absolute inset-0 size-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
