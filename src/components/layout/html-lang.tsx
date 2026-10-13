"use client";

import { useEffect } from "react";
import { htmlLang, type Locale } from "@/i18n/config";

/** Sinkronkan <html lang> saat navigasi client-side antara halaman ID dan EN. */
export function HtmlLang({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);
  return null;
}
