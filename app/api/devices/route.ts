import { env } from "cloudflare:workers";
import { requestUserId, unauthorized } from "@/lib/request-user";

export async function GET(request: Request) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const rows = await env.DB.prepare(
    "SELECT id, device_name, status, created_at, last_seen_at FROM device_pairings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
  ).bind(userId).all();
  return Response.json({ devices: rows.results || [] });
}
