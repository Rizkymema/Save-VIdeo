"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/hooks/use-theme";

/** Ikon diatur lewat CSS (dark:) sehingga tidak ada mismatch saat hydrate. */
export function ThemeToggle({ label }: { label: string }) {
  const { toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Sun className="hidden size-5 dark:block" weight="bold" aria-hidden />
      <Moon className="size-5 dark:hidden" weight="bold" aria-hidden />
    </button>
  );
}
