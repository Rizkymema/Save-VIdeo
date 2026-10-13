import { AppError } from "@/lib/errors";
import type { ApiErrorCode, ApiErrorDetail } from "@/types/video";

interface Rule {
  test: RegExp;
  code: ApiErrorCode;
  detail?: ApiErrorDetail;
}

/** Urutan penting: aturan yang lebih spesifik di atas. */
const RULES: Rule[] = [
  { test: /File is larger than max-filesize|larger than the max(imum)? file ?size/i, code: "TOO_LARGE" },
  { test: /Unsupported URL|is not a valid URL|no suitable (Info)?Extractor/i, code: "UNSUPPORTED" },
  { test: /live event will begin|Premieres in|is_upcoming|This live event|live stream recording is not available/i, code: "UNSUPPORTED", detail: "live" },
  { test: /\bDRM\b/i, code: "UNSUPPORTED", detail: "drm" },
  { test: /confirm your age|age[- ]restricted|age[- ]gated|inappropriate for some users|age verification/i, code: "AGE_RESTRICTED" },
  { test: /not a bot|bot detection|unusual traffic|captcha|Unexpected response from webpage request|impersonat/i, code: "BLOCKED_BY_PLATFORM" },
  { test: /private video|video is private|account is private|this post is private|is a private/i, code: "PRIVATE" },
  {
    test: /login required|log ?in to|sign ?in to|logged[- ]in|requires? (an )?account|use --cookies|--cookies-from-browser|authentication|members[- ]only|join this channel|rate-limit reached or login required|isn't available to everyone/i,
    code: "LOGIN_REQUIRED",
  },
  { test: /HTTP Error 429|Too Many Requests|rate[- ]?limit/i, code: "BLOCKED_BY_PLATFORM" },
  { test: /available in your (country|region|location)|geo[- ]?restrict|blocked it in your country|geo[- ]?block/i, code: "GEO_BLOCKED" },
  { test: /no video formats found|There's no video|does not contain (any )?video|no media found|This tweet does not|No video could be found/i, code: "NOT_FOUND", detail: "no_video" },
  {
    test: /Video unavailable|has been removed|has been deleted|does not exist|no longer available|HTTP Error 404|HTTP Error 410|not found|Unable to find video|content (is )?unavailable|Post not found|page isn't available/i,
    code: "NOT_FOUND",
  },
  {
    test: /unable to obtain file audio codec|does not contain any (audio )?stream|matches no streams|no audio stream/i,
    code: "FORMAT_UNAVAILABLE",
    detail: "no_audio",
  },
  { test: /Requested format is not available|format not available|No formats? found/i, code: "FORMAT_UNAVAILABLE" },
  {
    test: /timed out|time ?out|Connection reset|Connection refused|Temporary failure in name resolution|getaddrinfo failed|Name or service not known|Unable to download (webpage|JSON|API)|Remote end closed|SSL|EOF occurred|IncompleteRead|HTTP Error 5\d\d/i,
    code: "TIMEOUT",
  },
];

/** Ambil baris "ERROR:" terakhir dari stderr yt-dlp (paling relevan). */
export function extractErrorLine(stderr: string): string {
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors = lines.filter((l) => l.startsWith("ERROR:"));
  return (errors.at(-1) ?? lines.at(-1) ?? "").slice(0, 500);
}

/** Petakan stderr yt-dlp ke AppError yang ramah user. */
export function mapYtDlpError(stderr: string, opts: { timedOut?: boolean; spawnError?: string } = {}): AppError {
  if (opts.timedOut) return new AppError("TIMEOUT");
  // Binary yt-dlp tidak bisa dijalankan (tidak terpasang / salah path).
  if (opts.spawnError) return new AppError("UNKNOWN", { detail: "engine" });
  const line = extractErrorLine(stderr);
  const haystack = line || stderr;
  for (const rule of RULES) {
    if (rule.test.test(haystack)) return new AppError(rule.code, rule.detail ? { detail: rule.detail } : {});
  }
  return new AppError("UNKNOWN");
}
