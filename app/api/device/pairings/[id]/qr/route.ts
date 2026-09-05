import { env } from "cloudflare:workers";
import { sha256Hex } from "@/lib/device-auth";
// @ts-expect-error qrcode does not publish types for its internal, Worker-safe core module.
import QRCodeCore from "qrcode/lib/core/qrcode";
// @ts-expect-error qrcode does not publish types for its internal, Worker-safe SVG renderer.
import SvgRenderer from "qrcode/lib/renderer/svg-tag";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const codeHash = await sha256Hex(`${id}:${code}`);
  const pairing = await env.DB.prepare(
    "SELECT expires_at FROM device_pairings WHERE id = ? AND code_hash = ? AND status IN ('pending', 'approved', 'active') LIMIT 1",
  ).bind(id, codeHash).first<{ expires_at: string }>();
  if (!pairing || new Date(pairing.expires_at).getTime() < Date.now()) {
    return new Response("配对二维码已失效", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const confirmUrl = `${url.origin}/connect/${encodeURIComponent(id)}?code=${encodeURIComponent(code)}`;
  const qr = QRCodeCore.create(confirmUrl, { errorCorrectionLevel: "M" });
  const svg = SvgRenderer.render(qr, { margin: 2, width: 260, color: { dark: "#07111fff", light: "#ffffffff" } });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
