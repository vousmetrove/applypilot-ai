import { env } from "cloudflare:workers";
import { safeJsonObject } from "@/lib/device-auth";
import { requestUserId, unauthorized } from "@/lib/request-user";

const allowedCommands = new Set(["sync_profile", "open_application", "analyze_current_form", "fill_current_form"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const { id: deviceId } = await context.params;
  const body = safeJsonObject(await request.json().catch(() => ({})));
  const type = String(body.type || "");
  if (!allowedCommands.has(type)) return Response.json({ error: "该远程任务不在安全允许列表中。" }, { status: 400 });
  const device = await env.DB.prepare(
    "SELECT id FROM device_pairings WHERE id = ? AND user_id = ? AND status = 'active' LIMIT 1",
  ).bind(deviceId, userId).first();
  if (!device) return Response.json({ error: "设备不存在或已离线。" }, { status: 404 });
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO device_commands (id, user_id, device_id, type, payload_json, status, result_json, created_at) VALUES (?, ?, ?, ?, ?, 'pending', '{}', ?)",
  ).bind(id, userId, deviceId, type, JSON.stringify(safeJsonObject(body.payload)), new Date().toISOString()).run();
  return Response.json({ command: { id, type, status: "pending", requiresDeviceConfirmation: true } }, { status: 201 });
}
