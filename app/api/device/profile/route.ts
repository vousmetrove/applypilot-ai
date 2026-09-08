import { env } from "cloudflare:workers";
import { activePairing, corsJson, optionsResponse } from "@/lib/device-auth";
import { createPayload } from "@/public/profile-core.mjs";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const pairing = await activePairing(request);
  if (!pairing) return corsJson({ error: "设备连接已失效，请重新配对。" }, 401);
  const row = await env.DB.prepare(
    "SELECT profile_json, updated_at FROM profiles WHERE user_id = ? LIMIT 1",
  ).bind(pairing.user_id).first<{ profile_json: string; updated_at: string }>();
  await env.DB.prepare("UPDATE device_pairings SET last_seen_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), pairing.id).run();
  return corsJson({
    ...createPayload(row ? JSON.parse(row.profile_json || "{}") : {}),
    updatedAt: row?.updated_at || null,
    consent: { autoSubmit: false, sensitiveAutofill: false },
  });
}
