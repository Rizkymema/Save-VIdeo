"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ClientDictionary } from "@/i18n/client-dict";
import type { Locale } from "@/i18n/config";
import { interpolate } from "@/lib/format";

interface I18nValue {
  locale: Locale;
  dict: ClientDictionary;
  /** Isi template `{nama}` dari kamus. */
  t: (template: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: ClientDictionary; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ locale, dict, t: interpolate }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n harus dipakai di dalam <I18nProvider>");
  return value;
}
