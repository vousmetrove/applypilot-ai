import { env } from "cloudflare:workers";
import { activePairing, corsJson, optionsResponse, safeJsonObject } from "@/lib/device-auth";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const pairing = await activePairing(request);
  if (!pairing) return corsJson({ error: "设备连接已失效。" }, 401);
  const rows = await env.DB.prepare(
    "SELECT id, type, payload_json, created_at FROM device_commands WHERE device_id = ? AND user_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 10",
  ).bind(pairing.id, pairing.user_id).all<{ id: string; type: string; payload_json: string; created_at: string }>();
  return corsJson({ commands: (rows.results || []).map((row) => ({
    id: row.id, type: row.type, payload: JSON.parse(row.payload_json || "{}"), createdAt: row.created_at,
  })) });
}

export async function PATCH(request: Request) {
  const pairing = await activePairing(request);
  if (!pairing) return corsJson({ error: "设备连接已失效。" }, 401);
  const body = safeJsonObject(await request.json().catch(() => ({})));
  const commandId = String(body.commandId || "");
  const status = body.status === "completed" ? "completed" : body.status === "declined" ? "declined" : "failed";
  await env.DB.prepare(
    "UPDATE device_commands SET status = ?, result_json = ?, completed_at = ? WHERE id = ? AND device_id = ? AND user_id = ? AND status = 'pending'",
  ).bind(status, JSON.stringify(safeJsonObject(body.result)), new Date().toISOString(), commandId, pairing.id, pairing.user_id).run();
  return corsJson({ ok: true });
}
