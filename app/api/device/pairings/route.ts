import { env } from "cloudflare:workers";
import { corsJson, optionsResponse, randomPairingCode, sha256Hex } from "@/lib/device-auth";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const deviceName = String(body.deviceName || "浏览器助手").trim().slice(0, 80) || "浏览器助手";
  const id = crypto.randomUUID();
  const code = randomPairingCode();
  const codeHash = await sha256Hex(`${id}:${code}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO device_pairings (id, user_id, code_hash, device_name, status, expires_at, created_at) VALUES (?, '', ?, ?, 'pending', ?, ?)",
  ).bind(id, codeHash, deviceName, expiresAt, new Date().toISOString()).run();

  const origin = new URL(request.url).origin;
  return corsJson({
    pairingId: id,
    code,
    expiresAt,
    confirmUrl: `${origin}/connect/${encodeURIComponent(id)}?code=${encodeURIComponent(code)}`,
  }, 201);
}
