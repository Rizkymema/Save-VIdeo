import type { Locale } from "@/i18n/config";
import { en } from "@/i18n/dictionaries/en";
import { id, type Dictionary } from "@/i18n/dictionaries/id";

const dictionaries: Record<Locale, Dictionary> = { id, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
