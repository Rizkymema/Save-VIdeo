import type { Dictionary } from "@/i18n/dictionaries/id";

/**
 * Bagian kamus yang dipakai komponen client (downloader). Teks lain (FAQ, legal,
 * halaman platform) dirender di server, jadi tidak perlu ikut dikirim ke browser.
 */
export type ClientDictionary = Pick<
  Dictionary,
  "input" | "platforms" | "preview" | "quality" | "progress" | "ready" | "errors" | "history"
>;

export function pickClientDict(dict: Dictionary): ClientDictionary {
  const { input, platforms, preview, quality, progress, ready, errors, history } = dict;
  return { input, platforms, preview, quality, progress, ready, errors, history };
}
