"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Platform } from "@/types/video";

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  platform: Platform;
  thumbnail?: string;
  /** Mis. "1080p · MP4" atau "MP3". */
  label: string;
  at: number;
}

const KEY = "savelink:history:v1";
const MAX_ITEMS = 20;
const EMPTY: HistoryItem[] = [];

const listeners = new Set<() => void>();
let cache: { raw: string | null; items: HistoryItem[] } = { raw: null, items: EMPTY };

function isItem(x: unknown): x is HistoryItem {
  const o = x as HistoryItem;
  return Boolean(o) && typeof o.id === "string" && typeof o.url === "string" && typeof o.title === "string" && typeof o.at === "number";
}

function read(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.items;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(parsed) ? parsed.filter(isItem).slice(0, MAX_ITEMS) : EMPTY;
    cache = { raw, items };
    return items;
  } catch {
    // Storage diblokir/rusak: tetap jalan dengan data di memori.
    return cache.items;
  }
}

function write(items: HistoryItem[]) {
  const raw = JSON.stringify(items);
  cache = { raw, items };
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* mode privat / kuota penuh — riwayat hanya bertahan selama tab terbuka */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Riwayat unduhan di localStorage — tidak pernah dikirim ke server. */
export function useHistory() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);

  const add = useCallback((item: HistoryItem) => {
    const rest = read().filter((i) => i.id !== item.id && !(i.url === item.url && i.label === item.label));
    write([item, ...rest].slice(0, MAX_ITEMS));
  }, []);

  const remove = useCallback((id: string) => write(read().filter((i) => i.id !== id)), []);
  const clear = useCallback(() => write([]), []);

  return { items, add, remove, clear };
}
