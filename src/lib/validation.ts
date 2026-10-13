import { z } from "zod";
import { MAX_URL_LENGTH } from "@/lib/platforms";
import { QUALITY_PRESETS } from "@/types/video";

const MAX_ITEMS = 20;

export const infoRequestSchema = z.object({
  url: z.string().trim().min(1).max(MAX_URL_LENGTH * 2),
  item: z.number().int().min(1).max(MAX_ITEMS).optional(),
});

export const jobRequestSchema = z.object({
  url: z.string().trim().min(1).max(MAX_URL_LENGTH * 2),
  preset: z.enum(QUALITY_PRESETS),
  item: z.number().int().min(1).max(MAX_ITEMS).optional(),
  turnstileToken: z.string().max(4096).optional(),
});

export const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InfoRequest = z.infer<typeof infoRequestSchema>;
export type JobRequest = z.infer<typeof jobRequestSchema>;
