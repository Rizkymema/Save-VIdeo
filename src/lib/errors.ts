import { DETAIL_MESSAGES, ERROR_MESSAGES, RETRYABLE_CODES, fillTemplate } from "@/constants/messages";
import type { ApiError, ApiErrorCode, ApiErrorDetail } from "@/types/video";

export const HTTP_STATUS: Record<ApiErrorCode, number> = {
  INVALID_URL: 400,
  UNSUPPORTED: 422,
  PRIVATE: 403,
  LOGIN_REQUIRED: 403,
  AGE_RESTRICTED: 403,
  GEO_BLOCKED: 451,
  NOT_FOUND: 404,
  TOO_LONG: 413,
  TOO_LARGE: 413,
  FORMAT_UNAVAILABLE: 422,
  RATE_LIMITED: 429,
  BUSY: 503,
  BLOCKED_BY_PLATFORM: 502,
  TIMEOUT: 504,
  VERIFICATION_FAILED: 403,
  UNKNOWN: 500,
};

export function makeApiError(
  code: ApiErrorCode,
  opts: {
    detail?: ApiErrorDetail;
    retryAfterSec?: number;
    message?: string;
    params?: Record<string, string | number>;
  } = {},
): ApiError {
  const template =
    opts.message ?? (opts.detail ? DETAIL_MESSAGES[opts.detail] : undefined) ?? ERROR_MESSAGES[code];
  const error: ApiError = { code, message: fillTemplate(template, opts.params), retryable: RETRYABLE_CODES.has(code) };
  if (opts.detail) error.detail = opts.detail;
  if (opts.params) error.params = opts.params;
  if (opts.retryAfterSec !== undefined) error.retryAfterSec = opts.retryAfterSec;
  return error;
}

/** Error yang aman ditampilkan ke user (membawa ApiError + status HTTP). */
export class AppError extends Error {
  readonly apiError: ApiError;
  readonly status: number;

  constructor(code: ApiErrorCode, opts: Parameters<typeof makeApiError>[1] = {}) {
    const apiError = makeApiError(code, opts);
    super(apiError.message);
    this.name = "AppError";
    this.apiError = apiError;
    this.status = HTTP_STATUS[code];
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
