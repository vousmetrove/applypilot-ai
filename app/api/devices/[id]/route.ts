import { env } from "cloudflare:workers";
import { requestUserId, unauthorized } from "@/lib/request-user";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const { id } = await context.params;
  await env.DB.prepare(
    "UPDATE device_pairings SET status = 'revoked', token_hash = NULL WHERE id = ? AND user_id = ?",
  ).bind(id, userId).run();
  return Response.json({ ok: true });
}
