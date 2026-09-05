import { env } from "cloudflare:workers";
import { activePairing, corsJson, optionsResponse, safeJsonObject } from "@/lib/device-auth";

const allowedTypes = new Set(["page_detected", "form_analyzed", "form_filled", "status_changed", "command_completed"]);

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const pairing = await activePairing(request);
  if (!pairing) return corsJson({ error: "设备连接已失效。" }, 401);
  const body = safeJsonObject(await request.json().catch(() => ({})));
  const type = String(body.type || "");
  if (!allowedTypes.has(type)) return corsJson({ error: "不支持的事件类型。" }, 400);
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO device_events (id, user_id, device_id, type, platform, message, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    crypto.randomUUID(), pairing.user_id, pairing.id, type,
    String(body.platform || "unknown").slice(0, 40),
    String(body.message || "").slice(0, 500),
    JSON.stringify(safeJsonObject(body.payload)), now,
  ).run();
  await env.DB.prepare("UPDATE device_pairings SET last_seen_at = ? WHERE id = ?").bind(now, pairing.id).run();
  return corsJson({ ok: true, receivedAt: now }, 201);
}
