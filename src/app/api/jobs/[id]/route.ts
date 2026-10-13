import { connection } from "next/server";
import { makeApiError } from "@/lib/errors";
import { json, jsonError } from "@/lib/http";
import { cancelJob } from "@/lib/jobs/queue";
import { getJob, snapshot } from "@/lib/jobs/store";
import { JOB_ID } from "@/lib/validation";

function notFound() {
  return jsonError(makeApiError("NOT_FOUND", { detail: "expired" }), 404);
}

/** GET /api/jobs/:id → status terkini (cadangan bila SSE diblokir proxy). */
export async function GET(_request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const job = JOB_ID.test(id) ? getJob(id) : undefined;
  if (!job) return notFound();
  return json(snapshot(job));
}

/** DELETE /api/jobs/:id → batalkan download. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  const job = JOB_ID.test(id) ? getJob(id) : undefined;
  if (!job) return notFound();
  cancelJob(job);
  return json(snapshot(job));
}
