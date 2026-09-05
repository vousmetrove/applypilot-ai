import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { applications } from "@/db/schema";
import { jsonObject, requestUserId, unauthorized } from "@/lib/request-user";

const allowedStatuses = new Set(["待投递", "已投递", "笔试", "面试", "Offer", "已拒绝", "已撤回"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const { id } = await context.params;
  const payload = jsonObject(await request.json());
  const patch: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (payload.status && allowedStatuses.has(String(payload.status))) patch.status = String(payload.status);
  if (typeof payload.platform === "string") patch.platform = payload.platform.slice(0, 80);
  if (typeof payload.applicationUrl === "string") patch.applicationUrl = payload.applicationUrl.slice(0, 2048);

  await getDb().update(applications).set(patch).where(and(eq(applications.id, id), eq(applications.userId, userId)));
  return Response.json({ ok: true });
}
