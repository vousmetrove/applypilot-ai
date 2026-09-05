import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments } from "@/db/schema";
import { requestUserId, unauthorized } from "@/lib/request-user";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const { id } = await context.params;
  const [row] = await getDb().select().from(attachments).where(and(eq(attachments.id, id), eq(attachments.userId, userId))).limit(1);
  if (!row) return Response.json({ error: "材料不存在。" }, { status: 404 });
  const object = await env.BUCKET.get(row.r2Key);
  if (!object) return Response.json({ error: "文件对象不存在。" }, { status: 404 });
  const headers = new Headers();
  headers.set("Content-Type", row.contentType);
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`);
  headers.set("Cache-Control", "private, no-store");
  return new Response(object.body, { headers });
}
