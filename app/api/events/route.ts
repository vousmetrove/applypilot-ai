import { env } from "cloudflare:workers";
import { requestUserId, unauthorized } from "@/lib/request-user";

export async function GET(request: Request) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const rows = await env.DB.prepare(
    "SELECT id, device_id, type, platform, message, payload_json, created_at FROM device_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
  ).bind(userId).all<{ id: string; device_id: string; type: string; platform: string; message: string; payload_json: string; created_at: string }>();
  return Response.json({ events: (rows.results || []).map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    type: row.type,
    platform: row.platform,
    message: row.message,
    payload: JSON.parse(row.payload_json || "{}"),
    createdAt: row.created_at,
  })) });
}
