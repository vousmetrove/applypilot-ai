import { env } from "cloudflare:workers";
import { sha256Hex } from "@/lib/device-auth";
import { requestUserId, unauthorized } from "@/lib/request-user";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const code = String(body.code || "").trim();
  const codeHash = await sha256Hex(`${id}:${code}`);
  const pairing = await env.DB.prepare(
    "SELECT id, status, expires_at FROM device_pairings WHERE id = ? AND code_hash = ? LIMIT 1",
  ).bind(id, codeHash).first<{ id: string; status: string; expires_at: string }>();

  if (!pairing) return Response.json({ error: "配对码不正确，请回到浏览器助手重新生成。" }, { status: 404 });
  if (new Date(pairing.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("UPDATE device_pairings SET status = 'expired' WHERE id = ? AND status IN ('pending','approved')").bind(id).run();
    return Response.json({ error: "配对码已过期，请重新生成。" }, { status: 410 });
  }
  if (pairing.status !== "pending") {
    return Response.json({ error: pairing.status === "active" ? "这台设备已经连接。" : "该配对请求已失效。" }, { status: 409 });
  }

  const update = await env.DB.prepare(
    "UPDATE device_pairings SET user_id = ?, status = 'approved', last_seen_at = ? WHERE id = ? AND status = 'pending'",
  ).bind(userId, new Date().toISOString(), id).run();
  if(update.meta.changes !== 1) return Response.json({error:"配对状态已变化，请重新生成。"},{status:409});
  return Response.json({ ok: true, message: "授权成功，请回到电脑浏览器完成连接。" });
}
