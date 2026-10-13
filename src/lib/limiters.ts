import "server-only";
import { env } from "@/lib/env";
import { SlidingWindowLimiter } from "@/lib/rate-limit";

const g = globalThis as unknown as {
  __savelinkLimiters?: { info: SlidingWindowLimiter; jobs: SlidingWindowLimiter };
};

function limiters() {
  const e = env();
  g.__savelinkLimiters ??= {
    info: new SlidingWindowLimiter(e.RATE_LIMIT_INFO_PER_MIN, 60_000),
    jobs: new SlidingWindowLimiter(e.RATE_LIMIT_JOBS_PER_10MIN, 10 * 60_000),
  };
  return g.__savelinkLimiters;
}

export const infoLimiter = () => limiters().info;
export const jobLimiter = () => limiters().jobs;
