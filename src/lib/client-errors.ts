import { RETRYABLE_CODES, fillTemplate } from "@/constants/messages";
import type { Dictionary } from "@/i18n/dictionaries/id";
import type { ApiError, ApiErrorCode, ApiErrorDetail } from "@/types/video";

export function clientError(code: ApiErrorCode, detail?: ApiErrorDetail): ApiError {
  return { code, message: "", retryable: RETRYABLE_CODES.has(code) || detail === "network", ...(detail ? { detail } : {}) };
}

/** Ambil ApiError dari response API (atau buat UNKNOWN bila bentuknya tidak dikenal). */
export async function readApiError(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as { error?: ApiError };
    if (data?.error?.code) return data.error;
  } catch {
    /* bukan JSON */
  }
  if (res.status === 429) return clientError("RATE_LIMITED");
  if (res.status >= 500) return clientError(res.status === 504 ? "TIMEOUT" : "UNKNOWN");
  return clientError("UNKNOWN");
}

/** Pesan error sesuai bahasa UI: detail spesifik > kode umum > pesan server. */
export function errorMessage(error: ApiError, dict: Pick<Dictionary, "errors">): string {
  const detail = error.detail ? dict.errors.details[error.detail] : undefined;
  const template = detail ?? dict.errors.codes[error.code] ?? error.message;
  return fillTemplate(template, error.params);
}
