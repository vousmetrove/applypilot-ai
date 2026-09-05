import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments } from "@/db/schema";
import { requestUserId, unauthorized } from "@/lib/request-user";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const { id } = await context.params;
  const [row] = await getDb().select().from(attachments).where(and(eq(attachments.id, id), eq(attachments.userId, userId))).limit(1);
  if (!row) return Response.json({ error: "材料不存在。" }, { status: 404 });
  await env.BUCKET.delete(row.r2Key);
  await getDb().delete(attachments).where(and(eq(attachments.id, id), eq(attachments.userId, userId)));
  return Response.json({ ok: true });
}
