import { cn } from "@/lib/utils";

/** Logo SaveLink: panah unduh ke "baki" di atas kotak oranye. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden focusable="false">
      <rect width="32" height="32" rx="9" fill="#F97316" />
      <rect x="1" y="1" width="30" height="15" rx="8" fill="#FFFFFF" opacity="0.12" />
      <path
        d="M16 7.5v11.25m0 0-4.6-4.6M16 18.75l4.6-4.6"
        fill="none"
        stroke="#1C1917"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.75 23.75h12.5" fill="none" stroke="#1C1917" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-foreground">SaveLink</span>
    </span>
  );
}
