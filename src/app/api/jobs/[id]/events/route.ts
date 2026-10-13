import { connection } from "next/server";
import { makeApiError } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { getJob, isTerminal, subscribe } from "@/lib/jobs/store";
import { JOB_ID } from "@/lib/validation";
import type { JobProgress } from "@/types/video";

const HEARTBEAT_MS = 15_000;

/** GET /api/jobs/:id/events → Server-Sent Events berisi JobProgress sampai selesai. */
export async function GET(request: Request, ctx: RouteContext<"/api/jobs/[id]/events">) {
  await connection();
  const { id } = await ctx.params;
  const job = JOB_ID.test(id) ? getJob(id) : undefined;
  if (!job) return jsonError(makeApiError("NOT_FOUND", { detail: "expired" }), 404);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* sudah ditutup */
        }
      };
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = (p: JobProgress) => {
        write(`event: progress\ndata: ${JSON.stringify(p)}\n\n`);
        // Tutup setelah status akhir; beri jeda kecil agar event terkirim dulu.
        if (isTerminal(p.stage)) setTimeout(close, 50);
      };

      write(`retry: 3000\n\n`);
      heartbeat = setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS);
      request.signal.addEventListener("abort", close, { once: true });
      unsubscribe = subscribe(job, send);
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
