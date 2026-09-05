import { env } from "cloudflare:workers";
import { corsJson, optionsResponse, sha256Hex } from "@/lib/device-auth";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const code = String(body.code || "").trim();
  const codeHash = await sha256Hex(`${id}:${code}`);
  const pairing = await env.DB.prepare(
    "SELECT id, status, expires_at, device_name FROM device_pairings WHERE id = ? AND code_hash = ? LIMIT 1",
  ).bind(id, codeHash).first<{ id: string; status: string; expires_at: string; device_name: string }>();

  if (!pairing) return corsJson({ error: "配对请求不存在。" }, 404);
  if (new Date(pairing.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("UPDATE device_pairings SET status = 'expired' WHERE id = ?").bind(id).run();
    return corsJson({ status: "expired", error: "配对码已过期。" }, 410);
  }
  if (pairing.status === "pending") return corsJson({ status: "pending" }, 202);
  if (pairing.status !== "approved" && pairing.status !== "active") return corsJson({ status: pairing.status }, 409);

  const token = await sha256Hex(`${id}:${code}:applypilot-device-token:v1`);
  const tokenHash = await sha256Hex(token);
  if (pairing.status === "approved") {
    await env.DB.prepare(
      "UPDATE device_pairings SET token_hash = ?, status = 'active', last_seen_at = ? WHERE id = ? AND status = 'approved'",
    ).bind(tokenHash, new Date().toISOString(), id).run();
  }
  return corsJson({ status: "active", token, pairingId: id, deviceName: pairing.device_name });
}
